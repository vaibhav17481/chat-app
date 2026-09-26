import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
  getConversation,
  sendMessage,
  editMessage,
  deleteMessage,
} from "../services/message.service";

import { getUserById } from "../services/user.service";

import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import socket from "../services/socket";

import AppShell from "../components/layout/AppShell";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";
import ChatEmptyState from "../components/chat/ChatEmptyState";

function Chat() {
  const { id } = useParams();
  const { user } = useAuth();
  const { onlineUsers, notifySeen } = useSocket();

  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  // Load conversation + friend profile whenever the chat changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setFriend(null);

      try {
        const [friendData, messageData] = await Promise.all([
          getUserById(id),
          getConversation(id),
        ]);

        if (cancelled) return;
        setFriend(friendData);
        setMessages(messageData);

        // Opening a conversation marks all of its messages as seen
        notifySeen(Number(id));
      } catch (err) {
        console.log(err);
        if (!cancelled) {
          setError(
            err.response?.data?.message || "Couldn't load this conversation.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id, notifySeen]);

  // Real-time incoming messages
  useEffect(() => {
    const handleNewMessage = (message) => {
      const belongsToThisChat =
        (message.senderId === user.id && message.receiverId === Number(id)) ||
        (message.senderId === Number(id) && message.receiverId === user.id);

      if (!belongsToThisChat) return;

      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );

      // The user is looking at this chat, so the message is read immediately
      notifySeen(message.senderId);
    };

    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [id, user, notifySeen]);

  // Live delivered/read status updates for messages I sent
  useEffect(() => {
    const handleMessageStatus = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status } : m)),
      );
    };

    socket.on("messageStatus", handleMessageStatus);
    return () => socket.off("messageStatus", handleMessageStatus);
  }, []);

  // Typing indicator
  useEffect(() => {
    let typingTimer;

    const handleUserTyping = ({ senderId } = {}) => {
      // Only show the indicator when the person typing is this chat's friend
      if (senderId !== Number(id)) return;

      setIsTyping(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => setIsTyping(false), 2000);
    };

    socket.on("userTyping", handleUserTyping);

    return () => {
      clearTimeout(typingTimer);
      socket.off("userTyping", handleUserTyping);
    };
  }, [id]);

  const handleSend = async (content) => {
    try {
      const response = await sendMessage(Number(id), content);

      setMessages((prev) =>
        prev.some((m) => m.id === response.data.id)
          ? prev
          : [...prev, response.data],
      );
    } catch (err) {
      console.log(err);
      setError(err.response?.data?.message || "Failed to send message");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleTyping = () => {
    socket.emit("typing", { receiverId: Number(id) });
  };
  // Real-time edited messages
  useEffect(() => {
    const handleMessageEdited = (updatedMessage) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === updatedMessage.id ? updatedMessage : message,
        ),
      );
    };

    socket.on("messageEdited", handleMessageEdited);

    return () => {
      socket.off("messageEdited", handleMessageEdited);
    };
  }, []);

  // Real-time deleted messages
  useEffect(() => {
    const handleMessageDeleted = (updatedMessage) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === updatedMessage.id ? updatedMessage : message,
        ),
      );
    };

    socket.on("messageDeleted", handleMessageDeleted);

    return () => {
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, []);

  const handleEditMessage = async (messageId, content) => {
    try {
      const response = await editMessage(messageId, content);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? response.data : message,
        ),
      );
    } catch (err) {
      console.log(err);

      setError(err.response?.data?.message || "Failed to edit message");

      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await deleteMessage(messageId);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? response.data : message,
        ),
      );
    } catch (err) {
      console.log(err);

      setError(err.response?.data?.message || "Failed to delete message");

      setTimeout(() => setError(null), 3000);
    }
  };



  return (
    <AppShell activeId={id} mobileView="detail">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <ChatHeader friend={friend} online={onlineUsers.includes(Number(id))} />

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : error && !friend ? (
          <ChatEmptyState
            icon="⚠️"
            title="Something went wrong"
            description={error}
          />
        ) : (
          <>
            <MessageList
              messages={messages}
              currentUserId={user.id}
              isTyping={isTyping}
              friend={friend}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
            />

            {messages.length === 0 && (
              <div className="px-6 pb-2 text-center text-xs text-muted">
                No messages yet — say hello to {friend?.username} 👋
              </div>
            )}

            {error && (
              <div className="mx-4 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
                {error}
              </div>
            )}

            <MessageInput onSend={handleSend} onTyping={handleTyping} />
          </>
        )}
      </div>
    </AppShell>
  );
}

export default Chat;
