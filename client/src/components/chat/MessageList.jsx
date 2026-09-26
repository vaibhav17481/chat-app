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
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  let lastDay = null;

  return (
    <div className="flex-1 space-y-1 overflow-y-auto px-4 py-5 sm:px-6">
      {messages.map((message) => {
        const label = dayLabel(message.createdAt);
        const showDivider = label !== lastDay;
        lastDay = label;

        return (
          <div key={message.id}>
            {showDivider && (
              <div className="my-4 flex items-center justify-center">
                <span className="rounded-full bg-surface-raised px-3 py-1 text-[11px] font-medium text-muted">
                  {label}
                </span>
              </div>
            )}
            <div className="py-0.5">
              <MessageBubble
                message={message}
                isMine={message.senderId === currentUserId}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
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
