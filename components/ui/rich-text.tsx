// Renders already-sanitized HTML (KB article body, ticket description).
// Server-Component-safe — no "use client" needed since this only reads
// props and renders markup, no hooks/state/effects.
//
// IMPORTANT: only ever pass content that has already been through
// sanitizeRichText() (lib/sanitize-html.ts) at save time. This component
// does not sanitize — it trusts whatever the database already trusts.
export function RichText({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={`[&_p]:mb-2 [&_p:last-child]:mb-0 [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2:first-child]:mt-0 [&_h3]:mb-1.5 [&_h3]:mt-2.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5 [&_blockquote]:mb-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-fg-muted [&_pre]:mb-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-2 [&_pre]:p-2 [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_a]:text-accent [&_a]:underline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
