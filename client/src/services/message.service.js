import api from "./api";

export const getConversation = async (friendId) => {
  const response = await api.get(`/messages/${friendId}`);

  return response.data;
};

export const sendMessage = async (receiverId, content) => {
  const response = await api.post("/messages", {
    receiverId,
    content,
  });

  return response.data;
};

export const getUnreadCounts = async () => {
  const response = await api.get("/messages/unread-counts");

  return response.data;
};
export const editMessage = async (messageId, content) => {
  const response = await api.put(`/messages/${messageId}`, {
    content,
  });

  return response.data;
};

export const deleteMessage = async (messageId) => {
  const response = await api.delete(`/messages/${messageId}`);

  return response.data;
};