# ChatApp client

The React front end of ChatApp. See the [README in the repository root](../README.md)
for the setup of the whole project, the environment variables and the API.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite development server on http://localhost:5173 |
| `npm run build` | Builds the production bundle into `dist` |
| `npm run preview` | Serves the built bundle |
| `npm run lint` | Runs oxlint |
| `npm test` | Runs the test suite once |
| `npm run test:watch` | Runs the test suite in watch mode |

## Environment

Copy `.env.example` to `.env` to point the client at another backend:

| Variable | Default |
| --- | --- |
| `VITE_API_URL` | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | `http://localhost:5000` |

## Structure

```
src/
  components/
    auth/     Shell, field and alert for the authentication pages
    chat/     Conversation window and its parts
    common/   Avatar, skeleton and the route guard
    friends/  Friend list, search and friend requests
    layout/   Sidebar and the app shell
  context/    Authentication and socket state
  hooks/      Shared hooks, e.g. the verification code countdown
  pages/      Login, register, verify, home, chat and profile
  routes/     The route table
  services/   Axios instance, socket client and the API calls
```
