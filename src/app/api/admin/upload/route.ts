import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { jsonError, withErrorHandling } from "@/lib/apiError";

// Allowlist of accepted upload types → canonical extension.
const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function uploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!(await requireAdmin())) return jsonError("Unauthorized", 403);

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("No file provided", 400);
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return jsonError("Unsupported file type. Allowed: PDF, PNG, JPEG, WebP.", 415);
  }
  if (file.size > MAX_BYTES) {
    return jsonError("File too large (max 20 MB).", 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const dir = uploadDir();
  await mkdir(dir, { recursive: true });

  // Generated name only — never trust the client-supplied filename.
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
  await writeFile(path.join(dir, uniqueName), buffer);

  // Files written outside public/ are served via a dedicated handler; the
  // default location stays under /uploads.
  const url = `/uploads/${uniqueName}`;
  return Response.json({ url }, { status: 201 });
});
