# Contributing to FinTrack

Thank you for your interest in contributing! This document covers everything you need to get the project running locally and submit a pull request.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Running Tests](#running-tests)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Code Style](#code-style)
- [Commit Message Format](#commit-message-format)

---

## Project Structure

```
fintrack/
├── frontend/web/          # Next.js 14 frontend (TypeScript)
│   ├── app/(app)/         # Protected app routes (dashboard, reports, …)
│   ├── components/        # Shared React components
│   ├── lib/               # API client, utilities, AI logic
│   └── tests/e2e/         # Playwright end-to-end tests
│
├── backend/monolith/      # Spring Boot 3.2 backend (Java 17)
│   ├── src/main/java/com/fintrack/
│   │   ├── auth/          # JWT auth, demo mode, rate limiting
│   │   ├── transactions/  # Transaction CRUD + ML tagging
│   │   ├── budgets/       # Budgets & savings goals
│   │   ├── alerts/        # Smart alert engine
│   │   └── reports/       # Analytics & forecasting
│   └── src/test/          # JUnit 5 + Mockito unit tests
│
└── ml-classifier/         # Optional Python FastAPI category tagger
```

---

## Local Development Setup

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Java | 17+ |
| Maven | 3.9+ |
| PostgreSQL | 14+ |
| Python *(optional)* | 3.10+ |

### 1 — Clone & configure environment

```bash
git clone https://github.com/GanasalaChandana/fintrack.git
cd fintrack
cp .env.example .env          # fill in your values
```

Minimum required variables in `.env`:

```
DATABASE_URL=jdbc:postgresql://localhost:5432/fintrack
DB_USERNAME=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=at-least-32-characters-long-secret
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 2 — Start the backend

```bash
cd backend/monolith
mvn spring-boot:run
# API available at http://localhost:8080
```

Flyway migrations run automatically on startup — the database schema is created fresh.

### 3 — Start the frontend

```bash
cd frontend/web
npm install
npm run dev
# App available at http://localhost:3003
```

### 4 — (Optional) Start the ML classifier

```bash
cd ml-classifier
pip install -r requirements.txt
uvicorn main:app --port 8000
```

### Docker (alternative)

```bash
docker-compose up --build
```

---

## Running Tests

### Backend — JUnit 5 (52 tests)

```bash
cd backend/monolith
mvn test
```

Tests use Mockito mocks — no database or external services needed.

### Frontend — TypeScript type-check

```bash
cd frontend/web
npx tsc --noEmit
```

### E2E — Playwright

```bash
cd frontend/web
npx playwright test              # headless
npx playwright test --ui         # interactive UI
npx playwright test --headed     # visible browser
npx playwright test smoke        # smoke suite only
```

The Playwright config starts the Next.js dev server automatically. Auth state is handled by `tests/e2e/auth.setup.ts`.

---

## Submitting a Pull Request

1. **Fork** the repository and create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes.** Keep each PR focused on one concern.

3. **Run the test suites** before pushing:
   ```bash
   # Backend
   cd backend/monolith && mvn test
   # Frontend type-check
   cd frontend/web && npx tsc --noEmit
   ```

4. **Push** your branch and open a PR against `main`.

5. Fill in the PR description with:
   - What changed and why
   - Screenshots for UI changes
   - Any migration or environment variable changes

---

## Code Style

### Frontend (TypeScript / React)

- Strict TypeScript — `"strict": true` is enforced, no `any` escapes
- Components use named exports (`export function MyCard()`)
- Tailwind CSS for styling — avoid inline `style={{}}` unless needed for dynamic values that Tailwind purges in production
- Use `useMemo` / `useCallback` for expensive calculations (see AI insight cards)
- Zod schemas for all form validation

### Backend (Java / Spring Boot)

- Standard Spring Boot layering: `Controller → Service → Repository`
- All endpoints require JWT auth via `@PreAuthorize` or security config — no unauthenticated mutations
- Ownership is validated in every service method (user can only access their own data)
- Use `@Transactional` on multi-step write operations
- Lombok `@Builder`, `@Data`, `@Slf4j` encouraged to reduce boilerplate

---

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build, deps, config changes |

**Examples:**
```
feat: add anomaly detection card to dashboard
fix: guard NaN% in GoalProgressChart when target is 0
test: add Playwright budget flow tests
docs: update setup instructions in README
```

---

## Questions?

Open an issue or reach out via the repository discussions tab.
