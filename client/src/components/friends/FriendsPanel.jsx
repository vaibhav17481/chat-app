import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getFriends } from "../../services/friend.service";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import Avatar from "../common/Avatar";
import { SidebarRowSkeleton } from "../common/Skeleton";

function FriendsPanel({ activeId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { onlineUsers, unreadCounts } = useSocket();

  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const data = await getFriends();
      setFriends(data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <SidebarRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="mx-3 mt-4 rounded-2xl border border-dashed border-border p-6 text-center">
        <div className="mb-2 text-2xl">👋</div>
        <p className="text-sm font-medium text-ink">No conversations yet</p>
        <p className="mt-1 text-xs text-muted">
          Find people in the search tab to start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 py-1">
      {friends.map((friend) => {
        const friendUser =
          friend.user1.id === user.id ? friend.user2 : friend.user1;
        const isOnline = onlineUsers.includes(friendUser.id);
        const isActive = String(activeId) === String(friendUser.id);
        const unreadCount = unreadCounts[friendUser.id] || 0;

        return (
          <button
            key={friend.id}
            onClick={() => navigate(`/chat/${friendUser.id}`)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
              isActive
                ? "bg-accent/10 ring-1 ring-accent/40"
                : "hover:bg-surface-raised"
            }`}
          >
            <Avatar name={friendUser.username} online={isOnline} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {friendUser.username}
              </p>
              <p
                className={`truncate text-xs ${
                  isOnline ? "text-online" : "text-muted"
                }`}
              >
                {isOnline ? "Active now" : "Offline"}
              </p>
            </div>

            {unreadCount > 0 && !isActive && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FriendsPanel;
