# Paid Services Linked to This Application

This document lists all third-party services that may incur costs when using this application.

---

## 1. OpenAI API

**Provider:** [OpenAI](https://openai.com)  
**Pricing:** Pay-per-use (tokens); see [OpenAI pricing](https://openai.com/pricing)

### Where it's used

| Feature | Location | Environment Variable |
|---------|----------|----------------------|
| AI Game Master (GM) | Backend `server.js` | `OPENAI_API_KEY` |
| GM model selection | Backend `server.js` | `GM_MODEL` (optional, defaults to `gpt-4o-mini`) |
| Party Chat | `backend/conchampioners/chatConchampioner.js` | `OPENAI_API_KEY` |
| Optional enemy combat AI | Frontend `src/utils/openaiAdapter.js` | User-entered API key (optional, in InitiativeTracker) |
| GM World Map travel narration | `src/components/GMWorldMap.jsx` â†’ `/api/openai/travel` | `OPENAI_API_KEY` |
| GM Control Panel (narrate, quest, encounter, assist) | `src/components/GMControlPanel.jsx` â†’ `/api/openai/*` | `OPENAI_API_KEY` |

### Models used

- **Chat:** `gpt-3.5-turbo`
- **GM / RAG:** `gpt-4o-mini` (or value of `GM_MODEL`)

### Notes

- Backend GM and Chat features require a valid `OPENAI_API_KEY` in `.env`
- The InitiativeTracker's optional "OpenAI for decisions" uses a key entered by the user; the app works without it (deterministic AI fallback)
- Rate limiting applies (e.g. 10 chat requests per minute in `chatConchampioner.js`)

---

## 2. MongoDB

**Provider:** [MongoDB](https://www.mongodb.com) (local or [MongoDB Atlas](https://www.mongodb.com/atlas))  
**Pricing:** Free for local or Atlas free tier; paid for Atlas paid tiers

### Where it's used

- All persistent data: characters, parties, users, sessions, maps, messages, combat logs, etc.
- Backend connects via `MONGODB_URI` in `.env`

### Notes

- Can run locally (`mongodb://localhost:27017/...`) at no cost
- MongoDB Atlas offers a free tier; paid tiers apply if you exceed free limits or need more resources

---

## 3. Optional Local AI Service

**Reference:** `http://localhost:8000` and `http://localhost:8001` in `backend/server.js`

### Where it's used

- `/api/session/create` â€“ creates session in this service
- `/api/game/interact` â€“ generates AI responses
- `/api/dev/test-generate` â€“ development testing

### Notes

- This points to a local service (e.g. a separate Python or Node backend)
- If that service calls paid APIs (e.g. OpenAI, Anthropic), costs apply there
- Not required for core app functionality; main OpenAI integration is via the backend directly

---

## Summary

| Service | Required? | Cost |
|---------|-----------|------|
| OpenAI API | Optional for GM/Chat features; optional for combat AI | Pay-per-use |
| MongoDB | Required for data storage | Free (local/Atlas free tier) or paid |
| Local AI Service (port 8000) | Optional | Depends on implementation |

---

## Environment Variables Reference

```env
# Required for MongoDB (local or Atlas)
MONGODB_URI=mongodb://localhost:27017/medieval_combat_simulator

# Required for OpenAI-backed features (GM, Chat, etc.)
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Override GM model (default: gpt-4o-mini)
GM_MODEL=gpt-4o-mini
```

---

*Last updated: March 2025*
