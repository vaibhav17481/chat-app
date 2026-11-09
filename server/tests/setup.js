import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));

// Load the real environment first (JWT secret, mail credentials, ...) and then
// point the database at the dedicated test database so a test run can never
// touch development data.
dotenv.config({ path: path.resolve(here, "../.env") });

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres123@localhost:5432/chat_app_test?schema=public";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.NODE_ENV = "test";
