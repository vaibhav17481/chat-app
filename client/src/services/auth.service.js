import api from "./api";

export const loginUser = async (data) => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

export const registerUser = async (data) => {
  const response = await api.post("/auth/register", data);
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get("/users/profile");
  return response.data;
};

export const verifyEmail = async (data) => {
  const response = await api.post("/auth/verify-email", data);
  return response.data;
};

export const resendVerificationCode = async (data) => {
  const response = await api.post("/auth/resend-verification", data);
  return response.data;
};

/** Renews the session with the refresh cookie and returns the new access token. */
export const refreshSession = async () => {
  const response = await api.post("/auth/refresh");
  return response.data;
};

/** Revokes the refresh token on the server. */
export const logoutUser = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};
