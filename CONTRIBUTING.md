# Contributing to NexaSphere

> 🎓 **GSSoC'26 participants:** This guide is your starting point. Read it fully before opening an issue or PR.  
> Mentor: [@Ayushh-Sharmaa](https://github.com/Ayushh-Sharmaa) · Admin: [@S3DFX-CYBER](https://github.com/S3DFX-CYBER)

---

## Table of Contents

1. [Code of Conduct](#1-code-of-conduct)
2. [How to Get an Issue Assigned](#2-how-to-get-an-issue-assigned)
3. [Development Setup](#3-development-setup)
4. [Project Structure at a Glance](#4-project-structure-at-a-glance)
5. [Branching Strategy](#5-branching-strategy)
6. [Commit Message Format](#6-commit-message-format)
7. [DCO Sign-Off Requirement](#7-dco-sign-off-requirement)
8. [Pull Request Process](#8-pull-request-process)
9. [Code Quality Standards](#9-code-quality-standards)
10. [Running Tests](#10-running-tests)
11. [Label System](#11-label-system)
12. [Getting Help](#12-getting-help)

---

## 1. Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).  
By participating you agree to uphold it. Please report unacceptable behaviour to the maintainers.

---

## 2. How to Get an Issue Assigned

1. **Browse open issues** — look for ones labelled `good first issue` or `level:beginner`
2. **Comment `/assign`** on the issue you want to work on
3. The bot will evaluate your eligibility:
   - `level:beginner` → auto-assigned immediately
   - `level:intermediate` → requires GitHub account ≥ 30 days old
   - `level:advanced` → requires ≥ 1 merged PR in this repo
4. **Wait for confirmation** — do NOT start coding until you are officially assigned
5. **Open your PR within 7 days** — inactive assignments are auto-unassigned

> ⚠️ PRs submitted without being assigned to the linked issue will be **automatically closed** by our bot.

---

## 3. Development Setup

> 📖 Full step-by-step guide with troubleshooting: [docs/SETUP.md](./docs/SETUP.md)

### Prerequisites

- **Node.js** `>= 20.0.0` — check with `node -v`
- **npm** `>= 10.0.0` — check with `npm -v`
- **PostgreSQL** `>= 14` — for backend development
- **Git** with your identity configured

### Fork & Clone

```bash
# 1. Fork the repo on GitHub, then clone YOUR fork
git clone https://github.com/<your-username>/NexaSphere-GSSOc.git
cd NexaSphere-GSSOc

# 2. Add the upstream remote
git remote add upstream https://github.com/Piyush025s07/NexaSphere-GSSOc.git
```

### Frontend Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Fill in values — at minimum set:
#   VITE_API_BASE=http://localhost:8080
#   VITE_APP_URL=http://localhost:5175

# Start development server
npm run dev
# → http://localhost:5175
```

### Backend Setup (if your issue touches the server)

```bash
cd server

# Install server dependencies
npm install

# Copy backend env template
cp .env.example .env
# Fill in DATABASE_URL, Firebase credentials, SendGrid key

# Run database migrations
npm run migrate:latest

# Start the backend
npm run dev
# → http://localhost:8080
```

### Pre-commit Hooks

The project uses **Husky** + **lint-staged**. On every `git commit`, the following run automatically on staged files:

- `prettier --write` — auto-formats JS/JSX/TS/TSX
- `eslint --fix` — fixes lint violations

Make sure `npm install` completed (it installs Husky automatically via the `prepare` script).

---

## 4. Project Structure at a Glance

```
nexasphere/
├── src/          ← React 18 frontend (Vite)
│   ├── components/    ← Reusable UI
│   ├── pages/         ← Route-level views
│   ├── hooks/         ← Custom hooks
│   ├── context/       ← React Context providers
│   ├── services/      ← API client layer
│   ├── store/         ← Zustand global state
│   ├── lib/           ← Core utilities
│   └── utils/         ← Pure helper functions
│
├── server/       ← Node.js/Express API
│   ├── routes/        ← Express route definitions
│   ├── controllers/   ← Request handlers
│   ├── services/      ← Business logic
│   ├── repositories/  ← DB queries
│   ├── middleware/    ← Auth, rate-limit, errors
│   └── migrations/   ← SQL schema migrations
│
├── e2e/          ← Playwright end-to-end tests
├── src/__tests__ ← Vitest unit tests
└── docs/         ← Full project documentation
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full architecture diagram.

---

## 5. Branching Strategy

Always branch off `main`. Use the following naming convention:

| Prefix | When to use | Example |
|---|---|---|
| `feat/` | New feature or enhancement | `feat/roadmap-pdf-export` |
| `fix/` | Bug fix | `fix/notification-bell-overflow` |
| `docs/` | Documentation only | `docs/update-setup-guide` |
| `chore/` | Maintenance, deps, config | `chore/upgrade-vite-v6` |
| `test/` | Adding or fixing tests | `test/add-search-hook-tests` |
| `refactor/` | Code refactor (no behaviour change) | `refactor/extract-socket-utils` |

```bash
# Always sync with upstream before branching
git fetch upstream
git checkout main
git merge upstream/main

# Create your branch
git checkout -b feat/your-feature-name
```

---

## 6. Commit Message Format

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description>

[optional body]

[optional footer — include Signed-off-by here]
```

### Types

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Formatting, no logic change |
| `refactor` | Code restructuring |
| `test` | Adding/fixing tests |
| `chore` | Build process, dependencies |
| `perf` | Performance improvement |

### Examples

```bash
feat(roadmap): add PDF export functionality

Implements jsPDF-based export with multi-page support.
Closes #42

Signed-off-by: Your Name <your@email.com>
```

```bash
fix(search): debounce input to prevent excessive API calls

Signed-off-by: Your Name <your@email.com>
```

---

## 7. DCO Sign-Off Requirement

Every commit **must** include a `Signed-off-by` line. This is enforced by our CI bot.

```bash
# Add sign-off to a commit automatically
git commit -s -m "feat: your commit message"

# Or amend the most recent commit
git commit --amend --signoff

# Fix multiple commits before pushing
git rebase HEAD~<N> --signoff
```

The sign-off certifies you agree to the [Developer Certificate of Origin](https://developercertificate.org/).

---

## 8. Pull Request Process

### Before Opening a PR

- [ ] Your branch is up-to-date with `upstream/main`
- [ ] `npm run build` completes without errors
- [ ] All Vitest unit tests pass: `npm run test`
- [ ] If you touched user flows, run E2E: `npm run test:e2e`
- [ ] ESLint and Prettier pass (pre-commit hook ran clean)
- [ ] All commits have `Signed-off-by:` line (DCO)

### The 3-Stage Review Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  Stage 1 — Automated Checks (GitHub Actions)                │
│  • PR has Closes #N, description, and checklist             │
│  • DCO sign-off on every commit                             │
│  • Spam/duplicate detection                                  │
│  • PR size label applied                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ ✅ All pass
┌────────────────────────▼────────────────────────────────────┐
│  Stage 2 — Mentor Review (@Ayushh-Sharmaa)                  │
│  • Code quality and completeness review                     │
│  • Mentor comments /approve-pr or /lgtm                     │
│  • Timeline: 24–48 hours                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ ✅ Mentor approved
┌────────────────────────▼────────────────────────────────────┐
│  Stage 3 — Admin Approval & Merge (@S3DFX-CYBER)            │
│  • Final quality gate                                       │
│  • Timeline: 48–72 hours after Stage 2                     │
│  • GSSoC points awarded on merge                           │
└─────────────────────────────────────────────────────────────┘
```

### PR Title & Description

- Title: follow the same Conventional Commits format as your commits
- Description must include:
  - What the PR does (non-empty description)
  - `Closes #<issue-number>`
  - A checklist with `- [ ]` items

### Do NOT

- Push directly to `main` (branch protection is enabled)
- Force-push after a review has been submitted
- Open a PR without being assigned to the linked issue
- Include unrelated changes in a single PR

---

## 9. Code Quality Standards

### General

- Prefer small, focused functions (≤ 30 lines where possible)
- Remove dead code and stale config files
- Always update documentation alongside behaviour changes
- No `console.log` in production code — use the `logger` utility

### Frontend

- Components in `src/components/` must be reusable — no page-specific logic
- All data fetching lives in `src/services/` or custom hooks in `src/hooks/`
- Global state goes through Zustand stores in `src/store/`
- Use `src/utils/seoUtils.js` for all meta tag management

### Backend

- Route handlers stay thin — delegate to controllers → services → repositories
- All database queries go through `server/repositories/`
- Validate all incoming request data with Zod schemas in `server/schemas/`
- Wrap async route handlers with `server/middleware/asyncHandler.js`
- Never expose raw database errors to clients

### File Naming

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase | `EventCard.jsx` |
| Hooks | camelCase with `use` prefix | `useSearch.js` |
| Utilities | camelCase | `socketClient.js` |
| Server files | camelCase | `eventsController.js` |
| CSS files | Match component name | `EventCard.css` |

---

## 10. Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests once
npm run test

# Run in watch mode
npm run test:watch

# Run with browser UI
npm run test:ui
```

Tests live in `src/__tests__/` and alongside source files as `*.test.js`.

### End-to-End Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run in debug/headed mode
npm run e2e:debug
```

E2E tests live in `e2e/`. Run these if you touched critical user flows (auth, forms, navigation).

### Backend Tests (Jest)

```bash
cd server
npm run test           # Run all tests with coverage
npm run test:watch     # Run in watch mode
```

---

## 11. Label System

| Label | Meaning |
|---|---|
| `level:beginner` | 10 GSSoC points — auto-assignable |
| `level:intermediate` | 25 points — needs 30-day account |
| `level:advanced` | 45 points — needs 1 merged PR |
| `level:critical` | 60 points — needs 1 merged PR |
| `type:bug` | Bug fix |
| `type:feature` | New feature |
| `type:docs` | Documentation |
| `type:design` | UI/UX improvement |
| `type:refactor` | Refactoring |
| `type:testing` | Tests |
| `gssoc:approved` | Contribution scored & approved |
| `gssoc:spam` | Spam — auto-closed |
| `good first issue` | Perfect for first-timers |
| `needs-more-info` | Author needs to add information |
| `pending-assignment` | Waiting for mentor approval |

---

## 12. Getting Help

| Channel | Use for |
|---|---|
| **Issue comments** | Questions about a specific issue |
| **PR comments** | Questions about your PR feedback |
| **[@Ayushh-Sharmaa](https://github.com/Ayushh-Sharmaa)** | Mentor — ping after 48h of no response |
| **[@S3DFX-CYBER](https://github.com/S3DFX-CYBER)** | Admin — only for escalated cases |

> ⚠️ Pinging maintainers more than twice without a 48h wait triggers the ping-spam bot. Be patient!

---

*Thank you for contributing to NexaSphere! Every PR makes this platform better for thousands of students. 🚀*