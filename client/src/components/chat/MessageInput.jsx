import { useState } from "react";

function MessageInput({ onSend, onTyping }) {
  const [content, setContent] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    onSend(content);
    setContent("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-border bg-surface px-3 py-3 sm:px-4"
    >
      <textarea
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
        placeholder="Type a message..."
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
  );
}

export default MessageInput;
