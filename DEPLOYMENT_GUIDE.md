# FinTrack Deployment Guide

FinTrack deploys as three pieces:

| Piece | Where | Source |
|---|---|---|
| Frontend (Next.js 16) | Vercel | `frontend/web` |
| Backend (Spring Boot monolith) | Render web service (Docker) | `backend/monolith` |
| Database | PostgreSQL (Supabase) | — |

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

CI builds the backend image on GitHub and Render only runs it, so deploys use no Render build minutes:

- On every push to `main` that changes `backend/monolith` (after the backend tests pass), the **Build & Push Backend Image** job pushes `ghcr.io/<owner>/fintrack-monolith:latest` (and `:<commit sha>`). You can also run it by hand: *Actions → CI → Run workflow*.
- Make the package public once (*GitHub → Packages → fintrack-monolith → Package settings → Change visibility*), or give Render registry credentials.
- In Render create a **Web Service → Existing Image** with that image, port `8080`, **health check path** `/actuator/health`.
- Copy the service's **Deploy Hook** URL into the GitHub secret `RENDER_DEPLOY_HOOK_URL`; CI calls it after each push so Render pulls the new image.

(Building from the repository with Render's own Docker build also works: Docker context `backend/monolith`, which has its own `Dockerfile`.)

Environment variables:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL`, `DB_USERNAME`, `DB_PASSWORD` | Yes | See above |
| `JWT_SECRET` | **Yes** | 32+ bytes. The app refuses to start without a strong secret. Generate with `openssl rand -base64 48`. Changing it logs everyone out |
| `GOOGLE_CLIENT_ID` | No | Enables Google sign-in |
| `BREVO_API_KEY` + `MAIL_FROM` | For email (recommended on Render free) | Sends email through [Brevo](https://www.brevo.com)'s HTTPS API. **Render's free tier blocks outgoing SMTP**, so Gmail SMTP can't work there. Free plan: 300 emails/day. Verify `MAIL_FROM` as a sender in Brevo, and give the API key the *Transactional email: All* permission |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | For email (paid hosts) | SMTP server for password-reset (and alert) emails. Without `MAIL_USERNAME` nothing is sent, so "Forgot password" can't deliver links. Gmail: `smtp.gmail.com`, port `587`, your address, and an [app password](https://myaccount.google.com/apppasswords) |
| `MAIL_FROM` | No | From address for emails (defaults to `MAIL_USERNAME`) |
| `APP_BASE_URL` | No | Web app URL used in email links; defaults to `https://fintrack-liart.vercel.app` |
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | For bank connections | From [dashboard.plaid.com](https://dashboard.plaid.com) → Developers → Keys. Without them, Settings → Bank accounts says connections aren't set up |
| `PLAID_REDIRECT_URI` | For Production | Where banks that sign in on their own website (OAuth: Chase, Bank of America, Wells Fargo, ...) send the user back: `https://<your-frontend>/plaid/oauth`. Add the same address in the Plaid dashboard under *Allowed redirect URIs*. Not needed in sandbox |
| `PLAID_COUNTRY_CODES` | No | Comma-separated countries to offer banks from (default `US` in production, `US,CA,GB` in sandbox). Only use countries your Plaid account is approved for |
| `PLAID_SANDBOX_SECRET` | For a public demo | With production keys: your **Sandbox** secret. Everyone not listed in `PLAID_PRODUCTION_EMAILS` then uses Plaid's test banks (`user_good` / `pass_good`), so visitors never use up real connections. Each connection keeps the mode it was made in |
| `PLAID_PRODUCTION_EMAILS` | For a public demo | Comma-separated emails that get real banks when `PLAID_SANDBOX_SECRET` is set (e.g. your own) |
| `PLAID_ENV` | No | `sandbox` (default, test banks: user `user_good`, password `pass_good`), `development` or `production` (needs Plaid's approval) |
| `PLAID_TOKEN_KEY` | Recommended with Plaid | Any long random string; encrypts stored bank access tokens. Defaults to one derived from `JWT_SECRET` (changing either means banks must be reconnected) |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_HOST` | No | Outbound email (`MAIL_HOST` defaults to `smtp.gmail.com`) |
| `FLYWAY_ENABLED` | No | Defaults to `true`. Set to `false` to switch Flyway off without a code change |

### CORS

The backend only accepts browser requests from an explicit allow-list in `SecurityConfig.corsConfigurationSource()`: localhost dev ports, the Vercel production domain and its preview URLs. **If you serve the frontend from another domain (for example a custom domain), add it to that list and redeploy the backend** — otherwise the browser blocks every API call.

## 2a. Keeping the free backend awake

Render's free tier sleeps after 15 minutes without traffic, and the next visitor waits about a minute.
GitHub's scheduled `keep-alive.yml` helps but GitHub often delays it by hours. A free external monitor is
reliable: create an HTTP monitor at [UptimeRobot](https://uptimerobot.com) for
`https://<your-api>.onrender.com/actuator/health` every 5 minutes. One always-on service is ~730
instance hours a month, inside Render's free 750.

## 2b. Database backups

Supabase's free plan has no downloadable backups. `.github/workflows/db-backup.yml` takes an
encrypted (AES-256) copy every Sunday and keeps it 30 days as a workflow artifact. Add two repository
secrets (*Settings → Secrets and variables → Actions*):

- `BACKUP_DATABASE_URL`: Supabase → Project settings → Database → Connection string (URI)
- `BACKUP_PASSPHRASE`: a long random passphrase; keep a copy in your password manager

Run it once by hand (*Actions → Database backup → Run workflow*). To restore:
`gpg --decrypt fintrack-YYYY-MM-DD.sql.gz.gpg | gunzip | psql "<database url>"`.

## 3. Frontend (Vercel)

Import the repository in Vercel:

- **Root directory:** `frontend/web`
- **Framework preset:** Next.js
- **Environment variable:** `NEXT_PUBLIC_API_URL` = your backend's public URL (for example `https://your-backend.onrender.com`). The browser never calls it directly: `next.config.js` proxies `/api/*` on the Vercel domain to it, so the backend's HttpOnly session cookies are first-party. It's read at build time, so redeploy after changing it. (`BACKEND_URL`, if set, takes precedence for the proxy target.)

To use a custom domain, add it under the project's **Settings → Domains** and follow the DNS records Vercel shows, then update the CORS allow-list as described above.

## 4. Database migrations (Flyway)

On startup Flyway runs any new migrations in `backend/monolith/src/main/resources/db/migration`.

- **First deploy with Flyway:** the existing database has no Flyway history, so Flyway *baselines* it at version 1 and leaves your data and tables untouched. You'll see "Successfully baselined schema with version: 1" in the logs.
- **Schema changes come only from migrations:** Hibernate runs with `ddl-auto=validate` and won't start if the tables don't match the entities. To fall back temporarily, set `JPA_DDL_AUTO=update` in the service's environment.
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
| API calls fail in production (proxied to `localhost:8080`) | `NEXT_PUBLIC_API_URL` wasn't set at build time; set it and redeploy |
| Signed out on every page load | The session cookies are `Secure`: serve the site over HTTPS (or `localhost`). Locally over plain HTTP on another host, set `AUTH_COOKIE_SECURE=false` on the backend |
| Flyway checksum mismatch | A migration that was already applied has been edited; restore it and add a new migration |
