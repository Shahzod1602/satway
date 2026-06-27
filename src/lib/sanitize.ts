// Minimal server-side HTML sanitizer for admin/AI-authored question stimulus &
// passage HTML. The content is trusted-ish (only admins / the generator write it),
// but we still strip the active-content vectors so a bad/compromised author or
// unsafe AI markup can't run script in students' authenticated sessions.
// Runs on the server (in exam.ts) so the client never receives unsafe HTML.
export function sanitizeHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  let out = String(html);
  // Drop dangerous element blocks entirely (with their content).
  out = out.replace(
    /<\s*(script|style|iframe|object|embed|svg|math|link|meta|base|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  // Drop the same tags when self-closing / unclosed.
  out = out.replace(
    /<\s*(script|style|iframe|object|embed|svg|math|link|meta|base|form)[^>]*\/?>/gi,
    "",
  );
  // Strip inline event handlers: onclick=, onerror=, onload=, …
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutralize javascript:/data: in href/src.
  out = out.replace(
    /(href|src)\s*=\s*("|')\s*(?:javascript|data|vbscript):[^"']*\2/gi,
    "$1=$2#$2",
  );
  return out;
}
