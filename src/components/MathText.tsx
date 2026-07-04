"use client";

import { Fragment } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Renders SAT text that may contain LaTeX math delimited by $…$ (inline) or
// $$…$$ (display). Plain text (including existing Unicode like "x²") is untouched,
// so this is fully backward-compatible with content authored before math support.
// Escape a literal dollar with \$.

type Seg =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

function splitMath(input: string): Seg[] {
  const segs: Seg[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) segs.push({ type: "text", value: buf });
    buf = "";
  };
  while (i < input.length) {
    const ch = input[i];
    // Escaped dollar → literal.
    if (ch === "\\" && input[i + 1] === "$") {
      buf += "$";
      i += 2;
      continue;
    }
    if (ch === "$") {
      const display = input[i + 1] === "$";
      const delim = display ? "$$" : "$";
      const end = input.indexOf(delim, i + delim.length);
      if (end === -1) {
        // Unmatched delimiter → treat as literal text.
        buf += ch;
        i += 1;
        continue;
      }
      flush();
      segs.push({ type: "math", value: input.slice(i + delim.length, end), display });
      i = end + delim.length;
      continue;
    }
    buf += ch;
    i += 1;
  }
  flush();
  return segs;
}

function renderTex(tex: string, display: boolean): string {
  // throwOnError:false makes KaTeX emit a red-highlighted source string instead of
  // throwing, so a bad item can never crash the exam or results page.
  return katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    output: "htmlAndMathml",
  });
}

export default function MathText({
  children,
  className,
}: {
  children?: string | null;
  className?: string;
}) {
  const text = children ?? "";
  if (!text) return null;
  // Fast path: no math → render as plain text.
  if (!text.includes("$")) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {splitMath(text).map((seg, i) =>
        seg.type === "text" ? (
          <Fragment key={i}>{seg.value}</Fragment>
        ) : (
          <span
            key={i}
            className={seg.display ? "block my-2" : "inline-block"}
            // KaTeX output is math markup only (no scripts) — safe to inject.
            dangerouslySetInnerHTML={{ __html: renderTex(seg.value, seg.display) }}
          />
        ),
      )}
    </span>
  );
}
