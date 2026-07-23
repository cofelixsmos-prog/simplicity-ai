// Serialize a value for safe embedding inside an inline <script> tag.
//
// JSON.stringify does NOT escape `<`, `>`, `&`, or the U+2028 / U+2029 line
// separators, so a value containing "</script>" would break out of the tag and
// allow HTML/script injection (XSS). Escaping those to their \uXXXX forms keeps
// the JSON valid while making a tag breakout impossible. Same approach Next.js
// uses for its own inlined data.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
}
