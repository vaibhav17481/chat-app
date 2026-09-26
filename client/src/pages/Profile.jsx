import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import Avatar from "../components/common/Avatar";

function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex h-screen items-center justify-center bg-bg px-4 text-ink">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <button
          onClick={() => navigate("/home")}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to chats
        </button>

        <div className="flex flex-col items-center text-center">
          <Avatar name={user?.username} size="xl" />

          <h1 className="mt-4 font-display text-xl font-bold">
            {user?.displayName || user?.username}
          </h1>
          <p className="mt-1 text-sm text-muted">@{user?.username}</p>

          <div className="mt-6 w-full space-y-3 text-left">
            <div className="rounded-xl bg-surface-raised px-4 py-3">
              <p className="text-xs text-muted">Email</p>
              <p className="mt-0.5 truncate text-sm font-medium">
                {user?.email}
              </p>
            </div>

            {user?.bio && (
              <div className="rounded-xl bg-surface-raised px-4 py-3">
                <p className="text-xs text-muted">Bio</p>
                <p className="mt-0.5 text-sm font-medium">{user.bio}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;
