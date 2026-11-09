import { useState, useEffect, useRef } from "react";

import EmojiPicker from "./EmojiPicker";
import { groupReactions } from "../../utils/reactions";

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

/** Small preview of the message a reply points to. */
function ReplyPreview({ replyTo, onJump }) {
  if (!replyTo) return null;

  const author =
    replyTo.sender?.displayName || replyTo.sender?.username || "Unknown";

  const preview = replyTo.deleted
    ? "This message was deleted"
    : replyTo.content;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump?.(replyTo.id);
      }}
      className="mb-1 flex max-w-full items-center gap-2 rounded-lg border-l-2 border-accent bg-surface-raised/70 px-2 py-1 text-left transition hover:bg-surface-raised"
      aria-label={`Jump to the message of ${author}`}
    >
      <span className="truncate text-[11px] font-semibold text-accent">
        {author}
      </span>

      <span className="truncate text-[11px] text-muted">
        {preview}
      </span>
    </button>
  );
}

/** The reactions below a message, one bubble per emoji. */
function ReactionBar({ reactions, onReact }) {
  if (!reactions.length) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReact?.(reaction.emoji);
          }}
          aria-label={`${reaction.emoji} reaction, ${reaction.count}`}
          aria-pressed={reaction.mine}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition ${
            reaction.mine
              ? "border-accent bg-accent/15 text-ink"
              : "border-border bg-surface-raised text-muted hover:text-ink"
          }`}
        >
          <span>{reaction.emoji}</span>

          <span className="tabular-nums">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  currentUserId,
  onEdit,
  onDelete,
  onReply,
  onReact,
  onJumpToReply,
  isHighlighted,
  replyTo: replyToProp,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const wrapperRef = useRef(null);

  const reactions = groupReactions(message.reactions, currentUserId);
  const replyTo = replyToProp ?? message.replyTo;

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

  const handleReact = async (emoji) => {
    setShowEmoji(false);
    setShowActions(false);

    await onReact?.(message.id, emoji);
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
          <>
            <ReplyPreview replyTo={replyTo} onJump={onJumpToReply} />

            <div ref={wrapperRef} className="relative">
              <div
                onClick={() =>
                  !message.deleted && setShowActions((prev) => !prev)
                }
                className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition ${
                  isMine
                    ? "rounded-br-sm bg-accent text-white"
                    : "rounded-bl-sm bg-surface-raised text-ink"
                } ${!message.deleted ? "cursor-pointer" : ""} ${
                  isHighlighted
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                    : ""
                }`}
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

              {!message.deleted && showActions && (
                <div
                  className={`absolute -top-8 z-10 flex items-center gap-1 rounded-lg border border-border bg-surface-raised p-1 shadow-lg ${
                    isMine ? "right-0" : "left-0"
                  }`}
                >
                  <button
                    type="button"
                    title="Reply"
                    aria-label="Reply to this message"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActions(false);
                      onReply?.(message);
                    }}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink"
                  >
                    Reply
                  </button>

                  <button
                    type="button"
                    title="React"
                    aria-label="React to this message"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmoji((prev) => !prev);
                    }}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink"
                  >
                    React
                  </button>

                  {isMine && (
                    <button
                      type="button"
                      title="Edit"
                      aria-label="Edit this message"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditContent(message.content);
                        setIsEditing(true);
                        setShowActions(false);
                      }}
                      className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink"
                    >
                      Edit
                    </button>
                  )}

                  {isMine && (
                    <button
                      type="button"
                      title="Delete"
                      aria-label="Delete this message"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                      }}
                      className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}

              {!message.deleted && showEmoji && (
                <div
                  className={`absolute bottom-full z-30 mb-[4.5rem] ${
                    isMine ? "right-0" : "left-0"
                  }`}
                >
                  <EmojiPicker
                    title="React with an emoji"
                    compact
                    onSelect={handleReact}
                    onClose={() => setShowEmoji(false)}
                  />
                </div>
              )}
            </div>

            {!message.deleted && (
              <ReactionBar
                reactions={reactions}
                onReact={(emoji) => onReact?.(message.id, emoji)}
              />
            )}
          </>
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
