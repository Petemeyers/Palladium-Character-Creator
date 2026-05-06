# Backend Startup Guide

## Understanding the Connection Refused Errors

Errors like these indicate the backend server is not running:

- `net::ERR_CONNECTION_REFUSED` on `localhost:5000`
- `Network error: Network error - no response from server`
- `Error fetching active party`, `Error fetching characters`, `Error fetching parties`

## What's Happening

1. The React app (frontend) makes API calls to `/api/v1/parties/active`, `/api/v1/characters`, and `/api/v1/parties`
2. These requests go to `localhost:5000` (via Vite proxy configuration)
3. Nothing is listening on port 5000, so the connection is refused

## Solution: Start the Backend Server

The backend must be running for the app to work. Use one of these options:

| Command | Description |
|---------|-------------|
| `npm run server` | Runs the backend on port 5000 with nodemon (auto-restart on changes) |
| `npm run start` | Runs the backend on port 5000 directly |
| `npm run electron:dev` | Runs frontend + backend + Electron together |

## Typical Workflow

**Option 1: Two terminals**
1. Terminal 1 – Backend: `npm run server`
2. Terminal 2 – Frontend: `npm run dev`

**Option 2: Electron (all-in-one)**
- Run: `npm run electron:dev` – starts frontend, backend, and Electron together

## Additional Notes

- Ensure MongoDB is running if the backend depends on it
- The backend listens on port 5000 by default (or the value in `process.env.PORT`)
