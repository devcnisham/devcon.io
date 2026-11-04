"use client";
import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import type { DocumentContent } from "../types";

export function DocumentEditor({
  content,
  onChange,
  readOnly,
}: {
  content: DocumentContent;
  onChange: (value: DocumentContent) => void;
  readOnly: boolean;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ allowBase64: true, inline: true }),
    ],
    immediatelyRender: false,
    content: content.doc,
    editable: !readOnly,
    editorProps: {
      attributes: {
        "aria-label": "Document content",
        role: "textbox",
        "aria-multiline": "true",
        class: "file-rich-content",
      },
    },
    onUpdate: ({ editor: current }) =>
      onChangeRef.current({ kind: "document", doc: current.getJSON() }),
  });
  useEffect(() => {
    if (
      editor &&
      JSON.stringify(editor.getJSON()) !== JSON.stringify(content.doc)
    )
      editor.commands.setContent(content.doc, { emitUpdate: false });
  }, [content, editor]);
  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [readOnly, editor]);
  const imageInput = useRef<HTMLInputElement>(null);
  if (!editor) return <p className="file-muted">Opening editor…</p>;
  const addImage = async (file?: File) => {
    if (
      !file ||
      !/^image\/(png|jpeg|gif|webp)$/.test(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      window.alert("Choose a PNG, JPEG, GIF, or WebP image under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      editor
        .chain()
        .focus()
        .setImage({ src: String(reader.result), alt: file.name })
        .run();
    reader.readAsDataURL(file);
  };
  return (
    <div className="file-document-editor">
      <div
        className="file-toolbar"
        role="toolbar"
        aria-label="Document formatting"
      >
        <button
          disabled={readOnly}
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
          <span className="file-sr">Bold</span>
        </button>
        <button
          disabled={readOnly}
          aria-pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
          <span className="file-sr">Italic</span>
        </button>
        <button
          disabled={readOnly}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          H1
        </button>
        <button
          disabled={readOnly}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </button>
        <button
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
        <button
          disabled={readOnly}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>
        <button
          disabled={readOnly}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          Table
        </button>
        {editor.isActive("table") && (
          <>
            <button
              disabled={readOnly}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              + Row
            </button>
            <button
              disabled={readOnly}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              + Column
            </button>
            <button
              disabled={readOnly}
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              Remove table
            </button>
          </>
        )}
        <button disabled={readOnly} onClick={() => imageInput.current?.click()}>
          Image
        </button>
        <button
          disabled={readOnly || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          Undo
        </button>
        <button
          disabled={readOnly || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          Redo
        </button>
        <input
          ref={imageInput}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(e) => {
            void addImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <div className="file-paper">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
