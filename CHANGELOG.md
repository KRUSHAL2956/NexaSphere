# Changelog

All notable changes to NexaSphere will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- GSSoC'26 automation suite: 39 GitHub Actions workflows covering assignment, PR validation, spam detection, mentor tracking, and leaderboards
- `mentor:Ayushh-Sharmaa` auto-label on review request, review submission, and issue assignment
- Mentor label fallback on merged PRs and closed issues
- Issue context assignment bot with eligibility checks (account age, merged PR count, active assignment limit)
- Auto-unassignment for contributors inactive for 7+ days
- Assignment timeout escalation to Project Admin after 24h
- PR size labels (XS/S/M/L/XL) based on lines changed
- DCO sign-off enforcement on all commits
- Duplicate issue/PR detection using keyword overlap scoring
- Ping-spam detection and warning system
- Stale PR detection (warn at 14 days, close at 21 days)
- First-time contributor welcome bots for issues and PRs
- Priority label manager (high/medium/low) based on title keywords
- Contributor leaderboard auto-updated on every merged PR
- Unresolved review conversation reminders
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
- `CONTRIBUTING.md` — comprehensive contributor guide
- `docs/ARCHITECTURE.md` — full system architecture documentation
- `docs/SETUP.md` — step-by-step setup guide with troubleshooting
- `docs/WORKFLOWS.md` — complete GitHub Actions workflow reference
- `server/README.md` — backend documentation

### Changed
- `README.md` — complete rewrite with accurate tech stack (Vite + React 18, not Next.js), correct dev server port (5175), accurate folder structure, and proper setup instructions
- `CONTRIBUTING.md` — expanded from 36 lines to full contributor guide
- `.github/pull_request_template.md` — updated with DCO, pipeline stages, and GSSoC requirements
- `.gitignore` — added entries to prevent scratch/debug files from being committed

### Fixed
- README incorrectly stated Next.js, Tailwind CSS, Prisma ORM, Upstash Redis, and NextAuth.js
- README incorrectly stated dev server port as 3000 (actual: 5175 for frontend, 8080 for backend)
- Clone URL in README pointed to wrong repository

---

## [0.1.0] — 2025-12-01

### Added
- Initial project scaffolding and repository setup
- React 18 + Vite 5 frontend foundation
- Node.js + Express backend with PostgreSQL integration
- Firebase Admin authentication
- Socket.io real-time communication layer
- Core UI components: navigation, dashboard, events, portfolio
- Gamification system (points, badges)
- AI-powered roadmap builder
- Resume analyser with Google Generative AI
- Event calendar with FullCalendar
- Collaborative workspace module
- Admin dashboard with analytics
- Swagger/ReDoc API documentation
- Sentry error monitoring (frontend + backend)
- Playwright E2E test suite
- Vitest unit test suite
- Husky + lint-staged pre-commit hooks
- Vercel deployment configuration

---

[Unreleased]: https://github.com/Piyush025s07/NexaSphere-GSSOc/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Piyush025s07/NexaSphere-GSSOc/releases/tag/v0.1.0
