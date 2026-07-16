import sanitizeHtml from "sanitize-html";

// Single source of truth for the rich-text sanitization allowlist. Every save
// path that persists user-authored HTML (KB articles, ticket descriptions)
// must call sanitizeRichText before it touches the database — this is the
// only place that allowlist logic should live.
const ALLOWED_TAGS = [
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "ul",
  "ol",
  "li",
  "pre",
  "code",
  "strong",
  "em",
  "u",
  "s",
  "a",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href"],
};

const ALLOWED_SCHEMES = ["http", "https", "mailto"];

export function sanitizeRichText(html: string): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesByTag: {},
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
  });
}

// Used only by the client portal's plain-textarea ticket submission. The
// portal never runs Tiptap, but Ticket.description is now rendered as HTML
// everywhere regardless of which form created it, so plain text typed there
// has to become safe, equivalent HTML before it's stored: escape special
// characters, then turn blank-line-separated blocks into <p> paragraphs and
// remaining single newlines into <br>. The result is still run through
// sanitizeRichText by the caller for defense in depth.
export function escapePlainTextToHtml(text: string): string {
  if (!text) return "";

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`);

  return paragraphs.join("");
}
