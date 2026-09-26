import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import Avatar from "../common/Avatar";
import FriendsPanel from "../friends/FriendsPanel";
import SearchPanel from "../friends/SearchPanel";
import FriendRequestPanel from "../friends/FriendRequestPanel";

const TABS = [
  { key: "chats", label: "Chats" },
  { key: "requests", label: "Requests" },
  { key: "find", label: "Find" },
];

function Sidebar({ activeId, className = "" }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [tab, setTab] = useState("chats");
  const [requestCount, setRequestCount] = useState(0);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div
      className={`flex h-full w-full flex-col border-border bg-surface lg:w-[360px] lg:shrink-0 lg:border-r ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            C
          </div>
          <h1 className="font-display text-lg font-bold tracking-tight text-ink">
            ChatApp
          </h1>
        </div>

        <button
          onClick={() => navigate("/profile")}
          className="rounded-full transition hover:opacity-80"
          title="View profile"
        >
          <Avatar name={user?.username} size="sm" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-surface-raised hover:text-ink"
            }`}
          >
            {t.label}
            {t.key === "requests" && requestCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-2 px-1 text-[10px] font-bold text-white">
                {requestCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panel content — all tabs stay mounted so badges/data are ready before switching */}
      <div className="flex-1 overflow-y-auto">
        <div className={tab === "chats" ? "" : "hidden"}>
          <FriendsPanel activeId={activeId} />
        </div>
        <div className={tab === "find" ? "" : "hidden"}>
          <SearchPanel />
        </div>
        <div className={tab === "requests" ? "" : "hidden"}>
          <FriendRequestPanel onRequestsChange={setRequestCount} />
        </div>
      </div>

      {/* Footer / current user */}
      <div className="flex items-center gap-3 border-t border-border px-4 py-3">
        <Avatar name={user?.username} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {user?.username}
          </p>
          <p className="truncate text-xs text-online">Active now</p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
