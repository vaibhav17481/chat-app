import { createContext, useContext, useEffect, useState } from "react";
import api, {
  getAccessToken,
  setAccessToken,
  setSessionExpiredHandler,
  setTokenChangeHandler,
} from "../services/api";
import socket, { setSocketToken } from "../services/socket";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // The access token is only kept in memory, so a page reload has to renew
    // the session with the httpOnly refresh cookie.
    const restoreSession = async () => {
      try {
        const response = await api.post("/auth/refresh");

        if (cancelled) {
          return;
        }

        setAccessToken(response.data.token);
        setUser(response.data.user);
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, []);

  // A request that could not be renewed ends the session.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      socket.disconnect();
      setAccessToken(null);
      setUser(null);
    });

    // A renewed token is handed to the socket, so a reconnect is accepted.
    setTokenChangeHandler((token) => setSocketToken(token));

    return () => {
      setSessionExpiredHandler(null);
      setTokenChangeHandler(null);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // The handshake carries the access token, so it has to be set before the
    // socket connects.
    setSocketToken(getAccessToken());

    const handleConnect = () => {
      socket.emit("join", user.id);
    };

    socket.on("connect", handleConnect);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [user]);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // The session is ended locally even when the request fails.
    }

    socket.disconnect();
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
