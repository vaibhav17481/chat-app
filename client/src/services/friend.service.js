import api from "./api";

export const sendFriendRequest = async (receiverId) => {
  const response = await api.post("/friends/request", {
    receiverId,
  });

  return response.data;
};

export const getIncomingRequests = async () => {
  const response = await api.get("/friends/incoming");

  return response.data;
};

export const acceptRequest = async (requestId) => {
  const response = await api.post(
    `/friends/accept/${requestId}`
  );

  return response.data;
};

export const rejectRequest = async (requestId) => {
  const response = await api.delete(
    `/friends/reject/${requestId}`
  );

  return response.data;
};

export const getFriends = async () => {
  const response = await api.get("/friends");

  return response.data;
};