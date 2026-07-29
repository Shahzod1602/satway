#!/usr/bin/env python3
"""
SAT PDF → OCR → JSON pipeline using Gemini Vision (Vertex AI, user OAuth).

Uses authorized_user credentials (refresh token) → project-e031e9d2.
Reads each PDF from /Users/shahzod/SAT files/, renders pages, OCRs each with
gemini-2.5-flash, merges with the answer key, writes import-ready JSON per exam.

Outputs: /tmp/sat_exams/<slug>.json  (9 files)
"""
import fitz
import json, os, re, base64, time, urllib.request, urllib.error, urllib.parse
from pathlib import Path

CREDS_PATH = "/Users/shahzod/Downloads/vertex-ai-credentials.json"
PDF_DIR = "/Users/shahzod/SAT files"
OUT_DIR = "/tmp/sat_exams"
MODEL = "gemini-2.5-flash"
PROJECT = "project-e031e9d2-1ea9-4cb2-b1a"
DPI = 150
ANSWER_PAGES = 2
os.makedirs(OUT_DIR, exist_ok=True)

# Token cache
_access_token = None
_token_at = 0
def get_token():
    global _access_token, _token_at
    if _access_token and time.time() - _token_at < 3000:
        return _access_token
    c = json.load(open(CREDS_PATH))
    body = urllib.parse.urlencode({
        "client_id": c["client_id"], "client_secret": c["client_secret"],
        "refresh_token": c["refresh_token"], "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=body, method="POST")
    resp = urllib.request.urlopen(req, timeout=20)
    _access_token = json.loads(resp.read())["access_token"]
    _token_at = time.time()
    return _access_token

def parse_answers(pdf_path):
    doc = fitz.open(pdf_path)
    full = re.sub(r"[\u200b\ufeff]", "", "".join(p.get_text() for p in doc))
    doc.close()
    m1 = re.search(r"M1\s*(.*?)(?=M2|$)", full, re.DOTALL)
    m2 = re.search(r"M2\s*(.*?)$", full, re.DOTALL)
    def grab(section):
        answers = {}
        for line in (section or "").split("\n"):
            m = re.match(r"^(\d{1,2})\.\s*(.+)$", line.strip())
            if m:
                n = int(m.group(1))
                if 1 <= n <= 22:
                    answers[n] = m.group(2).strip()
        return answers
    return grab(m1.group(1) if m1 else ""), grab(m2.group(1) if m2 else "")

def module_pages(n):
    q = n - ANSWER_PAGES
    half = q // 2
    return list(range(0, half)), list(range(half, q))

PROMPT = """This is a page from a Digital SAT MATH exam. Extract EVERY question on this page as a JSON array.

Each question object MUST have exactly these fields:
- "order": question number (integer)
- "type": "MCQ_SINGLE" if it has lettered choices A/B/C/D, or "STUDENT_PRODUCED_RESPONSE" if it's a grid-in (fill-in, no choices)
- "prompt": the COMPLETE question text. Preserve ALL math notation exactly: fractions as a/b, exponents as x^2, decimals, equations. If there's a diagram/figure/graph, describe it precisely in [brackets] including ALL labeled values, angles, points, and any equations on the figure.
- "options": for MCQ, array of 4 strings with choice values (e.g. ["96","16","10","22"]). For grid-in, null.
- "correctAnswers": ["?"] for every question (answers come from a separate key)

Be EXTREMELY precise with numbers and math. Do NOT skip any question. If a page has no numbered question, return []. Return ONLY the JSON array, no markdown fences, no commentary."""

def ocr_page(pdf_path, page_idx, retries=4):
    doc = fitz.open(pdf_path)
    pix = doc[page_idx].get_pixmap(dpi=DPI)
    img_bytes = pix.tobytes("png")
    doc.close()
    b64 = base64.b64encode(img_bytes).decode()
    body = json.dumps({
        "contents": [{"role": "user", "parts": [
            {"inline_data": {"mime_type": "image/png", "data": b64}},
            {"text": PROMPT},
        ]}],
        "generationConfig": {"temperature": 0.1},
    }).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"https://aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/global/publishers/google/models/{MODEL}:generateContent",
                method="POST",
                headers={"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"},
                data=body,
            )
            resp = urllib.request.urlopen(req, timeout=90)
            out = json.loads(resp.read())
            text = out.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            text = re.sub(r"^```(?:json)?\s*", "", text.strip())
            text = re.sub(r"\s*```$", "", text)
            m = re.search(r"\[.*\]", text, re.DOTALL)
            if not m:
                return []
            return json.loads(m.group())
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                wait = 3 * (attempt + 1)
                print(f"    page {page_idx}: HTTP {e.code}, retry in {wait}s", flush=True)
                time.sleep(wait)
            else:
                print(f"    page {page_idx}: HTTP {e.code} {e.read().decode()[:80]}", flush=True)
                return []
        except Exception as e:
            print(f"    page {page_idx}: {str(e)[:80]}", flush=True)
            time.sleep(2)
    print(f"    page {page_idx}: FAILED after {retries} retries", flush=True)
    return []

def merge_answers(questions, answers_map):
    out = []
    for q in questions:
        order = q.get("order")
        ans = answers_map.get(order, "?")
        out.append({
            "order": order,
            "type": q.get("type", "MCQ_SINGLE"),
            "prompt": q.get("prompt", ""),
            "options": q.get("options"),
            "correctAnswers": [ans] if ans != "?" else ["?"],
            "stimulus": q.get("stimulus"),
        })
    return out

def dedupe_sort(qs):
    # Drop questions where the OCR missed the question number (order is None/missing).
    # Without this, sort() crashes on None vs int, and a numberless question is useless
    # anyway (it can't be matched to the answer key).
    qs = [q for q in qs if isinstance(q.get("order"), int) and q.get("order") > 0]
    seen = {}
    for q in qs:
        o = q["order"]
        if o not in seen:
            seen[o] = q
    return [seen[k] for k in sorted(seen.keys())]

def process_pdf(pdf_path):
    fname = os.path.basename(pdf_path)
    title = fname.replace(".pdf", "")
    print(f"\n{'='*60}\n📄 {title}\n{'='*60}", flush=True)
    doc = fitz.open(pdf_path)
    n = len(doc)
    doc.close()
    m1_pages, m2_pages = module_pages(n)
    m1_ans, m2_ans = parse_answers(pdf_path)
    print(f"  {n} pages · M1 {m1_pages[0]}-{m1_pages[-1]} ({len(m1_pages)}) · M2 {m2_pages[0]}-{m2_pages[-1]} ({len(m2_pages)})", flush=True)
    print(f"  answers: M1={len(m1_ans)} M2={len(m2_ans)}", flush=True)
    m1q, m2q = [], []
    print(f"  OCR M1...", flush=True)
    for p in m1_pages:
        qs = ocr_page(pdf_path, p)
        m1q.extend(qs)
        if qs:
            print(f"    page {p}: {len(qs)} Q (orders {[q.get('order') for q in qs]})", flush=True)
        time.sleep(0.3)
    print(f"  OCR M2...", flush=True)
    for p in m2_pages:
        qs = ocr_page(pdf_path, p)
        m2q.extend(qs)
        if qs:
            print(f"    page {p}: {len(qs)} Q (orders {[q.get('order') for q in qs]})", flush=True)
        time.sleep(0.3)
    m1q = dedupe_sort(m1q)
    m2q = dedupe_sort(m2q)
    m1f = merge_answers(m1q, m1_ans)
    m2f = merge_answers(m2q, m2_ans)
    print(f"  ✓ M1: {len(m1f)} Q · M2: {len(m2f)} Q", flush=True)
    result = {"title": title, "module1": m1f, "module2": m2f}
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60]
    out_path = os.path.join(OUT_DIR, f"{slug}.json")
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"  → {out_path}", flush=True)
    return out_path

def main():
    files = sorted([f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")])
    print(f"📚 {len(files)} PDFs", flush=True)
    results = []
    for fname in files:
        try:
            results.append(process_pdf(os.path.join(PDF_DIR, fname)))
        except Exception as e:
            print(f"  ✗ FAILED: {str(e)[:120]}", flush=True)
    print(f"\n{'='*60}\nDone: {len(results)}/{len(files)} → {OUT_DIR}", flush=True)
    missing_m1 = sum(1 for r in results if len(json.load(open(r)).get("module1",[])) < 22)
    print(f"Files with M1 < 22 questions: {missing_m1} (may need review)")

if __name__ == "__main__":
    main()
