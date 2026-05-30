# NexaSphere — GitHub Actions Workflows Reference

> Complete index of all **39 GitHub Actions workflows** in `.github/workflows/`.  
> Every workflow uses `actions/github-script@v8` and `pull_request_target` (for fork safety).

---

## Table of Contents

1. [Assignment & Issue Management](#1-assignment--issue-management)
2. [PR Validation & Review Pipeline](#2-pr-validation--review-pipeline)
3. [Spam & Quality Detection](#3-spam--quality-detection)
4. [Mentor System](#4-mentor-system)
5. [Leaderboard & Contributors](#5-leaderboard--contributors)
6. [Label Management](#6-label-management)
7. [Bots & Notifications](#7-bots--notifications)
8. [Code Quality & CI](#8-code-quality--ci)
9. [Deployment](#9-deployment)
10. [Design Principles](#10-design-principles)

---

## 1. Assignment & Issue Management

### `issue-context-assignment.yml`
**Trigger:** `issue_comment` → created (when comment starts with `/assign`)  
**What it does:**
- Validates commenter has fewer than 3 active open assignments
- Checks if issue is already assigned → rejects
- `level:beginner` → auto-assigns immediately
- `level:intermediate` → requires GitHub account ≥ 30 days old
- `level:advanced` / `level:critical` → requires ≥ 1 merged PR in repo
- All other levels → queues for mentor approval with `pending-assignment` label

**Labels applied:** `assigned`, `pending-assignment`

---

### `unassign-issues.yml`
**Trigger:** `schedule` (daily 02:00 UTC) + `workflow_dispatch`  
**What it does:**
- Scans all open issues with assignees
- For each assignee inactive for 7+ days (no comments since assignment):
  - Removes them from the issue
  - Posts an explanation comment
- Skips collaborators with write/admin/maintain permission

---

### `assignment-timeout-escalation.yml`
**Trigger:** `schedule` (every 6 hours) + `workflow_dispatch`  
**What it does:**
- Finds issues with `pending-assignment` label whose bot comment is 24h+ old
- If no mentor responded: adds `escalated` label, pings @S3DFX-CYBER

---

### `gssoc-good-first-issue-assign.yml`
**Trigger:** `issue_comment` → created + `issues` → labeled  
**What it does:**
- On `/assign`, `assign me`, `can i work` comment → assigns if `good first issue` is unclaimed
- On `good first issue` label applied → posts help-wanted banner with points info

---

### `issue-validate.yml`
**Trigger:** `issues` → opened, edited  
**What it does:**
- Checks body for required sections: Description, Steps to Reproduce, Expected Behavior
- Missing sections → adds `needs-more-info` + guidance comment
- All present → adds `valid-issue`

---

## 2. PR Validation & Review Pipeline

### `pr-validator.yml`
**Trigger:** `pull_request_target` → opened, edited, synchronize  
**What it does:**
- Checks PR body has `Closes #N` (linked issue)
- Checks description section is non-empty
- Checks checklist (`- [ ]` items) is present
- Failure → adds `needs-pr-fixes` + comment listing issues
- Pass → adds `pr-valid`

---

### `dco-helper.yml`
**Trigger:** `pull_request_target` → opened, synchronize  
**What it does:**
- Fetches all commits in the PR
- Checks each commit message for `Signed-off-by:` line
- Missing → adds `dco-missing`, posts fix instructions
- All signed → adds `dco-ok`, removes `dco-missing`

---

### `pr-size-label.yml`
**Trigger:** `pull_request_target` → opened, synchronize  
**What it does:**
- Calculates `additions + deletions`
- Removes old size label, applies new:

| Label | Lines changed |
|---|---|
| `size/XS` | < 10 |
| `size/S` | 10–49 |
| `size/M` | 50–149 |
| `size/L` | 150–499 |
| `size/XL` | 500+ |

---

### `gssoc-pr-spam-check.yml`
**Trigger:** `pull_request_target` → opened, reopened, edited, synchronize  
**What it does:**
- Extracts `Closes #N` from PR body
- No linked issue → adds `gssoc:no-linked-issue` + `gssoc:spam` + closes PR
- Linked issue exists but author not assigned → adds `gssoc:not-assigned` + closes PR
- Valid → removes all spam labels

---

### `dismiss-change-requests-on-commit.yml`
**Trigger:** `pull_request_target` → synchronize  
**What it does:**
- Dismisses all `CHANGES_REQUESTED` reviews when new commits are pushed
- Message: "Dismissed due to new commits — please re-review"

---

### `stale-pr.yml`
**Trigger:** `schedule` (daily 03:00 UTC) + `workflow_dispatch`  
**What it does:**
- 14 days no activity → adds `stale` + warning comment
- 21 days no activity → closes PR with explanation
- Skips PRs with `no-stale` label

---

### `gssoc-auto-merge.yml`
**Trigger:** PR events  
**What it does:** Automated merge when all conditions are met (CI pass + pa-approved label)

---

## 3. Spam & Quality Detection

### `detect-ping-spam.yml`
**Trigger:** `issue_comment` → created  
**What it does:**
- Counts how many times commenter has @-mentioned maintainers in the thread
- 2nd ping → posts reminder about 24–72h wait policy
- 3rd+ ping → adds `ping-spam` label

**Maintainers monitored:** `@S3DFX-CYBER`, `@Ayushh-Sharmaa`

---

### `duplicate-issue.yml`
**Trigger:** `issues` → opened  
**What it does:**
- Tokenises new issue title and body
- Compares against all open issues using keyword overlap scoring
- Score ≥ 60% → adds `possible-duplicate` + lists similar issues
- Does NOT auto-close

---

### `duplicate-pr.yml`
**Trigger:** `pull_request_target` → opened  
**What it does:**
- Extracts `Closes #N` linked issue from PR body
- Searches for other open PRs referencing the same issue
- Found → adds `duplicate-pr` + warning comment

---

### `gssoc-auto-label-critical.yml`
**Trigger:** Issues/PRs labeled  
**What it does:** Handles `level:critical` label automation

---

## 4. Mentor System

### `mentor-label-auto-apply.yml` ⭐
**Trigger:** `pull_request_target` → review_requested | `pull_request_review` → submitted | `issues` → assigned  
**What it does:**
- If `@Ayushh-Sharmaa` is the requested reviewer → applies `mentor:Ayushh-Sharmaa` to PR
- If `@Ayushh-Sharmaa` submits a review → applies `mentor:Ayushh-Sharmaa` to PR
- If `@Ayushh-Sharmaa` is assigned to an issue → applies `mentor:Ayushh-Sharmaa` to issue
- Creates the label (color: `6f42c1`) if it doesn't exist
- Skips if label already present

---

### `mentor-label-fallback.yml` ⭐
**Trigger:** `pull_request_target` → closed (merged only) | `issues` → closed  
**What it does:**
- Checks if any `mentor:*` label exists on the closed item
- If none → creates and applies `mentor:Ayushh-Sharmaa` as fallback
- For PRs only: posts an informational comment about the fallback attribution

---

### `gssoc-auto-assign-reviewer.yml`
**Trigger:** PR events  
**What it does:** Auto-requests @Ayushh-Sharmaa as reviewer on new PRs

---

## 5. Leaderboard & Contributors

### `leaderboard.yml`
**Trigger:** `pull_request_target` → closed (merged) + `workflow_dispatch`  
**What it does:**
- Fetches all merged PRs, groups by contributor login
- Generates ranked markdown table with avatars
- Posts/updates a single comment on the designated leaderboard issue
- Excludes bots and maintainer accounts

---

### `gssoc-auto-label-on-merge.yml`
**Trigger:** `pull_request_target` → closed (merged)  
**What it does:**
- Applies `gssoc:approved` to merged PR (if not spam)
- Syncs difficulty level label from PR → linked issue
- Propagates `type:*` labels from PR to issue
- Applies `mentor:Ayushh-Sharmaa` if missing
- Posts merge success comment on the linked issue

---

### `add-contributor.yml`
**Trigger:** `pull_request_target` → closed (merged) + `workflow_dispatch`  
**What it does:**
- Reads `README.md`
- If contributor's avatar is not between `<!-- CONTRIBUTORS_START -->` and `<!-- CONTRIBUTORS_END -->` markers, inserts it
- Commits and pushes the README change with `[skip ci]`

---

## 6. Label Management

### `gssoc-label-setup.yml`
**Trigger:** `workflow_dispatch`  
**What it does:** Bootstraps all GSSoC label definitions in the repository

---

### `gssoc-issue-labels.yml`
**Trigger:** `issues` → labeled/unlabeled  
**What it does:** Validates issue label consistency

---

### `issue-label-enforce.yml`
**Trigger:** `issues` → opened, labeled, unlabeled  
**What it does:**
- Checks for at least one `level:*` label AND one `type:*` label
- Missing → adds `needs-labels` + comment
- Both present → removes `needs-labels`

---

### `priority-label-manager.yml`
**Trigger:** `issues` + `pull_request_target` → opened, edited  
**What it does:**
- Scans title + body for keywords
- `crash`, `security`, `urgent` → `priority:high`
- `bug`, `fix`, `error` → `priority:medium`
- Otherwise → `priority:low`
- Removes old `priority:*` before applying new one

---

### `gssoc-auto-label-beginner.yml` / `intermediate.yml` / `advanced.yml`
**Trigger:** `issues` → labeled  
**What it does:** Handles level-specific label logic and point assignments

---

## 7. Bots & Notifications

### `gssoc-auto-label-on-open.yml`
**Trigger:** `issues` → opened, reopened | `pull_request_target` → opened, reopened  
**What it does:**
- Bootstraps all label definitions if missing
- Issues: applies `GSSoC'26` + `level:beginner` (default) + `mentor:Ayushh-Sharmaa` + welcome comment
- PRs: applies `GSSoC'26` + auto-detected level (from diff size) + `mentor:Ayushh-Sharmaa` + welcome comment

---

### `welcome-issue-bot.yml`
**Trigger:** `issues` → opened  
**What it does:**
- Checks if author has any prior issues/PRs in the repo
- First issue → posts welcome comment with links to CONTRIBUTING, docs, Discord

---

### `pr-welcome-bot.yml`
**Trigger:** `pull_request_target` → opened  
**What it does:**
- Checks if it's the author's first PR
- First PR → posts 3-stage review pipeline explanation with timeline expectations

---

### `remind-unresolved-conversations.yml`
**Trigger:** `schedule` (daily 09:00 UTC) + `workflow_dispatch`  
**What it does:**
- Finds open PRs with no activity for 48h+
- Uses GraphQL to check for unresolved review threads
- Unresolved threads found → posts reminder comment to PR author
- Rate-limits to one reminder per 48h window per PR

---

### `spam-escalation.yml`
**Trigger:** `issues` + `pull_request_target` → labeled  
**What it does:**
- Fires when `spam` or `gssoc:spam` label is applied
- Removes contributor's assignment from the issue
- Posts notification comment to author
- Pings @S3DFX-CYBER for awareness

---

### `auto-add-gssoc26-label.yml` / `auto-add-nsoc26-label.yml`
**Trigger:** `issues` → opened  
**What it does:** Ensures `GSSoC'26` / `NSOC'26` label is applied to all new issues

---

## 8. Code Quality & CI

### `ci.yml`
**Trigger:** `push` to `main` + `pull_request`  
**What it does:**
- Installs dependencies
- Runs `npm run build` (Vite production build)
- Fails if build errors are present

---

### `gssoc-auto-quality-type-labels.yml`
**Trigger:** `pull_request_target` → opened, synchronize, labeled  
**What it does:** Auto-detects contribution type from changed files and applies `type:*` labels

---

## 9. Deployment

### `deploy-github-pages.yml`
**Trigger:** `push` to `main`  
**What it does:**
- Builds the Vite frontend
- Deploys `dist/` to GitHub Pages (`gh-pages` branch)

---

## 10. Design Principles

All workflows follow these conventions:

| Principle | Implementation |
|---|---|
| **Fork safety** | Use `pull_request_target` (not `pull_request`) so write token works for fork PRs |
| **No code execution from forks** | We never `checkout` + `run` fork code in `pull_request_target` workflows |
| **Idempotency** | Label helpers check for existence before create/add |
| **Bot exclusion** | All workflows skip `[bot]` suffixed usernames |
| **Admin exemption** | `Ayushh-Sharmaa` and `S3DFX-CYBER` are exempt from strict contributor validations |
| **Concurrency** | Every workflow has a `concurrency` group to prevent duplicate runs |
| **Minimum permissions** | Each job declares only the permissions it needs |

---

*Last updated: May 2026 · 39 total workflows · Maintained by [@Ayushh-Sharmaa](https://github.com/Ayushh-Sharmaa)*
