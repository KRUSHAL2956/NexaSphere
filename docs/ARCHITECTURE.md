# NexaSphere — System Architecture

> This document describes the technical architecture of NexaSphere: how the frontend, backend, database, and external services connect and interact.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Monorepo Layout](#2-monorepo-layout)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [Database Design](#5-database-design)
6. [Real-Time Communication](#6-real-time-communication)
7. [Authentication Flow](#7-authentication-flow)
8. [External Services](#8-external-services)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Data Flow Diagram](#10-data-flow-diagram)

---

## 1. High-Level Overview

NexaSphere is a **full-stack web platform** built as a monorepo with two independently deployable runtimes:

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                              │
│              React 18 SPA  (port 5175 dev)                   │
│         Deployed: nexasphere-glbajaj.vercel.app              │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS / WebSocket
          ┌────────────────▼────────────────────┐
          │   Node.js / Express API              │
          │   (port 8080 dev / Vercel serverless)│
          │   + Socket.io WebSocket server       │
          └──┬──────────────┬────────────────────┘
             │              │
    ┌─────────▼──┐   ┌───────▼──────────────────┐
    │ PostgreSQL  │   │ External Services         │
    │ (primary DB)│   │ • Firebase Admin (auth)   │
    └────────────┘   │ • SendGrid (email)         │
                     │ • Google Generative AI     │
                     │ • Sentry (error tracking)  │
                     └──────────────────────────┘
```

---

## 2. Monorepo Layout

```
nexasphere/                  ← repository root
├── src/                     ← React 18 application (Vite)
├── server/                  ← Node.js/Express backend
├── app/                     ← Next.js-compatible error boundaries & SEO
├── admin-dashboard/         ← Standalone admin panel (separate Vite app)
├── e2e/                     ← Playwright end-to-end tests
├── tests/                   ← Additional integration tests
├── scripts/                 ← Utility and data-fetch scripts
├── server-python/           ← Python AI/ML microservice (FastAPI)
├── server-java/             ← Java service (experimental)
├── google-apps-script/      ← Google Workspace integrations
├── public/                  ← Static assets (served by Vite)
└── docs/                    ← Project documentation hub (this folder)
```

**Two separate `package.json` files:**
- `/package.json` — frontend dependencies and scripts
- `/server/package.json` — backend dependencies and scripts

---

## 3. Frontend Architecture

### Technology

| Tool | Role |
|---|---|
| **React 18** | UI rendering, concurrent features |
| **Vite 5** | Dev server, HMR, production bundler |
| **Zustand** | Lightweight global state |
| **Framer Motion** | Animations and transitions |
| **Socket.io-client** | Real-time event subscription |

### Layer Structure

```
src/
├── main.jsx              ← Vite entry point; mounts React app
├── App.jsx / App.tsx     ← Root router, layout shell, global providers
│
├── pages/                ← Route-level components (one per URL path)
│   └── events/           ← e.g. /events → EventsPage.jsx
│
├── components/           ← Reusable UI, grouped by domain
│   ├── ui/               ← Base design system (Button, Card, Modal…)
│   └── events/           ← Domain-specific composites
│
├── hooks/                ← Custom React hooks (data-fetching, effects)
├── context/              ← React Context providers (Socket, Theme, Bookmark)
├── services/             ← API client functions (axios/fetch wrappers)
├── store/                ← Zustand slices (workspace state)
├── lib/                  ← Singleton instances (logger, AI client)
└── utils/                ← Pure functions (SEO, socket, export helpers)
```

### State Management Strategy

| State type | Where it lives |
|---|---|
| Server data (fetched) | Component-local `useState` + custom hooks |
| UI state (theme, modals) | React Context (`src/context/theme/`) |
| Bookmark state | `BookmarkContext` + `localStorage` (via `utils/bookmarkStorage.ts`) |
| Workspace collaboration | Zustand store (`src/store/workspaceStore.ts`) |
| Socket connection | `SocketContext` singleton |

### Path Aliases (Vite)

The following Next.js shims are configured in `vite.config.js` for compatibility:

| Import | Resolves to |
|---|---|
| `next/image` | `src/shared/next-image.jsx` |
| `next/dynamic` | `src/shared/next-dynamic.jsx` |

### Dev Server Proxy

Requests from the frontend to `/api/*` and `/healthz` are proxied to `http://localhost:8080` (the backend) in development. This eliminates CORS issues during local development.

---

## 4. Backend Architecture

### Technology

| Tool | Role |
|---|---|
| **Express 4** | HTTP routing and middleware |
| **Socket.io** | WebSocket server |
| **node-pg-migrate** | Database schema migrations |
| **`pg`** | PostgreSQL driver |
| **Zod** | Request validation |
| **Winston** | Structured logging |
| **Swagger/ReDoc** | API documentation (`/api-docs`) |

### Layer Pattern

```
HTTP Request
     │
     ▼
┌──────────────┐
│   Routes     │  server/routes/*.js   ← Express router definitions
└──────┬───────┘
       │
┌──────▼───────┐
│ Middleware   │  server/middleware/   ← Auth, rate-limit, async wrapper
└──────┬───────┘
       │
┌──────▼───────┐
│ Controllers  │  server/controllers/ ← Parse request, call service, send response
└──────┬───────┘
       │
┌──────▼───────┐
│  Services    │  server/services/    ← Business logic, orchestration
└──────┬───────┘
       │
┌──────▼───────┐
│ Repositories │  server/repositories/← All SQL queries (pg client)
└──────┬───────┘
       │
┌──────▼───────┐
│  PostgreSQL  │
└──────────────┘
```

### Middleware Stack (order matters)

1. `morgan` — HTTP request logging
2. `cors` — CORS header injection (`CORS_ORIGIN` env var)
3. `express.json()` — JSON body parsing
4. `performanceMonitor.js` — Request timing metrics
5. `rateLimiter.js` — Per-IP rate limiting
6. `adminAuthMiddleware.js` — Firebase token verification (admin routes)
7. `asyncHandler.js` — Async error boundary wrapper
8. `errorHandler.js` — Centralised error response formatter

### API Routes

| Route file | Prefix | Description |
|---|---|---|
| `routes/api.js` | `/api` | Core data routes (events, team, forms) |
| `routes/analytics.js` | `/api/analytics` | Activity analytics |
| `routes/monitoring.js` | `/api/monitoring` | Health & performance metrics |
| `routes/documentation.js` | `/api-docs` | Swagger UI / ReDoc |
| `routes/adminStream.js` | `/api/admin/stream` | SSE admin event stream |

---

## 5. Database Design

### Connection

The backend connects to PostgreSQL via the `pg` pool using the `DATABASE_URL` environment variable.  
Connection pooling is configured in `server/config/`.

### Migrations

Migrations are managed by **node-pg-migrate**. All migration files live in `server/migrations/`.

```bash
cd server

# Apply all pending migrations
npm run migrate:latest

# Roll back last migration
npm run migrate:rollback

# Create a new migration
npm run migrate:create -- <migration-name>
```

The migration config file: `server/.postgres_migrations_config.json`

### Key Tables (from schema)

| Table | Purpose |
|---|---|
| `events` | Club events with metadata |
| `core_team` | Core team member profiles |
| `activity_events` | User activity log |
| `forms` | Dynamic form submissions |
| `notifications` | In-app notification queue |

---

## 6. Real-Time Communication

Socket.io is used for:

| Feature | Socket event namespace |
|---|---|
| Live notifications | `/notifications` |
| Collaborative workspace | `/workspace` |
| Admin event stream | SSE via `routes/adminStream.js` |

**Frontend:** `src/utils/socketClient.js` creates a singleton Socket.io client.  
**Context:** `src/context/SocketContext.tsx` provides the connection to all components.  
**Hooks:** `src/hooks/useSocket.js` and `useSocketSync.ts` consume the context.  
**Backend:** `server/sockets/` contains event handler registrations.

---

## 7. Authentication Flow

```
User → Frontend → Firebase Auth SDK (client-side sign-in)
                       │
                 Firebase issues ID Token
                       │
Frontend → Backend API (Authorization: Bearer <token>)
                       │
Backend → Firebase Admin SDK (verifyIdToken)
                       │
              Token valid? → Proceed
              Token invalid? → 401 Unauthorized
```

**Admin routes** require a valid Firebase ID token verified by `server/middleware/adminAuthMiddleware.js`.  
**Public routes** do not require authentication.

---

## 8. External Services

| Service | Used for | Config key(s) |
|---|---|---|
| **Firebase Admin** | Token verification (auth) | `FIREBASE_*` env vars |
| **SendGrid** | Transactional email delivery | `SENDGRID_API_KEY` |
| **Nodemailer** | Alternative SMTP delivery | `SMTP_*` env vars |
| **Google Generative AI** | AI features (roadmap, resume) | `VITE_GEMINI_API_KEY` |
| **TensorFlow.js** | In-browser ML inference | (no config needed) |
| **Sentry (Frontend)** | Browser error tracking | `VITE_SENTRY_DSN` |
| **Sentry (Backend)** | Node error tracking | `SENTRY_DSN` |
| **Cloudflare Turnstile** | Bot-proof form CAPTCHA | `VITE_TURNSTILE_SITE_KEY` |

---

## 9. Environment Variables Reference

### Frontend (`.env.local` at repo root)

| Variable | Required | Description |
|---|---|---|
| `VITE_APP_URL` | Yes | Frontend public URL (e.g. `http://localhost:5175`) |
| `VITE_API_BASE` | Yes | Backend API base URL (e.g. `http://localhost:8080`) |
| `VITE_AI_API_BASE` | No | Python AI service URL (e.g. `http://localhost:8000`) |
| `VITE_SOCKET_URL` | Yes | Socket.io server URL (usually same as API) |
| `VITE_SOCKET_PATH` | No | Socket.io path (default: `/socket.io`) |
| `VITE_GEMINI_API_KEY` | No | Google AI API key for AI features |
| `VITE_SENTRY_DSN` | No | Sentry DSN for frontend error tracking |
| `VITE_TURNSTILE_SITE_KEY` | No | Cloudflare Turnstile site key |
| `VITE_BASE_PATH` | No | Base path override (e.g. `/NexaSphere/` for GitHub Pages) |

### Backend (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: 8080) |
| `CORS_ORIGIN` | Yes | Comma-separated list of allowed origins |
| `FIREBASE_*` | Yes | Firebase Admin SDK credentials |
| `SENDGRID_API_KEY` | No | SendGrid API key for email |
| `SMTP_*` | No | SMTP credentials (alternative to SendGrid) |
| `SENTRY_DSN` | No | Sentry DSN for backend error tracking |

> 📄 Full example files: [`.env.example`](../.env.example) (frontend) · [`server/.env.example`](../server/.env.example) (backend)

---

## 10. Data Flow Diagram

```
User Action (click, form submit)
         │
         ▼
React Component
         │  calls
         ▼
Custom Hook (src/hooks/)
         │  calls
         ▼
Service / API Client (src/services/)
         │  HTTP fetch to /api/*
         ▼
[Vite Dev Proxy → localhost:8080]
         │
         ▼
Express Route (server/routes/)
         │
         ▼
Controller (server/controllers/)
         │
         ▼
Service Layer (server/services/)
         │
         ▼
Repository (server/repositories/)
         │  pg.query(SQL, params)
         ▼
PostgreSQL Database
         │
         ▼
Response JSON
         │
         ▼
React Component → Re-render UI
```

---

*Last updated: May 2026 · Maintained by [@Ayushh-Sharmaa](https://github.com/Ayushh-Sharmaa)*
