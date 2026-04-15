<![CDATA[<div align="center">

# 💰 FinTrack — AI-Powered Personal Finance Platform

**A production-grade, full-stack finance management system with AI-driven spending insights, budget forecasting, and real-time analytics.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-6366f1?style=for-the-badge&logo=vercel)](https://fintrack-liart.vercel.app)
[![Java](https://img.shields.io/badge/Java%2017-Spring%20Boot%203.2-orange?style=for-the-badge&logo=spring)](https://spring.io/projects/spring-boot)
[![TypeScript](https://img.shields.io/badge/TypeScript-Next.js%2014-blue?style=for-the-badge&logo=typescript)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Render%20Managed-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 🚀 What Makes This Different

Most finance apps just record transactions. FinTrack **understands** them.

| Feature | What it does |
|---|---|
| 🤖 **AI Spending Anomaly Detection** | Statistical (mean + 2σ) analysis flags unusual spend per category in real time |
| 📈 **Month-End Budget Forecasting** | Projects end-of-month spend using your daily burn rate — warns before you overspend |
| 🧾 **OCR Receipt Scanner** | Camera/upload → Tesseract.js extracts merchant, amount, date automatically |
| 🔐 **Stateless JWT Auth** | Signed HS256 tokens, BCrypt passwords, no session state on the server |
| 📊 **Interactive Analytics** | Recharts-powered trend charts, category breakdowns, year-over-year comparisons |
| 🔄 **Recurring Transaction Engine** | Detects subscriptions, projects future bills, sends reminder alerts |
| 🎯 **Category Auto-Tagging (ML)** | Python FastAPI micro-service classifies transactions by merchant + amount |

---

## 🖼️ Screenshots

> Dashboard — AI Insights panel with anomaly alerts and month-end forecast

![Dashboard](docs/screenshots/dashboard.png)

> Reports — 6-month spending forecast with trend projection

![Reports](docs/screenshots/reports.png)

> Budget Tracker — live spend vs budget with forecasted overspend warnings

![Budgets](docs/screenshots/budgets.png)

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Browser / Mobile                        │
│  Next.js 14  (App Router · TypeScript · Tailwind CSS)    │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐  │
│  │Dashboard│ │ Reports  │ │Budgets  │ │ AI Insights  │  │
│  └────┬────┘ └────┬─────┘ └────┬────┘ └──────┬───────┘  │
└───────┼───────────┼────────────┼─────────────┼──────────┘
        │           │            │             │
        │       HTTPS + Bearer JWT Token       │
        │                                      │
┌───────▼──────────────────────────────────────▼──────────┐
│              Spring Boot 3.2 REST API (Render)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ /auth    │ │/transact-│ │/budgets  │ │ /reports  │  │
│  │ JWT flow │ │ions CRUD │ │+ alerts  │ │ analytics │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Spring Security Filter Chain                     │  │
│  │  JwtAuthFilter → validates token → sets context   │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │ JDBC / JPA
┌──────────────────────────▼───────────────────────────────┐
│           PostgreSQL (Render managed)                    │
│  users · transactions · budgets · alerts · goals         │
└──────────────────────────────────────────────────────────┘
                           │ HTTP (optional)
┌──────────────────────────▼───────────────────────────────┐
│     ML Classifier  (Python · FastAPI · scikit-learn)     │
│     POST /classify  →  returns spending category         │
└──────────────────────────────────────────────────────────┘
```

---

## 🔐 System Design — JWT Authentication Flow

```
Client                    API Gateway              Database
  │                           │                       │
  │── POST /auth/login ───────▶│                       │
  │   { email, password }     │── SELECT user ────────▶│
  │                           │◀─ BCrypt.matches() ────│
  │                           │                       │
  │◀── 200 { token: "eyJ…" } ─│  (HS256 signed JWT)   │
  │                           │                       │
  │── GET /api/transactions ──▶│                       │
  │   Authorization: Bearer…  │                       │
  │                     JwtAuthFilter:                │
  │                     1. Extract token from header  │
  │                     2. Verify HS256 signature     │
  │                     3. Check expiry (1h default)  │
  │                     4. Set SecurityContext        │
  │                           │── findByUserId() ─────▶│
  │◀── 200 [transactions] ────│◀─ results ─────────────│
```

**Token structure:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1712000000,
  "exp": 1712003600
}
```

**Security decisions:**
- Tokens are stateless — no session storage, scales horizontally
- `X-User-Id` header extracted from validated JWT in filter, never trusted from client
- BCrypt with strength 12 for password hashing
- Refresh token pattern ready for implementation (separate `refresh_tokens` table exists)

---

## 📡 Request Lifecycle

```
1. Client sends HTTP request with Bearer token
         ↓
2. JwtAuthenticationFilter (OncePerRequestFilter)
   ├── Valid token?  → extract userId, set SecurityContextHolder
   └── Invalid/missing → 401 Unauthorized (short-circuits)
         ↓
3. Spring Security authorisation check
   └── Role/ownership enforced at service layer (userId from context)
         ↓
4. Controller → @Valid request body validation
   └── ConstraintViolation → 400 Bad Request (GlobalExceptionHandler)
         ↓
5. Service layer → business logic, calls Repository
         ↓
6. Repository (Spring Data JPA) → parameterised SQL → PostgreSQL
         ↓
7. Response serialised to JSON (Jackson) → back to client
```

---

## 🤖 AI & ML Features — How They Work

### Spending Anomaly Detection
```
For each category:
  mean = average monthly spend over last 6 months
  σ    = standard deviation of monthly spend
  
  If current_month_spend > mean + (2 × σ):
    → flag as HIGH anomaly (unusual spending)
  If current_month_spend > mean + (1 × σ):
    → flag as MEDIUM anomaly (elevated spending)
```
Runs entirely client-side in `lib/utils/aiInsights.ts` — zero extra API calls.

### Budget Forecasting
```
daysElapsed     = today - 1  (avoid div/0)
dailyBurnRate   = totalSpentThisMonth / daysElapsed
projectedTotal  = dailyBurnRate × daysInMonth

Per category:
  projectedCatSpend = (catSpentSoFar / daysElapsed) × daysInMonth
  atRisk = projectedCatSpend > budget
```
Runs client-side in `lib/utils/budgetForecast.ts` — instant, no latency.

### Category Auto-Tagging (ML Classifier)
```
Backend calls Python FastAPI service:
  POST /classify
  { "description": "AMZN*MKTP", "amount": 59.99, "merchant": "Amazon" }
  → { "category": "Shopping", "confidence": 0.91 }

Fallback: rule-based keyword matching if ML service is unavailable.
```

---

## 📊 Scalability Approach

| Concern | Current approach | Production path |
|---|---|---|
| **Statelessness** | JWT — no server-side sessions | Ready for horizontal scaling behind a load balancer |
| **Database** | Single PostgreSQL (Render) | Read replicas + connection pooling (HikariCP, already configured) |
| **AI inference** | Client-side JS (zero latency) | ML service can scale independently as a separate pod |
| **Caching** | Not yet | Redis layer planned (schema for invalidation keys exists) |
| **Message queue** | Not yet | Kafka bootstrap configured (alert fan-out use case) |
| **Monolith → Micro** | Packages already domain-separated | `auth/`, `transactions/`, `budgets/`, `reports/`, `alerts/` → each is a natural microservice boundary |

---

## ⚡ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Spring Boot 3.2 (Java 17) |
| Security | Spring Security + JWT (HS256) + BCrypt |
| Database | PostgreSQL + Spring Data JPA + Flyway migrations |
| Testing | JUnit 5 + Mockito + Spring WebMvcTest (slice tests) |
| Build | Maven |
| Hosting | Render |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| State | Zustand + TanStack Query |
| Forms | React Hook Form + Zod |
| OCR | Tesseract.js |
| AI/ML | Custom statistical algorithms (client-side) |
| Hosting | Vercel |

### ML Service (optional)
| Layer | Technology |
|---|---|
| Framework | Python · FastAPI |
| Model | scikit-learn classifier |
| Deploy | Docker |

---

## 📋 Full API Reference

All protected endpoints require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register user — returns JWT |
| `POST` | `/api/auth/login` | Login — returns JWT |

### Users
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users/profile` | Get profile |
| `PUT` | `/api/users/profile` | Update profile |
| `POST` | `/api/users/change-password` | Change password (BCrypt) |
| `DELETE` | `/api/users/me` | Delete account + all data |

### Transactions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/transactions` | List (paginated, filterable by type/category/date) |
| `POST` | `/api/transactions` | Create — triggers ML category tagging |
| `PUT` | `/api/transactions/{id}` | Update |
| `DELETE` | `/api/transactions/{id}` | Delete (ownership enforced) |
| `GET` | `/api/transactions/summary` | Income / expense totals + balance |

### Budgets
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/budgets` | List (optional `?month=YYYY-MM`) |
| `POST` | `/api/budgets` | Create budget + sync spent from transactions |
| `PUT` | `/api/budgets/{id}` | Update |
| `PATCH` | `/api/budgets/{id}/spent` | Update spent amount |
| `DELETE` | `/api/budgets/{id}` | Delete (ownership enforced) |
| `GET` | `/api/budgets/summary` | Totals, remaining, % used |

### Reports & Analytics
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/summary` | Period summary (income / expenses / savings) |
| `GET` | `/api/reports/monthly` | Month-by-month breakdown |
| `GET` | `/api/reports/categories` | Spend by category |
| `GET` | `/api/reports/forecast` | 6-month projection |

### Alerts
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/alerts` | List alerts |
| `PUT` | `/api/alerts/{id}/read` | Mark read |
| `DELETE` | `/api/alerts/{id}` | Dismiss |

---

## 🧪 Testing

```bash
cd backend/monolith
mvn test
```

**Test coverage:**
- `TransactionControllerTest` — WebMvcTest slice (HTTP contract, auth guard, status codes)
- `TransactionServiceTest` — Mockito unit tests (ML classifier integration, business rules)
- `BudgetControllerTest` — WebMvcTest slice (CRUD, validation, ownership)
- `BudgetsServiceTest` — Mockito unit tests (syncSpent, forecasting, access control)

All tests run against H2 in-memory DB — no Postgres/Kafka/Redis required.

---

## 🚀 Local Development

### Prerequisites
- Java 17+, Node.js 18+, PostgreSQL

### Backend

```bash
cd backend/monolith
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/fintrack
export SPRING_DATASOURCE_USERNAME=postgres
export SPRING_DATASOURCE_PASSWORD=yourpassword
export JWT_SECRET=your-256-bit-base64-secret

mvn spring-boot:run
# → http://localhost:8080
```

### Frontend

```bash
cd frontend/web
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local

npm install
npm run dev
# → http://localhost:3000
```

### ML Classifier (optional)

```bash
cd ml-classifier
pip install -r requirements.txt
uvicorn main:app --port 8000
```

---

## 🐳 Docker (Full Stack)

```bash
docker-compose up --build
# Frontend → http://localhost:3000
# Backend  → http://localhost:8080
# ML       → http://localhost:8000
```

---

## 📁 Project Structure

```
fintrack/
├── backend/
│   └── monolith/
│       └── src/main/java/com/fintrack/
│           ├── auth/           # JWT filter, BCrypt, user registration
│           ├── transactions/   # CRUD, ML category tagging, summary
│           ├── budgets/        # Budget CRUD, syncSpent, alerts
│           ├── reports/        # Analytics, forecasting, trends
│           └── alerts/         # Smart notification engine
│
├── frontend/
│   └── web/
│       ├── app/(app)/          # Authenticated routes
│       │   ├── dashboard/      # AI insights, stat cards, charts
│       │   ├── transactions/   # CRUD + CSV import
│       │   ├── reports/        # Analytics + forecast tab
│       │   ├── insights/       # Full AI insights page
│       │   └── alerts/         # Alert centre
│       ├── components/dashboard/
│       │   ├── AnomalyInsightsCard.tsx   # AI anomaly detection UI
│       │   ├── BudgetForecastCard.tsx    # Month-end forecast UI
│       │   └── ...             # 14 other dashboard widgets
│       └── lib/utils/
│           ├── aiInsights.ts   # Anomaly detection (mean + 2σ)
│           └── budgetForecast.ts # Daily burn rate projection
│
├── ml-classifier/              # Python FastAPI — category auto-tagging
└── docker-compose.yml
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
]]>