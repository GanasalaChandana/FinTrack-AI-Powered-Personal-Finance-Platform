<div align="center">

# FinTrack — AI-Powered Personal Finance Platform

**Full-stack finance app with real-time anomaly detection, predictive budget forecasting, and smart alerts — built to production standards.**

[![Live Demo](https://img.shields.io/badge/▶%20Live%20Demo-fintrack--liart.vercel.app-6366f1?style=for-the-badge&logo=vercel)](https://fintrack-liart.vercel.app)

[![CI](https://img.shields.io/github/actions/workflow/status/GanasalaChandana/fintrack/ci.yml?branch=main&style=flat-square&label=CI&logo=github)](https://github.com/GanasalaChandana/fintrack/actions)
&nbsp;
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot%203.2-Java%2017-6db33f?style=flat-square&logo=spring)](https://spring.io/projects/spring-boot)
&nbsp;
[![Next.js](https://img.shields.io/badge/Next.js%2014-TypeScript-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
&nbsp;
[![Tests](https://img.shields.io/badge/Tests-52%20passing-22c55e?style=flat-square&logo=junit5)](https://github.com/GanasalaChandana/fintrack/actions)
&nbsp;
[![License: MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

</div>

---

## 🧠 Key Highlights

> What separates FinTrack from standard CRUD finance apps:

- **Statistical anomaly detection** — flags unusual spend using mean + 2σ per category. Runs 100% client-side, zero latency, zero API cost
- **Predictive budget forecasting** — daily burn rate × days remaining = end-of-month projection with per-category "at risk" warnings
- **IP-based sliding window rate limiting** — 5 login attempts / 15 min per IP, no Redis needed (`ConcurrentHashMap` + `Deque<Long>`)
- **Refresh token rotation with replay detection** — SHA-256 hashed, single-use; detecting a replayed token revokes ALL active sessions
- **52 backend tests (0 failures)** — Mockito service tests + `@WebMvcTest` controller slice tests with full JWT security mocked

---

## 📸 Demo

👉 **[Live at fintrack-liart.vercel.app](https://fintrack-liart.vercel.app)** — register a free account or explore with sample data.

The dashboard surfaces three AI cards immediately on login:
- **Spending Anomalies** — highlights categories deviating >2σ from your personal baseline with exact % and dollar context
- **Month-End Forecast** — projects your end-of-month total and flags categories on track to overspend
- **Recurring Transactions** — detected subscriptions with projected next charge dates

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🤖 | **AI Anomaly Detection** | Mean + 2σ per category — *"Housing ($1,200) is 277% above your $324 avg — review your largest category"* |
| 📈 | **Budget Forecasting** | Burn rate projection — *"On track to spend $3,855 vs $3,150 budget — $705 over. Housing at 200%."* |
| 🔔 | **Smart Alerts** | 8 rule types: large transactions, spending spikes, category concentration, income tracking |
| 🔄 | **Recurring Detection** | Levenshtein similarity matching identifies subscriptions and projects future bills |
| 🧾 | **Receipt Scanner** | Camera/file upload → Tesseract.js OCR extracts merchant, amount, date |
| 📊 | **Interactive Reports** | 6-tab report suite: overview, trends, comparison, 6-month forecast, budget history, custom |
| 🎯 | **Category Auto-Tagging** | Python FastAPI ML service classifies transactions by merchant + amount |
| 🔐 | **Secure Auth** | JWT HS256 + refresh token rotation + IP rate limiting + BCrypt password hashing |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND  (Vercel)                    │
│                                                          │
│   Next.js 14 · TypeScript · Tailwind CSS · Recharts      │
│                                                          │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│   │  Dashboard  │  │ Transactions │  │    Reports    │  │
│   │  AI Insights│  │  Budgets     │  │    Alerts     │  │
│   └─────────────┘  └──────────────┘  └───────────────┘  │
│                                                          │
│   Client-side AI Engine (zero API calls)                 │
│   ├── aiInsights.ts     → mean + 2σ anomaly detection    │
│   └── budgetForecast.ts → burn rate projection           │
└──────────────────────────┬───────────────────────────────┘
                           │  HTTPS · Bearer JWT
┌──────────────────────────▼───────────────────────────────┐
│                    BACKEND  (Render)                     │
│                                                          │
│   Spring Boot 3.2 · Java 17 · Spring Security · Maven   │
│                                                          │
│   LoginRateLimiter → JwtAuthFilter → Controller          │
│        ↓                  ↓              ↓               │
│   IP sliding window  HS256 verify   @Valid + ownership   │
│   5 req / 15 min     check expiry   enforced per route   │
│                                                          │
│   /api/auth   /api/transactions   /api/budgets           │
│   /api/reports   /api/alerts   /api/users                │
└──────────────────────────┬───────────────────────────────┘
                           │  JPA / Flyway migrations (V1–V9)
┌──────────────────────────▼───────────────────────────────┐
│               PostgreSQL  (Render managed)               │
└──────────────────────────┬───────────────────────────────┘
                           │  HTTP · optional
┌──────────────────────────▼───────────────────────────────┐
│          ML Classifier  (Python · FastAPI)               │
│          POST /classify → spending category              │
└──────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Design

### Request Lifecycle
```
HTTP Request
  → LoginRateLimiter (IP sliding window, 5/15min, no Redis)
  → JwtAuthFilter (extract + verify HS256, check expiry)
  → SecurityContext (userId available to all controllers)
  → Controller (@Valid bean validation)
  → Service (ownership check: userId must match resource)
  → Repository → PostgreSQL
  → JSON Response
```

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
// Sliding window per IP — O(1) amortized
private final ConcurrentHashMap<String, Deque<Long>> attempts;
// Allows 5 attempts in any 15-minute window
// Returns Retry-After header on 429
// Auto-cleans stale IPs every 10 minutes
```

---

## 🧠 AI Engine (client-side, zero API cost)

### Anomaly Detection — `lib/utils/aiInsights.ts`
```
For each spending category (requires ≥3 transactions):

  mean = average transaction amount
  σ    = standard deviation of that category

  deviation = |transaction - mean| / σ

  deviation > 2  →  HIGH    "⚠️ Housing ($1,200) is 277% above your $324 avg.
                              This is your largest category anomaly this month."
  deviation > 1.5 → MEDIUM  "Food & Dining ($340) is 27% above your $268 avg.
                              Consider reducing dining-out frequency."
```

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
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS, Recharts, React Hook Form + Zod, Tesseract.js |
| **Backend** | Spring Boot 3.2, Java 17, Spring Security, Spring Data JPA, Flyway, Maven |
| **Database** | PostgreSQL (Render managed), Flyway migrations V1–V9 |
| **Auth** | JWT HS256, BCrypt, Refresh Token Rotation, IP Rate Limiting |
| **Testing** | JUnit 5, Mockito, @WebMvcTest, MockMvc — 52 tests, 0 failures |
| **ML** | Python, FastAPI, scikit-learn — transaction category classifier |
| **DevOps** | GitHub Actions CI (3 jobs), Vercel (frontend), Render (backend + DB) |

---

## 🔌 API Reference

All protected routes require `Authorization: Bearer <token>` + `X-User-Id: <userId>`.

**Auth**
```
POST   /api/auth/register          Register → { token, refreshToken }
POST   /api/auth/login             Login (IP rate-limited: 5/15min)
POST   /api/auth/refresh           Rotate refresh token (replay-safe)
```

**Transactions**
```
GET    /api/transactions            List (paginated, filter by date/category/type)
POST   /api/transactions            Create + ML auto-tag category
PUT    /api/transactions/{id}       Update (ownership enforced)
DELETE /api/transactions/{id}       Delete (ownership enforced)
GET    /api/transactions/summary    Income / expense / balance totals
```

**Budgets**
```
GET    /api/budgets                 List (?month=YYYY-MM)
POST   /api/budgets                 Create + auto-sync spent from transactions
PUT    /api/budgets/{id}            Update
DELETE /api/budgets/{id}            Delete (ownership enforced)
GET    /api/budgets/summary         Totals, remaining, % used per month
```

**Reports**
```
GET    /api/reports/summary         Period summary (income, expenses, savings rate)
GET    /api/reports/monthly         Month-by-month breakdown
GET    /api/reports/categories      Spend by category with trends
GET    /api/reports/forecast        6-month projection
```

**Alerts**
```
GET    /api/alerts                  List (scoped to userId)
POST   /api/alerts                  Create
POST   /api/alerts/{id}/acknowledge Mark acknowledged
DELETE /api/alerts/{id}             Dismiss (ownership enforced)
```

---

## 🚀 Local Setup

**Prerequisites:** Java 17+, Node.js 18+, PostgreSQL 14+

**Backend**
```bash
cd backend/monolith

export DATABASE_URL=jdbc:postgresql://localhost:5432/fintrack
export DB_USERNAME=postgres
export DB_PASSWORD=yourpassword
export JWT_SECRET=your-256-bit-secret-min-32-chars

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

**ML Classifier (optional)**
```bash
cd ml-classifier
pip install -r requirements.txt
uvicorn main:app --port 8000
```

**Docker (full stack)**
```bash
docker-compose up --build
```

---

## 🧪 Tests

```bash
cd backend/monolith && mvn test
```

52 tests, 0 failures. No database, Kafka, or Redis required locally.

| Test Class | Coverage |
|---|---|
| `TransactionServiceTest` | Create, list, delete, ML tagging, date defaults, userId scoping |
| `TransactionControllerTest` | HTTP status codes, auth headers, limit param, 401/404/204 |
| `BudgetsServiceTest` | syncSpent accuracy, null safety, budget CRUD, ownership |
| `BudgetControllerTest` | REST endpoints, auth enforcement, summary calculations |

---

## 📁 Project Structure

```
fintrack/
├── .github/workflows/ci.yml        3-job CI: tests + TypeScript + Playwright
│
├── backend/monolith/src/main/java/com/fintrack/
│   ├── auth/                        JWT, BCrypt, rate limiter, refresh tokens
│   ├── transactions/                CRUD, ML category tagging, summary
│   ├── budgets/                     Budget management, auto-sync spent
│   ├── reports/                     Analytics, 6-month forecast
│   └── alerts/                      Smart alert engine, 8 rule types
│
├── frontend/web/
│   ├── app/(app)/                   Auth-gated pages (AuthGate layout)
│   │   ├── dashboard/               Stats + AI insights + forecast cards
│   │   ├── transactions/            CRUD with bulk ops + CSV import
│   │   ├── reports/                 6-tab report suite (Recharts)
│   │   ├── alerts/                  Smart alert feed with severity filters
│   │   └── notifications/           Transaction-driven notification center
│   ├── components/dashboard/
│   │   ├── AnomalyInsightsCard.tsx  AI anomaly detection UI
│   │   └── BudgetForecastCard.tsx   Month-end projection UI
│   └── lib/utils/
│       ├── aiInsights.ts            mean + 2σ statistical engine
│       └── budgetForecast.ts        burn rate projection engine
│
└── ml-classifier/                   Python FastAPI — merchant → category
```

---

## License

MIT — see [LICENSE](LICENSE)
