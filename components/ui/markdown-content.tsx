import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

// Renders user-authored markdown (KB article body, ticket description).
// Server-Component-safe — no "use client" needed, react-markdown renders
// synchronously with no client-only hooks.
//
// This is the sanitization boundary, not the save actions: react-markdown
// never turns raw HTML embedded in the source into real markup (no
// rehype-raw plugin), so a `<script>` typed into the textarea — or POSTed
// directly to a save action, bypassing the editor entirely — renders as
// nothing, never executes. rehypeSanitize additionally restricts link/image
// URLs to http/https/mailto, closing the one gap plain markdown->HTML
// otherwise leaves open (a `javascript:` href surviving as a clickable
// link). Because every render path (staff views, portal views, and the
// editor's own Preview tab) goes through this one component, there's a
// single place this can drift, not several.
//
// `img` `src` is further restricted to same-origin `/api/attachments/...`
// URLs (regex match, not just a protocol check — relative URLs have no
// protocol and would otherwise sail through the `protocols` allowlist
// below unchecked). This app has a client portal, so an unrestricted
// `![](https://attacker.example/pixel.gif)` would let anyone embed a
// tracking pixel / SSRF probe in a ticket or KB article simply by typing
// markdown. Images pointing anywhere else are dropped (the `src` attribute
// is stripped, leaving an inert `<img>` with no network request), rather
// than allowed through.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [["src", /^\/api\/attachments\//], "alt"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
};

export function MarkdownContent({
  markdown,
  className = "",
}: {
  markdown: string;
  className?: string;
}) {
  return (
    <div
      className={`[&_p]:mb-2 [&_p:last-child]:mb-0 [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2:first-child]:mt-0 [&_h3]:mb-1.5 [&_h3]:mt-2.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5 [&_li:has(>input)]:list-none [&_li:has(>input)]:-ml-5 [&_blockquote]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-fg-muted [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-2 [&_pre]:p-2 [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-accent [&_a]:underline [&_strong]:font-semibold [&_del]:opacity-70 [&_hr]:my-3 [&_hr]:border-border-strong [&_table]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border-strong [&_th]:bg-surface-2 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-border-strong [&_td]:px-2 [&_td]:py-1 [&_img]:max-w-full [&_img]:rounded-md ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[[rehypeSanitize, schema]]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
