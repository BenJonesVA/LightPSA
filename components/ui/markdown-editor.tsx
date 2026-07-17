"use client";

import { useRef, useState } from "react";
import { MarkdownContent } from "./markdown-content";

// Bridges a plain markdown textarea into a Server Action form POST — unlike
// the Tiptap editor this replaces, no hidden mirror input is needed: the
// textarea itself carries `name` and stays mounted (just visually hidden)
// while the Preview tab is showing, so its value still submits either way.

function tabButtonClass(active: boolean) {
  return `rounded px-2 py-1 text-xs font-semibold transition-colors ${
    active ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-2"
  }`;
}

function toolbarButtonClass() {
  return "rounded px-2 py-1 text-xs font-semibold text-fg-muted hover:bg-surface-2";
}

// Wraps the current selection in `before`/`after` (e.g. bold/italic/link),
// or inserts a placeholder at the cursor if nothing is selected.
function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
  setValue: (v: string) => void,
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd) || placeholder;
  const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  setValue(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
  });
}

// Prefixes every selected line (or the current line, if nothing is
// selected) with `prefix` — used for headings and list markers.
function prefixLines(textarea: HTMLTextAreaElement, prefix: string, setValue: (v: string) => void) {
  const { selectionStart, selectionEnd, value } = textarea;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  let lineEnd = value.indexOf("\n", selectionEnd);
  if (lineEnd === -1) lineEnd = value.length;

  const block = value.slice(lineStart, lineEnd);
  const prefixed = block
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
  setValue(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(lineStart, lineStart + prefixed.length);
  });
}

export function MarkdownEditor({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const withTextarea = (fn: (el: HTMLTextAreaElement) => void) => {
    if (textareaRef.current) fn(textareaRef.current);
  };

  return (
    <div className="mt-1 overflow-hidden rounded-md border border-border-strong bg-surface">
      <div className="flex flex-wrap items-center gap-1 border-b border-border-strong bg-surface-2 px-2 py-1.5">
        <button type="button" onClick={() => setShowPreview(false)} className={tabButtonClass(!showPreview)}>
          Write
        </button>
        <button type="button" onClick={() => setShowPreview(true)} className={tabButtonClass(showPreview)}>
          Preview
        </button>
        {!showPreview && (
          <>
            <span className="mx-1 h-4 w-px bg-border-strong" />
            <button
              type="button"
              className={toolbarButtonClass()}
              onClick={() => withTextarea((el) => wrapSelection(el, "**", "**", "bold text", setValue))}
            >
              Bold
            </button>
            <button
              type="button"
              className={toolbarButtonClass()}
              onClick={() => withTextarea((el) => wrapSelection(el, "_", "_", "italic text", setValue))}
            >
              Italic
            </button>
            <span className="mx-1 h-4 w-px bg-border-strong" />
            <button
              type="button"
              className={toolbarButtonClass()}
              onClick={() => withTextarea((el) => prefixLines(el, "# ", setValue))}
            >
              H1
            </button>
            <button
              type="button"
              className={toolbarButtonClass()}
              onClick={() => withTextarea((el) => prefixLines(el, "## ", setValue))}
            >
              H2
            </button>
            <button
              type="button"
              className={toolbarButtonClass()}
              onClick={() => withTextarea((el) => prefixLines(el, "### ", setValue))}
            >
              H3
            </button>
            <span className="mx-1 h-4 w-px bg-border-strong" />
            <button
              type="button"
              className={toolbarButtonClass()}
              onClick={() => withTextarea((el) => prefixLines(el, "- ", setValue))}
            >
              Bullet list
            </button>
            <button
              type="button"
              className={toolbarButtonClass()}
              onClick={() => withTextarea((el) => prefixLines(el, "1. ", setValue))}
            >
              Numbered list
            </button>
            <button
              type="button"
              className={toolbarButtonClass()}
              onClick={() => withTextarea((el) => wrapSelection(el, "[", "](https://)", "link text", setValue))}
            >
              Link
            </button>
          </>
        )}
        <span className="ml-auto text-[11px] text-fg-subtle">Markdown supported</span>
      </div>
      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        className={`min-h-[160px] w-full resize-y bg-surface px-3 py-2 font-mono text-sm text-fg focus:outline-none ${
          showPreview ? "hidden" : ""
        }`}
      />
      {showPreview &&
        (value.trim() ? (
          <MarkdownContent markdown={value} className="min-h-[160px] px-3 py-2 text-sm" />
        ) : (
          <p className="min-h-[160px] px-3 py-2 text-sm italic text-fg-subtle">Nothing to preview yet.</p>
        ))}
    </div>
  );
}
