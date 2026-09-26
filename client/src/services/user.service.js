import api from "./api";

export const getUserById = async (id) => {
  const response = await api.get(`/users/${id}`);
  return response.data;
};

export const searchUsers = async (username) => {
  const response = await api.get("/users/search", {
    params: {
      username,
    },
  });

  return response.data;
};