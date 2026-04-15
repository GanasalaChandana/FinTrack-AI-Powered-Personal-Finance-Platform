<div align="center">

# FinTrack — AI-Powered Personal Finance Platform

A full-stack finance management system with real-time AI spending insights, budget forecasting, and interactive analytics.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-fintrack--liart.vercel.app-6366f1?style=flat-square&logo=vercel)](https://fintrack-liart.vercel.app)
&nbsp;
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot%203.2-Java%2017-6db33f?style=flat-square&logo=spring)](https://spring.io/projects/spring-boot)
&nbsp;
[![Next.js](https://img.shields.io/badge/Next.js%2014-TypeScript-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
&nbsp;
[![License: MIT](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

</div>

---

## Features

| | Feature | Description |
|---|---|---|
| 🤖 | **AI Anomaly Detection** | Flags unusual spending per category using mean + 2σ statistical analysis |
| 📈 | **Budget Forecasting** | Projects month-end spend from your daily burn rate — warns before you overspend |
| 🧾 | **Receipt Scanner (OCR)** | Camera or file upload → Tesseract.js extracts merchant, amount, date |
| 📊 | **Interactive Reports** | Monthly trends, category breakdowns, 6-month spending forecast |
| 🔐 | **JWT Authentication** | Stateless HS256 tokens, BCrypt passwords, Spring Security filter chain |
| 🔄 | **Recurring Detection** | Identifies subscriptions, projects future bills, sends reminder alerts |
| 🎯 | **Category Auto-Tagging** | Python FastAPI ML service classifies transactions by merchant and amount |

---

## Architecture

```
┌─────────────────────────────────────────┐
│   Next.js 14  (Vercel)                  │
│   Dashboard · Transactions · Reports    │
│   Budgets · Insights · Alerts           │
└──────────────────┬──────────────────────┘
                   │  HTTPS · Bearer JWT
┌──────────────────▼──────────────────────┐
│   Spring Boot 3.2  (Render)             │
│   /api/auth  /api/transactions          │
│   /api/budgets  /api/reports            │
│   /api/alerts  /api/users               │
│                                         │
│   Spring Security → JwtAuthFilter       │
│   → extract userId → set context        │
└─────────────┬───────────────────────────┘
              │  JPA / JDBC
┌─────────────▼───────────────────────────┐
│   PostgreSQL  (Render managed)          │
└─────────────┬───────────────────────────┘
              │  HTTP (optional)
┌─────────────▼───────────────────────────┐
│   ML Classifier  (Python · FastAPI)     │
│   POST /classify → spending category   │
└─────────────────────────────────────────┘
```

---

## JWT Auth Flow

```
Client                     Server                    DB
  │                           │                       │
  ├─ POST /auth/login ────────▶                       │
  │  { email, password }      ├─ SELECT user ─────────▶
  │                           ◀─ BCrypt.verify() ──────┤
  ◀─ 200 { token: "eyJ…" } ──┤                       │
  │                           │                       │
  ├─ GET /api/transactions ───▶                       │
  │  Authorization: Bearer… JwtAuthFilter:            │
  │                         1. Extract token          │
  │                         2. Verify HS256 sig       │
  │                         3. Check expiry           │
  │                         4. Set SecurityContext    │
  │                           ├─ findByUserId() ──────▶
  ◀─ 200 [transactions] ─────┤◀─ results ─────────────┤
```

**Request lifecycle:** `JwtAuthFilter → SecurityContext → Controller (@Valid) → Service → Repository → PostgreSQL → JSON response`

---

## How the AI Works

**Anomaly Detection** — runs client-side in `lib/utils/aiInsights.ts`, zero API calls:
```
mean  = average monthly spend per category (last 6 months)
σ     = standard deviation of that category's spend

spend > mean + 2σ  →  HIGH anomaly
spend > mean + 1σ  →  MEDIUM anomaly
```

**Budget Forecasting** — runs client-side in `lib/utils/budgetForecast.ts`:
```
dailyBurnRate  = totalSpentThisMonth / daysElapsed
projectedTotal = dailyBurnRate × daysInMonth
atRisk         = projectedCategorySpend > budget
```

---

## Tech Stack

**Backend** — Spring Boot 3.2 · Java 17 · Spring Security · PostgreSQL · Spring Data JPA · Flyway · JUnit 5 + Mockito · Maven · Render

**Frontend** — Next.js 14 · TypeScript · Tailwind CSS · Recharts · Zustand · TanStack Query · React Hook Form + Zod · Tesseract.js · Vercel

**ML Service** — Python · FastAPI · scikit-learn · Docker

---

## API Reference

All protected routes require `Authorization: Bearer <token>`.

**Auth**
```
POST   /api/auth/register        Register — returns JWT
POST   /api/auth/login           Login — returns JWT
```

**Transactions**
```
GET    /api/transactions          List (paginated, filterable)
POST   /api/transactions          Create + auto-tag category
PUT    /api/transactions/{id}     Update
DELETE /api/transactions/{id}     Delete (ownership enforced)
GET    /api/transactions/summary  Income / expense totals
```

**Budgets**
```
GET    /api/budgets               List (?month=YYYY-MM)
POST   /api/budgets               Create + sync spent
PUT    /api/budgets/{id}          Update
PATCH  /api/budgets/{id}/spent    Update spent amount
DELETE /api/budgets/{id}          Delete (ownership enforced)
GET    /api/budgets/summary       Totals, remaining, % used
```

**Reports**
```
GET    /api/reports/summary       Period summary
GET    /api/reports/monthly       Month-by-month breakdown
GET    /api/reports/categories    Spend by category
GET    /api/reports/forecast      6-month projection
```

**Alerts**
```
GET    /api/alerts                List alerts
PUT    /api/alerts/{id}/read      Mark read
DELETE /api/alerts/{id}           Dismiss
```

---

## Local Development

**Prerequisites:** Java 17+, Node.js 18+, PostgreSQL

**Backend**
```bash
cd backend/monolith

export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/fintrack
export SPRING_DATASOURCE_USERNAME=postgres
export SPRING_DATASOURCE_PASSWORD=yourpassword
export JWT_SECRET=your-256-bit-base64-secret

mvn spring-boot:run
# http://localhost:8080
```

**Frontend**
```bash
cd frontend/web
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
npm install && npm run dev
# http://localhost:3000
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

## Testing

```bash
cd backend/monolith && mvn test
```

Tests use H2 in-memory DB — no Postgres, Kafka, or Redis needed locally.

- `TransactionControllerTest` · `TransactionServiceTest` — CRUD, ML tagging, auth guards
- `BudgetControllerTest` · `BudgetsServiceTest` — budget logic, syncSpent, access control

---

## Project Structure

```
fintrack/
├── backend/monolith/src/main/java/com/fintrack/
│   ├── auth/            JWT filter, BCrypt, registration
│   ├── transactions/    CRUD, ML category tagging
│   ├── budgets/         Budget management, syncSpent
│   ├── reports/         Analytics, forecasting
│   └── alerts/          Smart notification engine
│
├── frontend/web/
│   ├── app/(app)/       Dashboard, Transactions, Reports, Insights
│   ├── components/dashboard/
│   │   ├── AnomalyInsightsCard.tsx    AI anomaly detection
│   │   └── BudgetForecastCard.tsx     Month-end forecast
│   └── lib/utils/
│       ├── aiInsights.ts              mean + 2σ anomaly logic
│       └── budgetForecast.ts          burn rate projection
│
└── ml-classifier/       Python FastAPI — category auto-tagging
```

---

## License

MIT — see [LICENSE](LICENSE)
