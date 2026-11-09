import { io } from "socket.io-client";

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const socket = io(SOCKET_URL, {
  autoConnect: false,
});

/**
 * The server authenticates the handshake with the access token, so the token
 * has to be set before the socket connects.
 */
export const setSocketToken = (token) => {
  socket.auth = { token: token ?? null };
};

export default socket;
