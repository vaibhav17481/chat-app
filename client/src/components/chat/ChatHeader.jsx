import { useNavigate } from "react-router-dom";
import Avatar from "../common/Avatar";

function ChatHeader({ friend, online }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
      <button
        onClick={() => navigate("/home")}
        className="rounded-lg p-1.5 text-muted transition hover:bg-surface-raised hover:text-ink lg:hidden"
        aria-label="Back to chats"
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
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {friend ? (
        <>
          <Avatar name={friend.username} online={online} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {friend.displayName || friend.username}
            </p>
            <p
              className={`text-xs ${online ? "text-online" : "text-muted"}`}
            >
              {online ? "Active now" : "Offline"}
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-full bg-surface-raised" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-surface-raised" />
            <div className="h-2.5 w-14 animate-pulse rounded bg-surface-raised" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatHeader;
