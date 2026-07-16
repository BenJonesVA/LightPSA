"use client";

import { useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Bridges an uncontrolled Tiptap editor into a plain Server Action form POST:
// the editor's HTML is mirrored into a hidden input on every update, so the
// surrounding <form action={...}> submits it like any other form field. The
// server action is the sanitization boundary (see lib/sanitize-html.ts) — a
// raw POST bypassing this component entirely is still sanitized there.

function toolbarButtonClass(active: boolean) {
  return `rounded px-2 py-1 text-xs font-semibold transition-colors ${
    active ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-2"
  }`;
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border-strong bg-surface-2 px-2 py-1.5">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={toolbarButtonClass(editor.isActive("bold"))}
      >
        Bold
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={toolbarButtonClass(editor.isActive("italic"))}
      >
        Italic
      </button>
      <span className="mx-1 h-4 w-px bg-border-strong" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={toolbarButtonClass(editor.isActive("heading", { level: 1 }))}
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={toolbarButtonClass(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={toolbarButtonClass(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>
      <span className="mx-1 h-4 w-px bg-border-strong" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={toolbarButtonClass(editor.isActive("bulletList"))}
      >
        Bullet list
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={toolbarButtonClass(editor.isActive("orderedList"))}
      >
        Numbered list
      </button>
    </div>
  );
}

export function RichTextEditor({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [html, setHtml] = useState(defaultValue);

  const editor = useEditor({
    extensions: [StarterKit],
    content: defaultValue,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Empty Tiptap docs serialize to "<p></p>", not "". Normalize back to
      // "" so required-field checks and empty-string handling in the server
      // actions behave the same as they did for a plain <textarea>.
      setHtml(editor.isEmpty ? "" : editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[160px] px-3 py-2 text-sm text-fg focus:outline-none",
      },
    },
  });

  return (
    <div className="mt-1 overflow-hidden rounded-md border border-border-strong bg-surface">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
