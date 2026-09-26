import { useEffect, useState } from "react";

import {
  getIncomingRequests,
  acceptRequest,
  rejectRequest,
} from "../../services/friend.service";
import Avatar from "../common/Avatar";
import { SidebarRowSkeleton } from "../common/Skeleton";

function FriendRequestPanel({ onRequestsChange }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await getIncomingRequests();
      setRequests(data);
      onRequestsChange?.(data.length);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    setBusyId(requestId);
    try {
      await acceptRequest(requestId);
      await loadRequests();
    } catch (error) {
      console.log(error);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (requestId) => {
    setBusyId(requestId);
    try {
      await rejectRequest(requestId);
      await loadRequests();
    } catch (error) {
      console.log(error);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <SidebarRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="mx-3 mt-4 rounded-2xl border border-dashed border-border p-6 text-center">
        <div className="mb-2 text-2xl">🔔</div>
        <p className="text-sm font-medium text-ink">All caught up</p>
        <p className="mt-1 text-xs text-muted">No pending friend requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-2 py-2">
      {requests.map((request) => {
        const busy = busyId === request.id;

        return (
          <div
            key={request.id}
            className="animate-fade-in-up rounded-xl bg-surface-raised p-3"
          >
            <div className="flex items-center gap-3">
              <Avatar name={request.sender.username} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {request.sender.username}
                </p>
                <p className="truncate text-xs text-muted">
                  {request.sender.email}
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleAccept(request.id)}
                disabled={busy}
                className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleReject(request.id)}
                disabled={busy}
                className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold text-muted transition hover:bg-surface disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default FriendRequestPanel;
