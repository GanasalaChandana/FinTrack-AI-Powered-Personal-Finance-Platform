<div align="center">

# FinTrack — AI-Powered Personal Finance Platform

**Full-stack finance app with statistical anomaly detection, month-end budget forecasting, and smart alerts. Spring Boot + Next.js, deployed on Render and Vercel.**

[![Live Demo](https://img.shields.io/badge/▶%20Live%20Demo-fintrack--liart.vercel.app-6366f1?style=for-the-badge&logo=vercel)](https://fintrack-liart.vercel.app)

[![CI](https://img.shields.io/github/actions/workflow/status/GanasalaChandana/FinTrack-AI-Powered-Personal-Finance-Platform/ci.yml?branch=main&style=flat-square&label=CI&logo=github)](https://github.com/GanasalaChandana/FinTrack-AI-Powered-Personal-Finance-Platform/actions)
&nbsp;
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot%203.4-Java%2017-6db33f?style=flat-square&logo=spring)](https://spring.io/projects/spring-boot)
&nbsp;
[![Next.js](https://img.shields.io/badge/Next.js%2016-TypeScript-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
&nbsp;
[![Tests](https://img.shields.io/badge/Tests-260%2B%20(JUnit%20%C2%B7%20Vitest%20%C2%B7%20Playwright)-22c55e?style=flat-square&logo=junit5)](https://github.com/GanasalaChandana/FinTrack-AI-Powered-Personal-Finance-Platform/actions)
&nbsp;
[![DB Backup](https://img.shields.io/github/actions/workflow/status/GanasalaChandana/FinTrack-AI-Powered-Personal-Finance-Platform/db-backup.yml?branch=main&style=flat-square&label=Weekly%20DB%20backup&logo=postgresql)](https://github.com/GanasalaChandana/FinTrack-AI-Powered-Personal-Finance-Platform/actions/workflows/db-backup.yml)
&nbsp;
[![License: MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

</div>

---

## 🧠 Key Highlights

> What separates FinTrack from standard CRUD finance apps:

- **Statistical anomaly detection** — flags unusual spend using mean + 2σ per category. Runs 100% in the browser, zero API cost. This is rule-based analytics, not machine learning (see [Analytics Engine](#-analytics-engine-client-side-rule-based-zero-api-cost))
- **Next-month prediction** — 3-month weighted rolling average (weights 3-2-1) projects next month's income, expenses, and savings with trend momentum and a confidence rating
- **Predictive budget forecasting** — daily burn rate × days remaining = end-of-month projection with per-category "at risk" warnings
- **Spoof-resistant rate limiting** — sliding window per IP *and* per account, plus an app-wide sign-up cap, so a forged `X-Forwarded-For` can't dodge it. No Redis needed (`ConcurrentHashMap` + `Deque<Long>`)
- **Instant session revocation** — every access token carries the user's token version; signing out, changing the password or deleting the account bumps it, so older tokens are refused at once (checked against a 15-second cache, not on every query)
- **HttpOnly cookie sessions** — the access and refresh tokens live in HttpOnly, Secure, SameSite=Lax cookies that page scripts can't read; the web app reaches the API through its own domain (a Vercel rewrite) so they are first-party, and cookie-authenticated writes must carry an `X-Requested-With` header (CSRF)
- **Refresh token rotation with replay detection** — SHA-256 hashed, single-use; detecting a replayed token revokes ALL active sessions
- **Fail-fast security config** — the server refuses to start without a strong `JWT_SECRET` (and rejects known public example secrets); `/actuator` exposes only `health`; errors return generic messages, never internals
- **Ownership checks on user-scoped routes** — other users' resources return 403/404, and a `userId` supplied in a request body or query string is no longer trusted over the authenticated caller
- **Live bank connections (Plaid)** — Plaid Link with the OAuth redirect flow (Chase, Bank of America, Wells Fargo…), cursor-based `/transactions/sync`, access tokens AES-256-GCM encrypted at rest. A **public demo mode** puts visitors on Plaid's sandbox test banks while chosen accounts use production, and every connection remembers which environment it belongs to
- **Two-factor sign-in (TOTP, RFC 6238)** — implemented from scratch (HMAC-SHA1, ±1 step drift, replay protection), one-time backup codes stored as SHA-256 hashes, and a lost-device recovery that only completes after a 3-day wait with an emailed cancel link
- **Web Push with only the JDK** — message encryption (RFC 8291, `aes128gcm`) and VAPID signing (RFC 8292, ES256) written with `javax.crypto`, verified against independent implementations (Python `http_ece` and PyJWT) and accepted by Google's push service. Budget, unusual-spending and goal-milestone alerts reach phones and desktops
- **Email that works on a free host** — Render's free tier blocks outgoing SMTP, so mail goes through Brevo's HTTPS API (SMTP still supported), with timeouts so a blocked mail server can't hang a request
- **260+ automated tests** — 176 backend (Mockito unit, `@WebMvcTest` slices, `@SpringBootTest` integration on in-memory H2, fake Plaid / push servers on localhost), 55 Vitest unit tests and 36 Playwright end-to-end tests run on desktop and phone viewports in CI
- **Versioned database migrations** — Flyway baselines the live database and owns schema changes going forward; a test checks the baseline against the JPA entities
- **Safe to scale out** — every scheduled job takes a database lock (ShedLock), so with several instances each job runs once; recurring transactions and budget alerts carry unique keys, so a crash-and-retry can't create duplicates

---

## 📸 Screenshots

**Desktop**

| Dashboard + insights | Transactions | Monthly budgets |
|:---:|:---:|:---:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Transactions](docs/screenshots/transactions.png) | ![Budgets](docs/screenshots/budgets.png) |
| **Smart alerts** | **Reports & forecast** | **Bank connections (demo mode)** |
| ![Alerts](docs/screenshots/alerts.png) | ![Reports](docs/screenshots/reports.png) | ![Bank connections](docs/screenshots/bank-connections.png) |
| **Two-factor sign-in** | **Push notifications** | |
| ![Two-factor](docs/screenshots/two-factor.png) | ![Push notifications](docs/screenshots/push-notifications.png) | |

**Phone** (iPhone and Android; installable from the browser)

| Dashboard | Transactions | Budgets | Bank accounts |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/mobile-dashboard.png" width="200" alt="Dashboard on a phone"> | <img src="docs/screenshots/mobile-transactions.png" width="200" alt="Transactions on a phone"> | <img src="docs/screenshots/mobile-budgets.png" width="200" alt="Budgets on a phone"> | <img src="docs/screenshots/mobile-bank-connections.png" width="200" alt="Bank accounts on a phone"> |

👉 **[Try the live demo → fintrack-liart.vercel.app](https://fintrack-liart.vercel.app)**

> ⏱️ **First load can be slow.** The backend runs on Render's free plan, which puts the server to sleep when idle. The first request after a quiet period can take 30+ seconds while it wakes up (the app shows a "waking up the server" message). After that it responds normally.

---

## 🎬 Demo

<div align="center">

[![Live App](https://img.shields.io/badge/🚀%20Try%20Live%20App-fintrack--liart.vercel.app-22c55e?style=for-the-badge&logo=vercel)](https://fintrack-liart.vercel.app)

<img src="docs/screenshots/demo.gif" alt="FinTrack walkthrough: sign in, dashboard, transactions, budgets, reports, alerts and insights" width="900" />

*No sign-up needed: press **Try the demo** on the sign-in page. In the demo, Bank accounts uses Plaid's test banks (user `user_good`, password `pass_good`).*

</div>

**Key flows to explore in the live app:**
- 🤖 **Dashboard → AI Insights row** — anomaly cards + burn rate forecast + next-month prediction
- 📊 **Reports tab** — nine report views (overview, custom, trends, comparison, forecast, budget history, tax, income, savings) built from your real transactions; the **Custom** view generates a report from the metrics, range and grouping you pick
- 🔔 **Alerts page** — smart rule-based alerts with severity badges; budget alerts are generated hourly by a background job
- 📥 **Transactions → Import CSV** — bulk upload with auto-tagging and payment methods read from the file; an unusable file never wipes existing data, and you get a real import result back
- 🏦 **Settings → Bank accounts → Connect a bank** — connect one of Plaid's test banks with `user_good` / `pass_good`; sample transactions import and categorise automatically
- 🔐 **Settings → Security** — set up two-factor sign-in with any authenticator app
- 📲 **Settings → Notifications** — turn on push notifications for this device and send yourself a test
- 🧪 **Demo account** — try the app without signing up; the demo account is protected from deletion

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🤖 | **Anomaly Detection** | Statistical (mean + 2σ per category) — *"Housing ($1,200) is 277% above your $324 avg for this category"*. Needs a meaningful history in the category to fire |
| 🔮 | **Next-Month Prediction** | 3-month weighted forecast — *predicts income, expenses, savings rate with trend momentum and High/Medium/Low confidence* |
| 📈 | **Budget Forecasting** | Burn rate projection — *"On track to spend $3,855 vs $3,150 budget — $705 over. Housing at 200%."* |
| 🔔 | **Smart Alerts** | 8 rule types: large transactions, spending spikes, category concentration, income tracking |
| 🔄 | **Recurring Detection** | Levenshtein similarity matching identifies subscriptions and projects future bills |
| 🧾 | **Receipt Scanner** | Camera/file upload → Tesseract.js OCR extracts merchant, amount, date |
| 📊 | **Interactive Reports** | Nine report views: overview, custom, trends, comparison, 6-month forecast, budget history, tax, income, savings. Safe CSV / Excel / PDF exports (no third-party CDN scripts) |
| 💳 | **Payment Methods** | Transactions carry a payment method, read from CSV imports and editable per transaction |
| 🎯 | **Smart Categories (ML)** | New and imported transactions are categorised from your own history: a category you set for that merchant, else a **Naive Bayes classifier trained on your categorised transactions** (merchant and description words, amount size), else keyword rules. Settings shows its cross-validated accuracy against a majority-class baseline |
| 🔐 | **Secure Auth** | Email/password and Google sign-in, JWT HS256, refresh token rotation, per-IP and per-account rate limiting, BCrypt hashing, case-insensitive unique emails |
| 🏦 | **Bank Connections** | Plaid Link (incl. OAuth banks) → transactions sync every 6 hours; real banks for chosen accounts, Plaid's test banks for everyone else |
| 📥 | **File Import** | CSV, OFX and QFX bank exports, with column mapping, preview and duplicate-safe import |
| 🔑 | **Two-Factor Sign-In** | Authenticator-app codes (TOTP), 10 one-time backup codes, lost-device recovery with an emailed cancel link |
| 📲 | **Push Notifications** | Budget, large-transaction, unusual-spending and goal-milestone alerts on phones and desktops (Web Push) |
| ✉️ | **Email** | Password reset, household invites, budget alerts, weekly digest and monthly report |
| 👪 | **Households** | Invite people by email to share budgets; everyone's spending counts, transactions stay private |
| 🔁 | **Recurring Transactions** | Weekly / biweekly / monthly / quarterly / yearly rules that post themselves; pause and resume |
| 📱 | **Installable App** | Works on iPhone, Android and desktop; add to the home screen for a full-screen app |
| ☁️ | **Synced Settings** | Debts, net worth, categories, alert rules and preferences are saved to the account, not the browser |
| 👤 | **Account Controls** | Change password (8+ characters), reset data, or delete your account and all of its data |

---

## 🔍 Engineering Decisions

Choices that shaped the code, and why:

| Decision | Why | Where |
|---|---|---|
| **Web Push written with `javax.crypto`** instead of a library | The Java libraries pull in Bouncy Castle and an HTTP client for ~150 lines of standard crypto. Writing it meant reading RFC 8291/8292 closely; correctness is checked against Python's `http_ece` and PyJWT, and by Google's push service accepting the messages | `backend/.../push/WebPushCrypto.java` |
| **TOTP two-factor from the RFC**, not a library | Small, well-specified algorithm; the test suite uses the RFC 6238 test vector. Codes can't be replayed (the last used time step is stored), and recovery waits 3 days with an emailed cancel link so a stolen password alone can't remove 2FA | `backend/.../auth/twofactor/` |
| **Two Plaid environments side by side** | Production connections are limited and paid; a public demo would use them up. Visitors get the sandbox, chosen accounts get production, and each stored connection keeps the environment it was made in so syncs never go to the wrong one | `backend/.../plaid/PlaidConfig.java` |
| **Email over HTTPS (Brevo) with SMTP as a fallback** | Render's free tier blocks outgoing SMTP; the first sign was password-reset requests hanging until the proxy returned 502. Both paths now have 5-second timeouts | `backend/.../common/EmailService.java` |
| **Rule-based analytics + a Naive Bayes categoriser, not an LLM** | Runs instantly and for free, gives explainable results ("550% above your $59 average"), and needs no user data sent to a third party | `frontend/web/lib/utils/aiInsights.ts`, `backend/.../CategoryClassifier.java` |
| **Session cookies, not tokens in localStorage** | Page scripts can't read HttpOnly cookies, so an XSS bug can't steal a session; writes need an `X-Requested-With` header against CSRF | `backend/.../auth/security/AuthCookies.java` |
| **Database locks on scheduled jobs (ShedLock)** | The free host may briefly run two instances during a deploy; each alert, digest and sync still runs once | `@SchedulerLock` on every `@Scheduled` job |

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph FE["🌐 Frontend — Vercel (Next.js 16 · TypeScript · Tailwind)"]
        direction TB
        dash["Dashboard\nAI Insights · Forecast · Prediction"]
        txn["Transactions\nCRUD · CSV Import · OCR"]
        rep["Reports\n9 report views · Recharts"]
        ale["Alerts · Notifications"]

        subgraph AI["⚡ Client-side Analytics Engine (rule-based, zero API cost)"]
            ai1["aiInsights.ts\nmean + 2σ anomaly detection"]
            ai2["budgetForecast.ts\nburn rate projection"]
            ai3["NextMonthPrediction\n3-month weighted forecast"]
        end
    end

    subgraph BE["☁️ Backend — Render (Spring Boot 3.4 · Java 17)"]
        direction TB
        rl["LoginRateLimiter\nPer-IP + per-account sliding window"]
        jwt["JwtAuthFilter\nHS256 verify · expiry check"]
        ctrl["Controllers\n@Valid · ownership enforced"]
        svc["Services\nBusiness logic · category rules"]

        subgraph API["REST Endpoints"]
            a1["/api/auth"]
            a2["/api/transactions"]
            a3["/api/budgets"]
            a4["/api/reports"]
            a5["/api/alerts"]
            a6["/api/goals · /api/recurring-transactions\n/api/notifications · /api/users"]
        end
    end

    subgraph DB["🗄️ PostgreSQL — Supabase"]
        migrations["Flyway migrations (V1 baseline, V2 indexes + locks)\nHibernate ddl-auto=validate"]
    end

    FE -- "HTTPS · /api proxied · HttpOnly cookie JWT" --> BE
    rl --> jwt --> ctrl --> svc --> API
    svc -- "JPA" --> DB
```

---

## 🔐 Security Design

### Request Lifecycle
```
HTTP Request
  → CORS (explicit allow-list: localhost dev ports + the deployed frontend)
  → Auth endpoints only: LoginRateLimiter (per IP + per account, no Redis)
  → JwtAuthFilter (extract + verify HS256, check expiry)
  → X-User-Id injected from the verified token (client value overwritten)
  → SecurityContext (userId available to all controllers)
  → Controller (@Valid bean validation; ownership check against the caller)
  → Service → Repository → PostgreSQL
  → JSON Response (errors go through one GlobalExceptionHandler: correct
    status codes, generic messages, no stack traces or internals)
```

### Startup & Deployment Hardening
- **`JWT_SECRET` is mandatory.** The app fails to start if it's missing, shorter than 32 bytes, or one of the known public example secrets
- **Actuator is locked down.** Only `/actuator/health` is exposed, and it returns status only (no details). Other actuator endpoints are not public
- **Ownership returns 404, not 403, where it matters** (e.g. fetching another user's alert by ID) so IDs can't be probed
- **The demo account is protected.** It can't be deleted, and repeated demo logins re-seed once instead of mixing data
- **Account deletion is complete.** Deleting an account removes all of that user's data

### Refresh Token Rotation
```
Login   → SecureRandom 32-byte token generated
        → SHA-256(token) stored in DB, raw token sent to client

Refresh → SHA-256(incoming) looked up in DB
        → Already used? → REPLAY ATTACK detected
                         → ALL user tokens revoked immediately
        → Valid?         → old token invalidated, new pair issued

Cleanup → @Scheduled daily job purges expired tokens
```

### Rate Limiting (no Redis required)
```java
// Sliding window — O(1) amortized
private final ConcurrentHashMap<String, Deque<Long>> attempts;
// Default: 5 attempts in any 15-minute window
// Returns Retry-After header on 429
// Auto-cleans stale keys every 10 minutes
```

| Limiter | Key | Why |
|---|---|---|
| Per IP | `CF-Connecting-IP` (set by Cloudflare in front of Render), falling back to `X-Forwarded-For` / `X-Real-IP` | Slows brute force from one source |
| Per account | Login email | `X-Forwarded-For` can be forged, the target email can't — so rotating fake IPs doesn't reset an account's counter |
| Global sign-ups | App-wide (30 per 10 min) | Caps scripted mass sign-ups even when IPs are spoofed |

Successful logins reset the IP and account counters. Successful sign-ups do **not** reset the sign-up counters, so one IP can't create unlimited accounts.

---

## 🧠 Analytics Engine (client-side, rule-based, zero API cost)

The "AI" features are classic statistics and heuristics that run in the browser — averages, standard deviations, burn-rate projections and similarity matching. **They are not machine-learning models.** The one machine-learning component is the per-user category model (multinomial Naive Bayes, trained in the backend on the user's own categorised transactions; see *Smart Categories*).

### Anomaly Detection — `lib/utils/aiInsights.ts`
```
For each spending category (requires ≥3 transactions):

  mean = average transaction amount
  σ    = population standard deviation of that category

  deviation = |transaction - mean| / σ

  deviation > 2  →  flagged, MEDIUM impact
  deviation > 3  →  flagged, HIGH impact

  "Dinner ($200.00) is 366% above your $43 average for this category."
```
Because σ is computed over the same transactions, one outlier among *n* values can be at most √(n−1) standard deviations from the mean. In practice a category needs **at least 6 transactions** before an outlier can exceed 2σ, and at least 11 before it can reach the HIGH level. With less history, nothing is flagged.

### Budget Forecasting — `lib/utils/budgetForecast.ts`
```
daysElapsed    = today's date - 1
dailyBurnRate  = totalSpentThisMonth / daysElapsed
projectedTotal = dailyBurnRate × daysInMonth

Per category:
  projected   = (categorySpent / daysElapsed) × daysInMonth
  atRisk      = projected > budgetLimit
  overBy      = projected - budgetLimit

Output: "📊 Projected $3,855 vs $3,150 budget — $705 over.
         Housing (200%), Bills & Utilities (197%) at risk."
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts, React Hook Form, Tesseract.js |
| **Backend** | Spring Boot 3.4, Java 17, Spring Security, Spring Data JPA, Maven |
| **Database** | PostgreSQL (Supabase) with Flyway migrations V1–V16; Hibernate only validates the schema (`ddl-auto=validate`) |
| **Auth** | JWT HS256 in HttpOnly cookies, Google sign-in, TOTP two-factor, BCrypt, Refresh Token Rotation, per-IP + per-account Rate Limiting |
| **Integrations** | Plaid (bank data), Brevo (email over HTTPS), Web Push (RFC 8291 / 8292, no third-party library) |
| **Testing** | Backend: JUnit 5, Mockito, @WebMvcTest, MockMvc, @SpringBootTest + in-memory H2 (176 tests). Frontend: Vitest (55 unit tests), Playwright (36 end-to-end tests on desktop and phone viewports) |
| **DevOps** | GitHub Actions CI (backend tests, TypeScript, Vitest, Docker image, Playwright against the live site), Docker Compose, Vercel (frontend), Render (backend), Supabase (database), weekly AES-256 encrypted database backups, UptimeRobot monitoring |

---

## 🔌 API Reference

All routes except `/api/auth/**` and the health checks require a session: the `ft_at` HttpOnly cookie (web app; writes also need `X-Requested-With`) or `Authorization: Bearer <token>` (API clients). You don't send a user ID: the JWT filter reads it from the verified token and injects `X-User-Id` itself, overwriting any value the client supplies, so a caller can't act as another user.

**Auth** (rate-limited: per IP, plus per account on login)
```
POST   /api/auth/register          Register → { token, refreshToken }
POST   /api/auth/login             Login
POST   /api/auth/refresh           Rotate refresh token (replay-safe)
POST   /api/auth/google            Google sign-in
POST   /api/auth/demo              Log in to a seeded demo account
```

**Users / Account**
```
GET    /api/users/me               Current user
GET    /api/users/profile          Profile
PUT    /api/users/profile          Update profile
POST   /api/users/change-password  Change password (8+ characters)
POST   /api/users/reset-data       Reset the user's data to the standard demo dataset
DELETE /api/users/me               Delete account and all data (demo account is protected)
```

**Transactions**
```
GET    /api/transactions            List (paginated, filter by date/category/type)
POST   /api/transactions            Create (category auto-tagged if missing)
GET    /api/transactions/{id}       Get one (ownership enforced)
PUT    /api/transactions/{id}       Update (ownership enforced)
DELETE /api/transactions/{id}       Delete (ownership enforced)
DELETE /api/transactions/all        Delete all of the caller's transactions
GET    /api/transactions/summary    Income / expense / balance totals
POST   /api/transactions/upload     CSV import (payment methods read from the file)
POST   /api/transactions/classify   Category suggestion for a merchant
GET    /api/transactions/reports/**  Totals, by-type and by-category aggregates
```

**Recurring Transactions**
```
GET/POST        /api/recurring-transactions
GET/PUT/DELETE  /api/recurring-transactions/{id}
```
A scheduled job generates due occurrences and catches up on any missed days.

**Budgets**
```
GET    /api/budgets                 List (?month=YYYY-MM)
POST   /api/budgets                 Create + auto-sync spent from transactions
GET    /api/budgets/{id}            Get one
PUT    /api/budgets/{id}            Update
PATCH  /api/budgets/{id}/spent      Update spent amount
DELETE /api/budgets/{id}            Delete (ownership enforced)
DELETE /api/budgets/all             Delete all of the caller's budgets
GET    /api/budgets/summary         Totals, remaining, % used per month
GET    /api/budgets/category        Budget for a category (scoped to the caller)
```

**Goals**
```
GET/POST        /api/goals
GET/PUT/DELETE  /api/goals/{id}
PATCH  /api/goals/{id}/contribute   Add a contribution
GET    /api/goals/summary           Progress across goals
```

**Reports**
```
GET    /api/reports/financial         Period summary (income, expenses, savings rate)
GET    /api/reports/monthly-summary   Month-by-month breakdown
GET    /api/reports/category-breakdown  Spend by category vs. budget
GET    /api/reports/top-expenses      Largest expenses
GET    /api/reports/savings-goals     Goal progress
GET    /api/reports/insights          Over-budget and trend insights
GET    /api/reports/comparison        Period-over-period comparison
GET    /api/reports/forecast          6-month projection
GET    /api/reports/export/pdf        PDF export
```

**Alerts** (every route is scoped to the caller; other users' alerts return 403/404)
```
GET    /api/alerts                  List the caller's alerts
GET    /api/alerts/{id}             Get one
GET    /api/alerts/user/{userId}    List by user (caller's own ID only)
POST   /api/alerts                  Create
PUT    /api/alerts/{id}             Update
PATCH  /api/alerts/{id}/status      Change status
POST   /api/alerts/{id}/acknowledge Mark acknowledged
POST   /api/alerts/acknowledge-all  Acknowledge all of the caller's alerts
DELETE /api/alerts/{id}             Dismiss
```

**Notifications** — `/api/notifications` (list, unread count, mark read, per-user settings)

---

## 🚀 Local Setup

**Prerequisites:** Java 17+, Node.js 18+, PostgreSQL 14+

**Backend**
```bash
cd backend/monolith

# DATABASE_URL must be a JDBC URL (jdbc:postgresql://...)
export DATABASE_URL=jdbc:postgresql://localhost:5432/fintrack
export DB_USERNAME=postgres
export DB_PASSWORD=yourpassword
# JWT_SECRET is required: the app refuses to start without a strong secret
# (32+ bytes). Don't reuse an example value — known public secrets are rejected.
export JWT_SECRET=$(openssl rand -base64 48)

# Optional
# export GOOGLE_CLIENT_ID=...                  # enables Google sign-in
# export MAIL_USERNAME=... MAIL_PASSWORD=...   # outbound email (MAIL_HOST defaults to smtp.gmail.com)

mvn spring-boot:run
# → http://localhost:8080
```

**Frontend**
```bash
cd frontend/web
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
npm install && npm run dev
# → http://localhost:3000
```

**Docker (full stack)** — PostgreSQL + backend + frontend, same as production
```bash
JWT_SECRET=$(openssl rand -base64 48) docker compose up --build
# → app on http://localhost:3000, API on http://localhost:8080
```

Hosting it yourself on Render + Vercel (environment variables, CORS, custom domains, Flyway rollout)? See the [Deployment Guide](DEPLOYMENT_GUIDE.md).

---

## 🗄️ Database Migrations

Schema changes are versioned with [Flyway](https://flywaydb.org). Migrations live in `backend/monolith/src/main/resources/db/migration`.

- **`V1__baseline_schema.sql`** describes the current schema. A brand-new database runs it. An existing database (like production, which Hibernate created) is *baselined* at version 1 — Flyway records it and does **not** run the script against it.
- **`V2__indexes_job_locks_and_idempotency.sql`** adds the per-user query indexes, the `shedlock` table for scheduled-job locks, and the unique keys that stop duplicate recurring transactions and budget alerts.
- **To change the schema**, add a new file such as `V3__add_something.sql`. Never edit a migration that has already been applied; Flyway checks file checksums and will refuse to start if one changed.
- **Flyway only:** Hibernate runs with `ddl-auto=validate`, so migrations are the only thing that change the schema; if a table doesn't match the entities the app refuses to start instead of silently altering production. Set `JPA_DDL_AUTO=update` in the host's environment to fall back without a code change.
- **Emergency switch:** set `FLYWAY_ENABLED=false` in the host's environment to turn Flyway off without a code change.

---

## 🧪 Tests

```bash
# Backend (JUnit 5)
cd backend/monolith && mvn test

# Frontend unit tests (Vitest)
cd frontend/web && npm test

# Frontend end-to-end smoke tests (Playwright, runs against a live URL)
cd frontend/web && npm run test:e2e
```

**Backend:** 176 tests. Integration tests use an in-memory H2 database — no PostgreSQL required locally.

| Area | Test classes | Coverage |
|---|---|---|
| Transactions | `TransactionServiceTest`, `TransactionControllerTest`, `PaymentMethodIntegrationTest`, `RecurringTransactionServiceTest` | CRUD, category auto-tagging, date defaults, userId scoping, HTTP status codes, payment methods (create/update/CSV import), recurring catch-up and end dates |
| Budgets & alerts | `BudgetsServiceTest`, `BudgetControllerTest`, `AlertControllerTest`, `BudgetAlertSchedulerTest` | syncSpent accuracy, budget CRUD, ownership (owner / stranger / missing user), budget alerts created from synced spend |
| Reports | `ReportsIntegrationTest` | Reports built from real data, over-budget insights, other users' reports forbidden |
| Auth & accounts | `RegistrationFlowTest`, `AccountManagementTest`, `DemoServiceTest` | Sign-up validation, case-insensitive email, password rules, full account deletion, demo account protection and re-seeding |
| Security | `AuthControllerRateLimitTest`, `JwtUtilSecretValidationTest`, `ActuatorExposureTest`, `CorsTest`, `GlobalExceptionHandlerTest` | Spoofed-IP rate limiting and sign-up cap, weak/missing/public JWT secrets rejected, actuator exposure, CORS allow-list, correct status codes with generic error messages |
| Bank connections | `PlaidIntegrationTest`, `PlaidLinkTokenTest` | Import, modify and remove via sync cursors, encrypted access tokens, login-required handling, ownership; what is sent to Plaid in sandbox, production and demo mode (fake Plaid on localhost) |
| Two-factor & push | `TwoFactorTest`, `PushNotificationTest` | RFC 6238 test vector, code reuse refused, backup codes, recovery after the waiting period; push messages decrypted with the device's keys and VAPID signatures verified on a fake push service, expired devices removed |
| Notifications & sharing | `NotificationEmailTest`, `HouseholdTest`, `UserDataTest` | Large-transaction, unusual-spending and goal-milestone alerts honour their switches; household invites and shared budgets; per-user synced data and its limits |
| Database | `FlywayBaselineTest` | A fresh database built from `V1` passes Hibernate's strict schema validation against the entities; an existing database is baselined at V1 and the baseline script is not run against it |

**Frontend:** 55 Vitest unit tests for the pure logic in `lib/` — the OFX/QFX parser (SGML and XML), the receipt-text reader (total vs. subtotal, payment lines), the custom-report builder (date windows, grouping, running balance, rounding), the month-end budget forecast (burn rate, at-risk categories, first-of-month edge case) and anomaly detection (thresholds, per-category history, minimum-data limits). Playwright specs in `frontend/web/tests/e2e` cover the main user flows against a live deployment.

---

## 📁 Project Structure

```
FinTrack-AI-Powered-Personal-Finance-Platform/
├── .github/workflows/ci.yml        4-job CI: backend tests, TypeScript, Vitest, Playwright
├── docker-compose.yml              PostgreSQL + backend + frontend
├── docs/                           Screenshots used in this README
│
├── backend/monolith/src/main/java/com/fintrack/
│   ├── auth/                        JWT, Google sign-in, BCrypt, rate limiter, refresh tokens, accounts
│   ├── transactions/                CRUD, CSV import, recurring, category tagging, summary
│   ├── budgets/                     Budget management, auto-sync spent
│   ├── reports/                     Analytics, 6-month forecast
│   ├── alerts/                      Smart alert engine, budget alert scheduler
│   ├── notifications/               Notification center and settings
│   └── config/                      Security, CORS, global exception handler
│   (plus src/main/resources/db/migration/  Flyway migrations)
│
└── frontend/web/
    ├── app/(app)/                   Auth-gated pages (AuthGate layout)
    │   ├── dashboard/               Stats + AI insights + forecast cards
    │   ├── transactions/            CRUD with bulk ops + CSV import
    │   ├── reports/                 Nine report views incl. custom reports (Recharts)
    │   ├── alerts/                  Smart alert feed with severity filters
    │   ├── notifications/           Transaction-driven notification center
    │   └── …                        goals-budgets, recurring, subscriptions, receipts, net-worth, settings and more
    ├── components/dashboard/
    │   ├── AnomalyInsightsCard.tsx      AI anomaly detection UI
    │   ├── BudgetForecastCard.tsx       Month-end projection UI
    │   ├── MonthEndForecastCard.tsx     Daily burn rate card
    │   └── NextMonthPredictionCard.tsx  3-month weighted prediction UI
    └── lib/utils/
        ├── aiInsights.ts                mean + 2σ statistical engine
        └── budgetForecast.ts            burn rate projection engine
```

---

## 🔧 Troubleshooting

<details>
<summary><strong>Backend won't start — "Connection refused" to PostgreSQL</strong></summary>

Check your `DATABASE_URL` format. It must be a JDBC URL, **not** a plain host:

```bash
# ✅ Correct
export DATABASE_URL=jdbc:postgresql://localhost:5432/fintrack

# ❌ Wrong — will cause HikariPool connection failure
export DATABASE_URL=postgresql://localhost:5432/fintrack
```

Also make sure PostgreSQL is running: `pg_isready -h localhost -p 5432`

</details>

<details>
<summary><strong>Backend won't start — JWT secret error</strong></summary>

`JWT_SECRET` is required and must be **at least 32 bytes** (256 bits for HS256). The app refuses to start if it's missing, too short, or a known public example value (copying a secret from a tutorial or an old README won't work).

```bash
# Generate a safe secret
openssl rand -base64 48
```

With Docker, pass it in: `JWT_SECRET=$(openssl rand -base64 48) docker compose up --build`

</details>

<details>
<summary><strong>Frontend API calls failing — CORS error in browser console</strong></summary>

Make sure `NEXT_PUBLIC_API_URL` in `.env.local` matches where your backend is actually running:

```bash
# Local development
NEXT_PUBLIC_API_URL=http://localhost:8080

# If backend is on Render
NEXT_PUBLIC_API_URL=https://your-app.onrender.com
```

CORS is configured in one place, `corsConfigurationSource()` in `SecurityConfig.java`, as an explicit allow-list: common localhost dev ports (3000–3003, 5173, 8080) plus the deployed Vercel frontend and its preview URLs. Any other origin is rejected, so **if you serve the frontend from a different domain (for example a custom domain), add it to that list and redeploy the backend.**

</details>

<details>
<summary><strong>Port 8080 or 3000 already in use</strong></summary>

```bash
# Find and kill the process on macOS/Linux
lsof -ti:8080 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :8080
taskkill /PID <pid> /F
```

</details>

<details>
<summary><strong>Backend fails at startup after a Flyway change — checksum mismatch or "validate" errors</strong></summary>

Flyway refuses to start if an already-applied migration file was edited. Restore the original file and put the change in a new `V<next>__...sql` migration instead. To get the app running while you sort it out, set `FLYWAY_ENABLED=false`.

</details>

---

## 👥 Contributors

<a href="https://github.com/GanasalaChandana/FinTrack-AI-Powered-Personal-Finance-Platform/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GanasalaChandana/FinTrack-AI-Powered-Personal-Finance-Platform" alt="Contributors" />
</a>

Built and maintained by **[Chandana Ganasala](https://github.com/GanasalaChandana)**.  
Contributions, issues and feature requests are welcome — feel free to open a PR!

---

## License

MIT — see [LICENSE](LICENSE)
