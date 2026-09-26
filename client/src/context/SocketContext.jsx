import { createContext, useCallback, useContext, useEffect, useState } from "react";
import socket from "../services/socket";
import { getUnreadCounts } from "../services/message.service";

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  const refreshUnreadCounts = useCallback(async () => {
    try {
      const counts = await getUnreadCounts();
      const map = counts.reduce((acc, item) => {
        acc[item.friendId] = item.count;
        return acc;
      }, {});

      setUnreadCounts(map);
    } catch (error) {
      console.log("Failed to load unread counts:", error);
    }
  }, []);

  // Tell the server the current user is reading a conversation, then refresh counts
  const notifySeen = useCallback(
    (friendId) => {
      socket.emit("markSeen", { friendId });
      refreshUnreadCounts();
    },
    [refreshUnreadCounts]
  );

  useEffect(() => {
    const handleOnlineUsers = (users) => {
      setOnlineUsers(users);
    };

    // Refresh unread counts whenever a new message arrives
    const handleNewMessage = () => {
      refreshUnreadCounts();
    };

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("newMessage", handleNewMessage);

    refreshUnreadCounts();

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("newMessage", handleNewMessage);
    };
  }, [refreshUnreadCounts]);

  return (
    <SocketContext.Provider
      value={{ onlineUsers, unreadCounts, refreshUnreadCounts, notifySeen }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
