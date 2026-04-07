# FinTrack — Personal Finance Tracker

A full-stack personal finance application for tracking transactions, managing budgets, scanning receipts, and visualising spending patterns.

**Live demo:** [fintrack-liart.vercel.app](https://fintrack-liart.vercel.app)

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Spring Boot 3.2 (Java 17) |
| Database | PostgreSQL (Render managed) |
| Auth | JWT (HS256) + BCrypt passwords |
| Build | Maven |
| Hosting | Render (free tier) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| State | Zustand + TanStack Query |
| OCR | Tesseract.js |
| Hosting | Vercel |

---

## Architecture

Single Spring Boot monolith serving a REST API, consumed by a Next.js frontend.

```
┌─────────────────────────────────┐
│   Next.js (Vercel)              │
│   - Dashboard, Transactions     │
│   - Budgets, Reports, Alerts    │
│   - Receipt Scanner (OCR)       │
└────────────┬────────────────────┘
             │ HTTPS / REST
┌────────────▼────────────────────┐
│   Spring Boot Monolith (Render) │
│   /api/auth        – JWT auth   │
│   /api/users       – profiles   │
│   /api/transactions– CRUD       │
│   /api/budgets     – budgets    │
│   /api/reports     – analytics  │
│   /api/alerts      – alerts     │
└────────────┬────────────────────┘
             │ JDBC
┌────────────▼────────────────────┐
│   PostgreSQL (Render managed)   │
└─────────────────────────────────┘
```

---

## Features

- **Dashboard** — spending summary, recent transactions, quick stats
- **Transactions** — add, edit, delete, filter, bulk CSV/Excel import
- **Receipt Scanner** — camera or file upload, Tesseract.js OCR extracts merchant, amount, date
- **Budgets** — per-category monthly budgets with live spent tracking
- **Reports** — monthly/yearly charts, category breakdown, trend analysis
- **Alerts** — smart notifications based on spending patterns
- **Insights** — AI-style spending observations
- **Recurring Transactions** — manage subscriptions and repeating expenses
- **Settings** — profile, password change, data export (JSON), delete account

---

## Local Development

### Prerequisites
- Java 17+
- Node.js 18+
- PostgreSQL (local or Render connection string)

### Backend

```bash
cd backend/monolith

# Set environment variables (or create application-local.properties)
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/fintrack
export SPRING_DATASOURCE_USERNAME=postgres
export SPRING_DATASOURCE_PASSWORD=yourpassword
export JWT_SECRET=your-256-bit-secret

mvn spring-boot:run
# → http://localhost:8080
```

### Frontend

```bash
cd frontend/web

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local

npm install
npm run dev
# → http://localhost:3000
```

---

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/users/profile` | Get current user profile |
| PUT | `/api/users/profile` | Update profile |
| POST | `/api/users/change-password` | Change password |
| DELETE | `/api/users/me` | Delete account |
| GET | `/api/transactions` | List transactions (paginated) |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/{id}` | Update transaction |
| DELETE | `/api/transactions/{id}` | Delete transaction |
| GET | `/api/budgets` | List budgets (optional `?month=YYYY-MM`) |
| POST | `/api/budgets` | Create budget |
| PUT | `/api/budgets/{id}` | Update budget |
| DELETE | `/api/budgets/{id}` | Delete budget |
| GET | `/api/reports/summary` | Spending summary |
| GET | `/api/alerts` | List alerts |

All protected endpoints require `Authorization: Bearer <token>`.

---

## Deployment

### Backend (Render)
1. Connect GitHub repo to Render
2. Create a new **Web Service** → select `backend/monolith`
3. Build command: `mvn clean package -DskipTests`
4. Start command: `java -jar target/fintrack-monolith-*.jar`
5. Set environment variables in Render dashboard:
   - `SPRING_DATASOURCE_URL`
   - `SPRING_DATASOURCE_USERNAME`
   - `SPRING_DATASOURCE_PASSWORD`
   - `JWT_SECRET`

### Frontend (Vercel)
1. Connect GitHub repo to Vercel
2. Root directory: `frontend/web`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL

---

## Project Structure

```
fintrack/
├── backend/
│   └── monolith/               # Spring Boot application
│       └── src/main/java/com/fintrack/
│           ├── auth/           # JWT auth, user management
│           ├── transactions/   # Transaction CRUD
│           ├── budgets/        # Budget management
│           ├── reports/        # Analytics & reports
│           └── alerts/         # Alerts & notifications
├── frontend/
│   └── web/                    # Next.js application
│       └── app/
│           ├── (app)/          # Authenticated routes
│           ├── auth/           # Login / Register
│           └── settings/       # User settings
└── ml-classifier/              # Python FastAPI (receipt ML, optional)
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.
