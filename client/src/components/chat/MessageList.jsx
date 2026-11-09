import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

function dayLabel(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function MessageList({
  messages,
  currentUserId,
  isTyping,
  friend,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onReactMessage,
  onJumpToReply,
  highlightedId,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  // Bring the message a reply points to into view
  useEffect(() => {
    if (!highlightedId) return;

    const target = document.getElementById(`message-${highlightedId}`);

    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId]);

  let lastDay = null;

  // The reply preview always shows the current state of the original message,
  // so deleting that message is reflected right away.
  const messagesById = new Map(messages.map((message) => [message.id, message]));

  return (
    <div className="flex-1 space-y-1 overflow-y-auto px-4 py-5 sm:px-6">
      {messages.map((message) => {
        const label = dayLabel(message.createdAt);
        const showDivider = label !== lastDay;
        lastDay = label;

        const replyTo = message.replyToId
          ? (messagesById.get(message.replyToId) ?? message.replyTo)
          : null;

        return (
          <div key={message.id}>
            {showDivider && (
              <div className="my-4 flex items-center justify-center">
                <span className="rounded-full bg-surface-raised px-3 py-1 text-[11px] font-medium text-muted">
                  {label}
                </span>
              </div>
            )}
            <div className="py-0.5" id={`message-${message.id}`}>
              <MessageBubble
                message={message}
                replyTo={replyTo}
                isMine={message.senderId === currentUserId}
                currentUserId={currentUserId}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onReply={onReplyMessage}
                onReact={onReactMessage}
                onJumpToReply={onJumpToReply}
                isHighlighted={message.id === highlightedId}
              />
            </div>
          </div>
        );
      })}

      {isTyping && <TypingIndicator name={friend?.username} />}

      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
