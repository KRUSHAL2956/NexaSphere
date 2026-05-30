# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| Latest (`main` branch) | ✅ Yes |
| Any previous release | ❌ No |

Only the current `main` branch receives security patches. Please ensure you are running the latest version before reporting.

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Publicly disclosing a vulnerability before it is fixed puts the entire user community at risk.

### How to Report

Contact the maintainers privately through one of these channels:

| Contact | Handle |
|---|---|
| Project Admin | [@S3DFX-CYBER](https://github.com/S3DFX-CYBER) |
| Mentor | [@Ayushh-Sharmaa](https://github.com/Ayushh-Sharmaa) |

Send a direct message on GitHub or reach out via the GSSoC Discord (project channel) with the subject line: **[SECURITY] NexaSphere — Vulnerability Report**.

### What to Include

Please provide as much of the following as possible:

- **Description** — A clear description of the vulnerability and its potential impact
- **Affected component** — Frontend, backend API, database layer, authentication, etc.
- **Steps to reproduce** — A minimal proof-of-concept or step-by-step instructions
- **Environment** — Browser/OS/Node.js version if relevant
- **Suggested fix** — Any potential mitigations or patches you are aware of

---

## Response Timeline

| Milestone | Target |
|---|---|
| Acknowledgement of report | Within **48 hours** |
| Initial assessment and severity rating | Within **5 business days** |
| Fix deployed to `main` | Depends on severity (Critical: 72h, High: 1 week, Medium/Low: next release) |
| Public disclosure | After fix is confirmed deployed |

We follow a **coordinated disclosure** policy. We will credit the reporter in the changelog unless they prefer to remain anonymous.

---

## Scope

The following are **in scope** for vulnerability reports:

- Authentication bypass or privilege escalation
- SQL injection or other database attacks
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Sensitive data exposure (API keys, user PII)
- Server-Side Request Forgery (SSRF)
- Remote Code Execution (RCE)
- Insecure direct object references

The following are **out of scope**:

- Vulnerabilities in third-party dependencies (report to their maintainers directly)
- Issues requiring physical access to a device
- Social engineering attacks
- Denial of Service without a demonstrated exploit
- Missing security headers that don't have a concrete exploitable impact

---

## Security Best Practices for Contributors

When contributing code, please keep these in mind:

- **Never commit secrets** — no API keys, passwords, or tokens in code (use `.env` files)
- **Validate all inputs** — use Zod schemas on the backend for every external input
- **Keep dependencies updated** — run `npm audit` and address high/critical advisories
- **Follow least-privilege** — request only the permissions your code needs
- **Use parameterised queries** — never concatenate user input into SQL strings
