import { useEffect, useRef, useState } from "react";

import EmojiPicker from "./EmojiPicker";

function ReplyPreview({ replyTo, onCancel }) {
  if (!replyTo) return null;

  const author =
    replyTo.sender?.displayName || replyTo.sender?.username || "this message";

  const preview = replyTo.deleted
    ? "This message was deleted"
    : replyTo.content;

  return (
    <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl border-l-2 border-accent bg-surface-raised px-3 py-2 sm:mx-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-accent">
          Replying to {author}
        </p>

        <p className="truncate text-xs text-muted">
          {preview}
        </p>
      </div>

      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="rounded-md p-1 text-muted transition hover:bg-surface hover:text-ink"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function MessageInput({ onSend, onTyping, replyTo, onCancelReply }) {
  const [content, setContent] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);

  // Replying puts the cursor straight into the input
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    onSend(content, replyTo?.id ?? null);
    setContent("");
    onCancelReply?.();
  };

  // The emoji is inserted at the caret so the text around it stays untouched.
  const insertEmoji = (emoji) => {
    const field = textareaRef.current;
    const start = field?.selectionStart ?? content.length;
    const end = field?.selectionEnd ?? content.length;

    const next = content.slice(0, start) + emoji + content.slice(end);

    setContent(next);
    setShowEmoji(false);

    requestAnimationFrame(() => {
      field?.focus();

      const caret = start + emoji.length;

      field?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="relative border-t border-border bg-surface">
      <ReplyPreview replyTo={replyTo} onCancel={onCancelReply} />

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-3 py-3 sm:px-4"
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((prev) => !prev)}
            aria-label="Open emoji picker"
            aria-expanded={showEmoji}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
              showEmoji
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-surface-raised hover:text-ink"
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <path d="M9 9h.01" />
              <path d="M15 9h.01" />
            </svg>
          </button>

          {showEmoji && (
            <div className="absolute bottom-full left-0 z-30 mb-2">
              <EmojiPicker
                title="Insert emoji"
                onSelect={insertEmoji}
                onClose={() => setShowEmoji(false)}
              />
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onTyping?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          rows={1}
          placeholder={
            replyTo ? "Write a reply..." : "Type a message..."
          }
          aria-label="Message"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface-raised px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
        />

        <button
          type="submit"
          disabled={!content.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
