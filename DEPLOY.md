# Deployment Guide

This app needs a **persistent Node server** with **WebSockets**, **PostgreSQL (pgvector)**, and **Redis**.  
**Render is recommended** for the full stack. **Netlify** works for the frontend only if the API runs elsewhere.

---

## Option A — Render (recommended, all-in-one)

Backend + frontend + Postgres + Redis on Render. The Docker image builds the React app and serves it from Express on port 3000.

### 1. Push code to GitHub

```bash
git add .
git commit -m "Add Render deployment config"
git push origin main
```

### 2. Create services from Blueprint

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and creates:
   - **Web service** `buzznessai-hotel` (Docker)
   - **PostgreSQL** `buzznessai-db` (pgvector via migrations)
   - **Redis** `buzznessai-redis`
4. Click **Apply**

First deploy takes ~5–10 minutes (Docker build).

### 3. Set environment variables

In the **buzznessai-hotel** web service → **Environment**, add:

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `TWILIO_ACCOUNT_SID` | For phone | Twilio console |
| `TWILIO_AUTH_TOKEN` | For phone | Twilio console |
| `TWILIO_PHONE_NUMBER` | For phone | E.g. `+1234567890` |
| `TWILIO_WHATSAPP_NUMBER` | Optional | E.g. `whatsapp:+14155238886` |
| `TWILIO_HUMAN_TRANSFER_NUMBER` | Optional | Human handoff number |
| `DASHBOARD_USERNAME` | Yes | Change from default |
| `DASHBOARD_PASSWORD` | Yes | Strong password |

These are auto-set by Render:

- `DATABASE_URL` — from Postgres
- `REDIS_URL` — from Redis
- `JWT_SECRET` — generated
- `PUBLIC_URL` — from `RENDER_EXTERNAL_URL` (Twilio webhooks)
- `PORT` — injected by Render

Redeploy after saving env vars.

### 4. Seed the database (once)

Render Shell → web service → **Shell**:

```bash
npx prisma db seed
```

### 5. Verify

- Health: `https://<your-app>.onrender.com/health`
- Demo UI: `https://<your-app>.onrender.com/demo`

### 6. Twilio webhooks

In Twilio Console, set your phone number webhook to:

```
https://<your-app>.onrender.com/webhooks/twilio/incoming
```

Method: **POST**

Media stream URL (automatic via `PUBLIC_URL`):

```
wss://<your-app>.onrender.com/webhooks/twilio/media-stream
```

### Render notes

- **Cold starts**: Starter/free tiers sleep after inactivity; first request may take 30–60s.
- **Uploads**: Knowledge-base files use local disk (`uploads/`). They are **ephemeral** on Render — re-upload after redeploys, or add S3 later.
- **WebSockets**: Supported on Render web services (browser demo + Twilio media streams).

---

## Option B — Netlify (frontend only) + Render (backend)

Use this only if you want the UI on a separate domain. The API must still run on Render (or similar).

### 1. Deploy backend on Render

Follow **Option A** steps 1–4.

Copy your Render URL, e.g. `https://buzznessai-hotel.onrender.com`.

### 2. Deploy frontend on Netlify

1. [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Select your repo
3. Netlify reads `netlify.toml` automatically:
   - Base directory: `frontend`
   - Build: `npm ci && npm run build`
   - Publish: `frontend/dist`
4. **Site settings → Environment variables**:

   ```
   VITE_API_BASE_URL=https://buzznessai-hotel.onrender.com
   ```

   No trailing slash. Redeploy after adding.

5. Open `https://<your-netlify-site>.netlify.app/demo`

The frontend connects WebSockets to your Render backend via `VITE_API_BASE_URL`.

### Netlify limitations

- No backend, WebSockets, Postgres, or Redis on Netlify alone
- Phone/Twilio features still require the Render backend
- CORS is already enabled on the API

---

## Manual Docker deploy (VPS, Railway, Fly.io, etc.)

```bash
docker build -t buzznessai-hotel .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e PUBLIC_URL="https://your-domain.com" \
  -e JWT_SECRET="long-random-string" \
  -e OPENAI_API_KEY="sk-..." \
  buzznessai-hotel
```

Migrations run automatically on container start.

---

## Environment reference

See `.env.example` for all variables. Production minimum:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<32+ char random string>
OPENAI_API_KEY=sk-...
PUBLIC_URL=https://your-public-url.com   # auto on Render
TWILIO_VALIDATE_SIGNATURE=true           # production
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `/health` shows `database: error` | Check `DATABASE_URL`; wait for Postgres to finish provisioning |
| `/health` shows `redis: error` | Check `REDIS_URL`; ensure Redis instance is running |
| Voice demo connects but no audio | Verify `OPENAI_API_KEY` is set and valid |
| Twilio calls fail | Set `PUBLIC_URL` to HTTPS; configure webhook URL |
| Netlify demo can't connect | Set `VITE_API_BASE_URL` to Render URL; redeploy Netlify |
| pgvector errors | Migrations run `CREATE EXTENSION vector`; use Postgres 13+ (Render 16 ✓) |
