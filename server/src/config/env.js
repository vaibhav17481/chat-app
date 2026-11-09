import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const envPath = path.join(serverRoot, ".env");

// The .env file is resolved from the project folder and not from the current
// working directory, so the configuration is the same no matter where the npm
// script is started from. This module is imported first by server.js, before
// anything else reads process.env.
const { error } = dotenv.config({ path: envPath, quiet: true });

if (error) {
  console.warn(`[env] ${envPath} could not be read: ${error.message}`);
}

export const PORT = Number(process.env.PORT) || 5000;

export { envPath, serverRoot };
