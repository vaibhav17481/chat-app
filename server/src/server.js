import http from "http";

import { PORT } from "./config/env.js";
import app from "./app.js";
import prisma from "./lib/prisma.js";
import { initSocket } from "./sockets/socket.js";
import { pruneRefreshTokens } from "./services/token.service.js";

const server = http.createServer(app);

const io = initSocket(server);

// Refresh tokens that are expired or revoked long ago are removed once an
// hour so the table cannot grow forever.
const pruneInterval = setInterval(() => {
  pruneRefreshTokens().catch((error) => {
    console.error("Failed to prune refresh tokens:", error?.message);
  });
}, 60 * 60 * 1000);

pruneInterval.unref();

// A leftover instance of the server (for example a closed terminal that did
// not stop the watcher) keeps the port busy, so the start is retried for a
// moment before the error explains what to do.
const MAX_LISTEN_ATTEMPTS = 5;

let listenAttempts = 0;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && listenAttempts < MAX_LISTEN_ATTEMPTS) {
    listenAttempts += 1;

    // A restarting instance can still hold the port for a moment.
    console.warn(
      `Port ${PORT} is busy, retrying in 500ms (attempt ${listenAttempts} of ${MAX_LISTEN_ATTEMPTS}).`
    );

    setTimeout(() => server.listen(PORT), 500);
    return;
  }

  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use, another instance of the server is still running.\n` +
        `Stop it with "npm run dev" (it frees the port first) or "npm run free-port", then start the server again.`
    );
    process.exit(1);
  }

  console.error("Server error:", error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

let shuttingDown = false;

// Closing the server on SIGINT/SIGTERM releases the port, so a restart or a
// closed terminal never leaves a zombie process behind.
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}, shutting down.`);

  clearInterval(pruneInterval);

  const forceExit = setTimeout(() => process.exit(0), 3000);
  forceExit.unref();

  io.close(() => {
    prisma.$disconnect().finally(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  });

  // Open keep alive connections would keep the server from closing.
  server.closeAllConnections?.();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));
