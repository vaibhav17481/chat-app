# ChatApp

A real time chat application built with React, Express, Prisma, PostgreSQL and
Socket.IO.

- **client/** – React 19 + Vite + Tailwind CSS 4 single page application
- **server/** – Express 5 + Prisma 6 + Socket.IO backend with PostgreSQL

---

## Features

- Registration with email verification (6 digit one time code)
- Sign in with an access token and a rotating refresh token
- Real time messaging with delivery and read receipts
- Friend search, friend requests and an online user list
- Typing indicators and unread counters

---

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer
- A Gmail account with an app password (or any other SMTP server)

---

## Setup

### 1. Database

```bash
createdb chat_app
createdb chat_app_test   # used by the automated test suite
```

### 2. Server

```bash
cd server
npm install
cp .env.example .env    # then fill in the values below
npx prisma migrate deploy
npm run dev              # http://localhost:5000
```

`server/.env`:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Connection string of the development database |
| `PORT` | Port of the HTTP server, defaults to `5000` |
| `JWT_SECRET` | Secret used to sign the access tokens and the verification codes |
| `EMAIL_USER` | Sender address, a Gmail address by default |
| `EMAIL_APP_PASSWORD` | App password of the sender |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Optional, replaces Gmail with another SMTP server |
| `TEST_DATABASE_URL` | Database used by the test suite, never the development one |

### 3. Client

```bash
cd client
npm install
npm run dev              # http://localhost:5173
```

`client/.env` (optional, see `client/.env.example`):

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Base URL of the REST API, defaults to `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Base URL of the Socket.IO server, defaults to `http://localhost:5000` |

The backend allows the origin `http://localhost:5173` with credentials, so the
refresh cookie is accepted during development.

---

## Scripts

Both packages are installed separately, there is no workspace root.

| Command | Where | What it does |
| --- | --- | --- |
| `npm run dev` | `server` | Starts the API and the Socket.IO server with nodemon |
| `npm start` | `server` | Starts the server without the watcher |
| `npm run free-port` | `server` | Stops an old instance of the server that still holds the port |
| `npm test` | `server` / `client` | Runs the test suite once |
| `npm run test:watch` | `server` / `client` | Runs the test suite in watch mode |
| `npm run lint` | `server` / `client` | Runs oxlint |
| `npm run build` | `client` | Builds the production bundle into `client/dist` |

`npm run dev` and `npm start` free the port first, so a server that was left
running by a closed terminal cannot block the new one. The server also closes
the port when it is stopped, which keeps a restart free of `EADDRINUSE`.

---

## API

All routes are prefixed with `/api`. Protected routes need the header
`Authorization: Bearer <access token>`.

### Authentication

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Creates an account and mails a verification code |
| `POST` | `/api/auth/login` | Returns an access token and sets the refresh cookie |
| `POST` | `/api/auth/verify-email` | Verifies an account with the mailed code |
| `POST` | `/api/auth/resend-verification` | Mails a new code |
| `POST` | `/api/auth/refresh` | Exchanges the refresh cookie for a new access token |
| `POST` | `/api/auth/logout` | Revokes the refresh token and clears the cookie |

### Users, friends and messages

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/users/profile` | The signed in user |
| `GET` | `/api/users` | All other users |
| `GET` | `/api/users/search?username=` | Searches users by name |
| `GET` | `/api/users/:id` | A single user |
| `GET` | `/api/friends` | The friend list |
| `POST` | `/api/friends/request` | Sends a friend request |
| `GET` | `/api/friends/incoming` | The received friend requests |
| `GET` | `/api/friends/outgoing` | The sent friend requests |
| `POST` | `/api/friends/accept/:id` | Accepts a friend request |
| `DELETE` | `/api/friends/reject/:id` | Rejects a friend request |
| `GET` | `/api/messages/:friendId` | The conversation with a friend |
| `POST` | `/api/messages` | Sends a message |
| `PUT` | `/api/messages/:messageId` | Edits a message |
| `DELETE` | `/api/messages/:messageId` | Deletes a message |
| `GET` | `/api/messages/unread-counts` | The unread counters per conversation |

### Socket.IO events

The client authenticates the handshake with the access token
(`socket.handshake.auth.token`). The server takes the user id from the token,
so a client cannot act as somebody else.

| Event | Direction | Description |
| --- | --- | --- |
| `join` | client → server | Joins the room of the signed in user |
| `newMessage` | server → client | A new message arrived |
| `typing` | client → server | The user is typing |
| `userTyping` | server → client | A friend is typing |
| `messageStatus` | server → client | A message became delivered or read |
| `onlineUsers` | server → client | The list of users that are online |

---

## How the session works

```
login ──────────► access token (15 min, kept in memory by the client)
                └► refresh token (7 days, httpOnly cookie, path /api/auth)

request ─────────► Authorization: Bearer <access token>
401 ─────────────► POST /api/auth/refresh ──► new access token ──► retry
```

- The access token never touches `localStorage`, so an injected script cannot
  read it. It lives in the memory of the tab and disappears when the tab is
  closed.
- The refresh token is stored in an httpOnly cookie, so JavaScript cannot read
  it either. Only its SHA-256 hash is kept on the server.
- Every refresh rotates the token: the old one is revoked immediately, so a
  captured cookie is only usable once.
- `POST /api/auth/logout` revokes the refresh token on the server.

---

## Security notes

- **Verification codes** are generated with `crypto.randomInt`, stored as an
  HMAC-SHA256 hash together with the address and compared in constant time.
  The plain code is never stored and never sent in a response.
- **Codes expire** after 10 minutes, are limited to 5 wrong attempts and can be
  requested only once per 30 seconds. The limit is enforced on the server, the
  button in the interface is only a convenience.
- **The endpoints do not reveal which addresses are registered.** The resend
  endpoint answers the same way for every address, the verification endpoint
  answers an unknown address like a wrong code, and the login endpoint answers
  an unknown address like a wrong password.
- **Rate limits** protect the login, registration, verification and resend
  endpoints as well as the whole API.
- **Passwords** are hashed with bcrypt.
- **Sockets** are authenticated with the access token during the handshake.

---

## Tests

```bash
cd server && npm test    # 61 tests
cd client && npm test    # 36 tests
```

The server suite runs against `TEST_DATABASE_URL`, so it never touches the
development data. The mailer is replaced by a local SMTP server that captures
the messages, which lets the tests read the generated codes.
