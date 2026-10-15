# FinTrack Deployment Guide

FinTrack deploys as three pieces:

| Piece | Where | Source |
|---|---|---|
| Frontend (Next.js 14) | Vercel | `frontend/web` |
| Backend (Spring Boot monolith) | Render web service (Docker) | `backend/monolith` |
| Database | Render managed PostgreSQL | — |
| ML classifier (optional, off by default) | Any Python host | `ml-classifier` |

> The project used to be split into microservices. They were removed; the old code is still in git history (commit `5ae1150` is the last one that contains it).

---

## 1. Database

Create a PostgreSQL instance (for example Render's managed PostgreSQL) and note its **internal** connection details. The backend needs a **JDBC** URL:

```
DATABASE_URL=jdbc:postgresql://<host>:5432/<database>
DB_USERNAME=<user>
DB_PASSWORD=<password>
```

A plain `postgresql://...` URL will not work.

## 2. Backend (Render)

Create a **Web Service** from this repository:

- **Runtime:** Docker
- **Root directory / Docker context:** `backend/monolith` (it has its own `Dockerfile`; the app listens on port `8080`)
- **Health check path:** `/actuator/health`

Environment variables:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL`, `DB_USERNAME`, `DB_PASSWORD` | Yes | See above |
| `JWT_SECRET` | **Yes** | 32+ bytes. The app refuses to start without a strong secret. Generate with `openssl rand -base64 48`. Changing it logs everyone out |
| `GOOGLE_CLIENT_ID` | No | Enables Google sign-in |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_HOST` | No | Outbound email (`MAIL_HOST` defaults to `smtp.gmail.com`) |
| `FLYWAY_ENABLED` | No | Defaults to `true`. Set to `false` to switch Flyway off without a code change |
| `ML_CLASSIFIER_ENABLED`, `ML_CLASSIFIER_URL` | No | Optional category classifier; off by default |

### CORS

The backend only accepts browser requests from an explicit allow-list in `SecurityConfig.corsConfigurationSource()`: localhost dev ports, the Vercel production domain and its preview URLs. **If you serve the frontend from another domain (for example a custom domain), add it to that list and redeploy the backend** — otherwise the browser blocks every API call.

## 3. Frontend (Vercel)

Import the repository in Vercel:

- **Root directory:** `frontend/web`
- **Framework preset:** Next.js
- **Environment variable:** `NEXT_PUBLIC_API_URL` = your backend's public URL (for example `https://your-backend.onrender.com`). It is inlined at build time, so redeploy after changing it.

To use a custom domain, add it under the project's **Settings → Domains** and follow the DNS records Vercel shows, then update the CORS allow-list as described above.

## 4. Database migrations (Flyway)

On startup Flyway runs any new migrations in `backend/monolith/src/main/resources/db/migration`.

- **First deploy with Flyway:** the existing database has no Flyway history, so Flyway *baselines* it at version 1 and leaves your data and tables untouched. You'll see "Successfully baselined schema with version: 1" in the logs.
- **Rollout step 2:** after one clean deploy, change `spring.jpa.hibernate.ddl-auto` from `update` to `validate` in `application.properties`. From then on, only migrations change the schema.
- **Adding a change:** add `V2__short_description.sql` (and so on). Never edit a migration that has already been applied.

## 5. Verify a deployment

```bash
curl https://<backend>/actuator/health        # → {"status":"UP"}
```

Then open the frontend, use the demo login, and check that the dashboard loads with data.

Render's free plan puts the backend to sleep when idle, so the first request after a quiet period can take 30+ seconds. A paid instance (or an uptime pinger hitting `/actuator/health`) avoids that.

## 6. Local full stack with Docker Compose

```bash
JWT_SECRET=$(openssl rand -base64 48) docker compose up --build
# app on http://localhost:3000, API on http://localhost:8080
```

Starts PostgreSQL, the backend and the frontend.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend exits at startup mentioning the JWT secret | `JWT_SECRET` missing, too short, or a known public example value |
| `HikariPool` / connection refused | `DATABASE_URL` isn't a JDBC URL, or the DB isn't reachable from the service |
| Browser shows CORS errors but the API works with curl | The frontend's origin isn't in the CORS allow-list |
| Frontend calls `localhost:8080` in production | `NEXT_PUBLIC_API_URL` wasn't set at build time; set it and redeploy |
| Flyway checksum mismatch | A migration that was already applied has been edited; restore it and add a new migration |
