import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    const loadUser = async () => {
      try {
        const response = await api.get("/users/profile");

        setUser(response.data);

        socket.connect();
      } catch (error) {
        console.log("Failed to restore user:", error);

        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const handleConnect = () => {
      console.log("Socket connected:", socket.id);

      socket.emit("join", user.id);

      console.log("Joined socket as user:", user.id);
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on("connect", handleConnect);
    }

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [user]);

  const logout = () => {
    socket.disconnect();

    localStorage.removeItem("token");
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