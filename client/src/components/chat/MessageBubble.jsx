import { useState, useEffect, useRef } from "react";

function formatTime(dateStr) {
  const date = new Date(dateStr);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusTicks({ status }) {
  if (status === "READ") {
    return <span className="font-semibold text-accent">✓✓</span>;
  }

  if (status === "DELIVERED") {
    return <span className="font-semibold">✓✓</span>;
  }

  return <span>✓</span>;
}

function MessageBubble({ message, isMine, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!showActions) return;

    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowActions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActions]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    const trimmedContent = editContent.trim();

    if (!trimmedContent) return;

    if (trimmedContent === message.content) {
      setIsEditing(false);
      return;
    }

    await onEdit(message.id, trimmedContent);

    setIsEditing(false);
  };

  const handleDelete = async () => {
    setShowActions(false);
    const confirmed = window.confirm(
      "Are you sure you want to delete this message?",
    );

    if (!confirmed) return;

    await onDelete(message.id);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  return (
    <div
      className={`flex animate-fade-in-up ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`group flex max-w-[75%] flex-col gap-1 sm:max-w-[65%] ${
          isMine ? "items-end" : "items-start"
        }`}
      >
        {isEditing ? (
          <form
            onSubmit={handleEditSubmit}
            className="flex min-w-[220px] flex-col gap-2 rounded-2xl bg-surface-raised p-2"
          >
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-surface"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!editContent.trim()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <div ref={wrapperRef} className={`relative ${isMine ? "group" : ""}`}>
            <div
              onClick={() => isMine && !message.deleted && setShowActions((prev) => !prev)}
              className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isMine
                  ? "rounded-br-sm bg-accent text-white"
                  : "rounded-bl-sm bg-surface-raised text-ink"
              } ${isMine && !message.deleted ? "cursor-pointer" : ""}`}
            >
              {message.deleted ? (
                <span className="italic opacity-60">This message was deleted</span>
              ) : (
                message.content
              )}

              {!message.deleted && message.edited && (
                <span className="ml-2 text-[10px] opacity-70">edited</span>
              )}
            </div>

            {isMine && !message.deleted && showActions && (
              <div className="absolute -top-8 right-0 flex items-center gap-1 rounded-lg border border-border bg-surface-raised p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(message.content);
                    setIsEditing(true);
                    setShowActions(false);
                  }}
                  className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}

        <span className="flex items-center gap-1 px-1 text-[11px] text-muted opacity-0 transition group-hover:opacity-100">
          {formatTime(message.createdAt)}

          {isMine && <StatusTicks status={message.status} />}
        </span>
      </div>
    </div>
  );
}

export default MessageBubble;
