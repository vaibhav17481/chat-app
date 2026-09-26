import { useState } from "react";

import { searchUsers } from "../../services/user.service";
import { sendFriendRequest } from "../../services/friend.service";
import Avatar from "../common/Avatar";

function SearchPanel() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentIds, setSentIds] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2500);
  };

  const handleSearch = async () => {
    if (!search.trim()) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);

      const data = await searchUsers(search);
      setUsers(data);
    } catch (error) {
      console.log(error);
      showToast(
        error.response?.data?.message || "Failed to search users",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (receiverId) => {
    try {
      const response = await sendFriendRequest(receiverId);
      setSentIds((prev) => [...prev, receiverId]);
      showToast(response.message || "Request sent");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to send friend request",
        "error"
      );
    }
  };

  return (
    <div className="px-3 py-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
        />

        <button
          onClick={handleSearch}
          className="shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Search
        </button>
      </div>

      {toast && (
        <div
          className={`mt-3 animate-fade-in-up rounded-lg px-3 py-2 text-xs font-medium ${
            toast.tone === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-online/10 text-online"
          }`}
        >
          {toast.message}
        </div>
      )}

      {loading && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-raised" />
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {users.map((item) => {
          const alreadySent = sentIds.includes(item.id);

          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-raised"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={item.username} size="sm" />

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {item.username}
                  </p>
                  <p className="truncate text-xs text-muted">{item.email}</p>
                </div>
              </div>

              <button
                onClick={() => handleSendRequest(item.id)}
                disabled={alreadySent}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted bg-accent/15 text-accent hover:bg-accent/25"
              >
                {alreadySent ? "Sent" : "+ Add"}
              </button>
            </div>
          );
        })}
      </div>

      {!loading && search && users.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          No one matches "{search}".
        </p>
      )}

      {!search && (
        <p className="mt-8 text-center text-sm text-muted">
          Search for a username to add new friends.
        </p>
      )}
    </div>
  );
}

export default SearchPanel;
