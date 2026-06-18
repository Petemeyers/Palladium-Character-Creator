# Local PC Game Server

Use this mode when testing the Medieval Combat Simulator Unity VR client from a Quest or another device on your LAN.

## 1. Start Local MongoDB

Install MongoDB Community Server if it is not installed yet.

On Windows, start the MongoDB service from Services, or run:

```powershell
net start MongoDB
```

The local backend expects:

```text
mongodb://127.0.0.1:27017/medieval_combat_simulator_local
```

## 2. Create Local Env

Create `.env.local` from `.env.local.example` and keep credentials out of it:

```text
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/medieval_combat_simulator_local
CLIENT_ORIGIN=http://localhost:5173
```

## 3. Start Backend

From the repo root:

```powershell
npm run dev:local
```

Expected startup logs include:

```text
Backend running on port 5000
API base path /api/v1
Database mode: local
```

Health check:

```text
http://localhost:5000/api/v1/health
```

## 4. Find Your PC LAN IP

In PowerShell:

```powershell
ipconfig
```

Look for the IPv4 address on your active Wi-Fi or Ethernet adapter, for example:

```text
10.0.0.192
```

## 5. Configure Unity

Set `BackendConfig_DEV` base URL to:

```text
http://<PC_LAN_IP>:5000/api/v1
```

Example:

```text
http://10.0.0.192:5000/api/v1
```

The Quest and PC must be on the same LAN.

## 6. Allow Windows Firewall

When Windows prompts for Node.js network access, allow it on Private networks.

If no prompt astaminaars, open Windows Defender Firewall and allow Node.js through the firewall, or add an inbound TCP rule for port `5000` on Private networks.

## Useful Endpoints

```text
GET  /api/v1/health
GET  /api/v1/session/active
GET  /api/v1/combat/state
POST /api/v1/combat/fighters/:fighterId/move
```
