---
name: task-flow
description: |
  Manage tasks across GitHub Issues and generate a unified Obsidian board in specs/current/tasks.md.
  Source of truth is GitHub Issues. Markdown board is read-only, auto-generated.
  Use when asked to "add task", "sync tasks", "extract tasks", "start task", "close task",
  "report issue", "migrate tasks", "task board", "what tasks are open",
  "create roadmap", "add version", "create milestone", "set up project", or "plan release".
---

# Task Flow

```
specs/roadmap.md ──────────────────────────────────────────────▶ context for every task
specs/versions.md (milestone registry) ────────────────────────▶ milestone gate on add

knowledge-flow artifacts ──(extract)──▶ GitHub Issues (per repo)
manual /task-flow add    ──────────────▶       ↓
                                         gh issue list (all repos)
                                               ↓
                             ┌─────────────────┴──────────────────┐
                    specs/current/tasks.md          specs/current/backlog.md
                    (full board, read-only)         (no-milestone features, read-only)
                             └─────────────────┬──────────────────┘
                                          Obsidian (read-only)
```

## Task Taxonomy

| Type            | Home repo           | Description                            |
| --------------- | ------------------- | -------------------------------------- |
| `type:feature`  | team repo (by area) | New product functionality              |
| `type:bug`      | team repo (by area) | Code defect found during development   |
| `type:chore`    | team repo (by area) | Tech debt, maintenance, refactor       |
| `type:research` | `specs` always      | Investigation spike, open question     |
| `type:spec`     | `specs` always      | Documentation update needed            |
| `type:design`   | `specs` always      | Design work or design feedback         |
| `type:issue`    | `specs` always      | Production incident / user/team report |

Routing detail: read `references/routing.md`.

## Status — GitHub Project, not labels

Status is the Project's built-in **Status** field, moved by its built-in workflows. task-flow adds no status labels or custom fields.

```
add ──(item added)──▶ Todo ──(start)──▶ In Progress ──(PR merged / issue closed)──▶ Done
```

| Transition | Who moves it |
|---|---|
| → Todo | Project workflow "Item added to project" (default project set) |
| no project | stays in backlog — no status |
| → In Progress | `/task-flow start` (`gh project item-edit`) |
| → Done | Project workflows "Item closed" / "Pull request merged" |

## Labels

**Type** (exactly one):
`type:feature` · `type:bug` · `type:chore` · `type:research` · `type:spec` · `type:design` · `type:issue`

**Area** (one or more):
`area:frontend` · `area:backend` · `area:admin` · `area:design` · `area:infra` · `area:specs`

**Severity** (type:issue only):
`severity:critical` · `severity:high` · `severity:medium` · `severity:low`

---

## Setup (run before every command)

```bash
# ── 1. gh CLI check ──────────────────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "ERROR: gh CLI not found."
  echo ""
  echo "Install options:"
  echo "  macOS:   brew install gh"
  echo "  Ubuntu:  apt install gh"
  echo "  Windows: winget install GitHub.cli"
  echo ""
  echo "On macOS you can auto-install now: run  brew install gh  then  gh auth login"
  exit 1
fi

# Status lives in GitHub Projects — every command needs the 'project' token scope
# (a default `gh auth login` lacks it; missing scope makes projectItems reads fail)
_SCOPES=$(gh auth status --active 2>&1 | grep -i 'token scopes')
if [ -n "$_SCOPES" ] && ! echo "$_SCOPES" | grep -q "'project'"; then
  echo "ERROR: gh token lacks the 'project' scope. Run:  gh auth refresh -s project"
  exit 1
fi

# ── 2. Workspace detection ────────────────────────────────────────────────────
STANDALONE=false
_WS=$(pwd)
while [ "$_WS" != "/" ]; do
  [ -f "$_WS/WORKSPACE.md" ] && break
  _WS=$(dirname "$_WS")
done

if [ ! -f "$_WS/WORKSPACE.md" ]; then
  # Fall back: treat current directory as a standalone repo
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    STANDALONE=true
    _WS=$(git rev-parse --show-toplevel)
    SPECS="$_WS"   # no dedicated specs repo; use repo root for any file output
    STANDALONE_REPO=$(git remote get-url origin 2>/dev/null \
      | sed 's|.*github\.com[:/]\([^/]*/[^/]*\)\.git|\1|; s|.*github\.com[:/]\([^/]*/[^/]*\)|\1|')
    ORG=$(echo "$STANDALONE_REPO" | cut -d/ -f1)
    REPO_NAME=$(echo "$STANDALONE_REPO" | cut -d/ -f2)
    echo "NOTE: No WORKSPACE.md found. Running in standalone mode for repo: $STANDALONE_REPO"
  else
    echo "ERROR: Not inside a git repo and no WORKSPACE.md found. Cannot determine target."
    exit 1
  fi
else
  SPECS="$_WS/specs"
fi

# ── 3. Config + ORG resolution ────────────────────────────────────────────────
CONFIG="$_WS/.task-flow"

if [ "$STANDALONE" = "false" ]; then
  if [ -f "$CONFIG" ]; then
    source "$CONFIG"
    # CONFIG may provide: ORG, TEAM_REPOS (comma-separated, e.g. "frontend,backend,admin")
  fi

  # Auto-detect ORG if not set by config
  if [ -z "$ORG" ]; then
    ORG=$(cd "$SPECS" && git remote get-url origin 2>/dev/null \
      | sed 's|.*github\.com[:/]\([^/]*\)/.*|\1|')
  fi
  if [ -z "$ORG" ]; then
    ORG=$(git remote get-url origin 2>/dev/null \
      | sed 's|.*github\.com[:/]\([^/]*\)/.*|\1|')
  fi

  if [ -z "$ORG" ]; then
    echo "WARNING: Could not detect GitHub org. Set ORG in $_WS/.task-flow or ensure a github.com remote exists."
    echo "Continuing — some commands may fail."
  fi

  TEAM_REPOS="${TEAM_REPOS:-}"

  # Build repo list: specs + any team repos that exist on GitHub
  ALL_REPOS="specs"
  for R in $(echo "$TEAM_REPOS" | tr ',' ' '); do
    gh repo view "$ORG/$R" --json name -q .name &>/dev/null && ALL_REPOS="$ALL_REPOS $R"
  done
fi

# ── 4. Default GitHub Project (source of task status) ─────────────────────────
# Only from .task-flow — never auto-detected (see Default project)
[ "$STANDALONE" = "true" ] && [ -f "$CONFIG" ] && source "$CONFIG"
PROJECT_OWNER="${PROJECT_OWNER:-$ORG}"
PROJECT_TITLE=""
if [ -n "$PROJECT_NUMBER" ]; then
  PROJECT_TITLE=$(gh project view "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json -q .title 2>/dev/null) \
    || echo "WARNING: PROJECT_NUMBER=$PROJECT_NUMBER in .task-flow not found on $PROJECT_OWNER."
fi
```

## Default project (add / extract / report / start)

```
.task-flow PROJECT_NUMBER ─┬─ set ───▶ --project "<title>" → Status: Todo
                           └─ unset ─▶ ask once per run:
                                        ├─ create ─▶ /task-flow project (saves PROJECT_NUMBER), then continue
                                        └─ blank ──▶ no project → stays in backlog, no status
```

- Never auto-detect or pick a project — only `.task-flow` sets the default
- The draft's `Project:` line shows the default (or `— (backlog)`); approval covers it
- `blank` writes nothing — the question comes back next run until a default is set

---

## Command: Status

Quick board — reads `specs/current/tasks.md`, no GitHub API call.

```bash
if [ -f "$SPECS/current/tasks.md" ]; then
  head -5 "$SPECS/current/tasks.md"
  echo ""
  grep -c "^| \[#" "$SPECS/current/tasks.md" 2>/dev/null && echo "issues in board"
  grep "^## " "$SPECS/current/tasks.md"
else
  echo "No tasks.md found. Run /task-flow sync first."
fi
```

Show a summary: last synced time + count per section. Suggest `/task-flow sync` if board is stale (>24h).

---

## Command: Sync

Pulls all issues from GitHub → regenerates `specs/current/tasks.md`.

Read `references/sync.md` for the full procedure.

**Quick summary:**

1. Run setup
2. For each repo in `$ALL_REPOS`: call `gh issue list --json ...`
3. Group by each issue's own Project Status (`--json projectItems`); no project → backlog
4. Write `specs/current/tasks.md` using template in `assets/tasks-template.md`
5. Write `specs/current/backlog.md` — open issues with no milestone **or** no project (excluding `type:issue`), sorted oldest-first, using template in `assets/backlog-template.md`
6. Report: "Synced N issues → specs/current/tasks.md + specs/current/backlog.md (N unversioned)"

---

## Command: Add

Guided GitHub Issue creation with enforced fields. **Always drafts the full task and waits for explicit user approval before creating.**

Read `references/add.md` for the full procedure.

**Quick summary:**

0. **(Workspace mode only) Roadmap/version pre-check** — read `specs/roadmap.md` and list active milestones; ask user to anchor the task to a roadmap goal + version before anything else. Block if the chosen version has no GitHub milestone yet — offer to run `/task-flow version` first. In standalone mode, skip to step 1.

1. Ask: title, type, area, milestone (required); body details (recommended)
2. Apply routing rule to determine target repo
3. **Draft the complete issue** — title, type, area, labels, milestone, target repo, and full rendered body — and present it to the user for review
4. **Wait for explicit approval** per the canonical vocabulary in `references/add.md` § "Approval vocabulary". User may approve, request edits (loop back to step 3), or cancel. Never call `gh issue create` without an approve token.
5. Only after approval: `gh issue create --repo "$ORG/$REPO" --title "..." --body "..." --label "..." --milestone "..." --project "$PROJECT_TITLE"` — `--project` only when a default project is set (§ Default project); no status label
6. Suggest `/task-flow sync` to update board

---

## Command: Extract

Scans a knowledge-flow artifact for action items → drafts GitHub Issues for approval. **Never auto-creates.**

Read `references/extract.md` for the full procedure.

**Quick summary:**

1. User provides source file path (research article, spec, or ui-ux spec)
2. Read the file, scan for action items (TODOs, open questions, "needs implementation")
3. Present a candidate list — user selects which to draft into issues
4. **Draft a fully-detailed issue for each selected item** (title, type, area, milestone, target repo, full body with source link) and present every draft to the user
5. **Wait for explicit approval per item** using the canonical vocabulary in `references/add.md` § "Approval vocabulary". User can approve all, approve a subset, request edits on individual drafts, or cancel. Never call `gh issue create` until the user explicitly approves.
6. Only after approval: create the approved issues
7. Confirm: "Created N issues. Run `/task-flow sync` to update board."

---

## Command: Start

Sets Project Status → In Progress, creates a linked branch from `develop`, and **always opens it in a git worktree** (default `<repo>/.worktrees/<branch>`). When the linked branch is merged via PR, GitHub auto-closes the issue and the Project moves it to Done.

Read `references/start.md` for the full procedure.

**Quick summary:**

1. Run setup
2. Set Status → In Progress in the issue's own project. Not in a project → add to the default project; no default → ask per § Default project (`blank` skips status; branch + worktree still created)
3. Resolve base branch — `BASE_BRANCH` from `.task-flow` (default `develop`); fall back to repo default if missing
4. If the issue already has a linked branch, reuse it. Otherwise build `<type>/<issue-num>-<slug>` from the issue title + type label and run `gh issue develop <id> --base <base> --name <branch>` to create the linked branch
5. If a local clone exists, `git worktree add` the branch under `<repo>/.worktrees/` (or `WORKTREE_DIR`); reuse an existing worktree. Never `git checkout` in the main clone
6. `cd` into the worktree for all task work
7. Confirm: "Issue #N → In Progress, branch '...' from '<base>' in worktree '...' (linked; PR merge will auto-close)."

---

## Command: Done

Closes an issue; the Project's "Item closed" workflow sets Status → Done. Before closing:

- Show the user exactly which issue in which repo will be closed
- Wait for confirmation — the repo argument is usually omitted, so the default is a guess

```bash
# Usage: /task-flow done #<id> [repo]
ISSUE_NUM=$1
if [ "$STANDALONE" = "true" ]; then
  REPO=${2:-$REPO_NAME}   # standalone mode has no specs repo
else
  REPO=${2:-specs}
fi

# 1. Look up the target — never close blind
gh issue view "$ISSUE_NUM" --repo "$ORG/$REPO" --json title,state,url \
  -q '.title + " (" + .state + ") — " + .url' \
  || { echo "ERROR: issue #$ISSUE_NUM not found in $ORG/$REPO"; exit 1; }
```

Present it: "Close **#N** in `$ORG/$REPO` — _\<title\>_?" If the issue looks like it
belongs to a different repo than the default (e.g. the user was just discussing a
team-repo task), say so instead of proceeding. Only after the user confirms:

```bash
# 2. Confirmed — close; Project workflow moves Status → Done
gh issue close "$ISSUE_NUM" --repo "$ORG/$REPO"
echo "Issue #$ISSUE_NUM → closed (Project Status → Done)"
```

---

## Command: Report

Creates a `type:issue` production report. **Always drafts the full report and waits for explicit user approval before creating.**

Read `references/add.md` § "Production issue body template" for the body format and `references/add.md` § "Draft-and-approve flow" for the mandatory draft layout.

**Quick summary:**

1. Ask: title, area, severity, reporter, description, steps to reproduce, impact
2. Always routes to `specs` repo regardless of area
3. Apply labels: `type:issue`, `area:{area}`, `severity:{level}`; add to default project per § Default project
4. **Draft the full issue using the format in `references/add.md` § "Draft-and-approve flow"** (title, labels, milestone, rendered body) and present it for review
5. **Wait for explicit approval** per the canonical vocabulary in `references/add.md` § "Approval vocabulary". User may approve, request edits (loop back to step 4), or cancel. Never call `gh issue create` without an approve token.
6. Only after approval: create the issue

---

## Command: Migrate

Moves issues from `specs` to a team repo when that repo is created.

Read `references/migrate.md` for the full procedure.

**Quick summary:**

1. List specs issues with `area:{team}` + `type:feature|bug|chore`
2. Show list — user confirms which to migrate
3. For each: create equivalent issue in team repo, close original with "Migrated to {org}/{repo}#{N}"
4. Update `$_WS/.task-flow` TEAM_REPOS line
5. Run sync to regenerate board

---

## Command: Roadmap

> Workspace mode only. Creates or updates `specs/roadmap.md` — the strategic source of truth for versions and goals.

Read `references/planning.md` § "Roadmap" for the full procedure.

**Quick summary:**

1. If `specs/roadmap.md` exists: display it; offer to add a new version section or update an existing one
2. If it doesn't exist: scaffold from `assets/roadmap-template.md`; ask for product name, first version name, target date, and 3–5 high-level goals
3. Write/update the file and commit to the specs repo
4. Remind: "Run `/task-flow version <name>` to create the matching GitHub Milestone."

---

## Command: Version

> Workspace mode only. Creates a GitHub Milestone on all repos + registers it in `specs/versions.md`.

Read `references/planning.md` § "Version" for the full procedure.

**Quick summary:**

1. Ask: version name (`v1.0`, `v2.0-beta`, …), due date (optional), description
2. For each repo in `$ALL_REPOS`: `gh api repos/$ORG/$REPO/milestones --method POST --field title="$V" ...`
3. Upsert a row in `specs/versions.md` (auto-generated registry; never edit manually)
4. Confirm: "Milestone '$V' created on: {repos}. `specs/versions.md` updated."
5. Remind: "Run `/task-flow roadmap` to document goals for this version if you haven't yet."

---

## Command: Project

> Workspace mode only. Creates a GitHub Project (v2) at org level and links all team repos to it.

Read `references/planning.md` § "Project" for the full procedure.

**Quick summary:**

1. Ask: project title (defaults to version name if provided), description, linked version
2. `gh project create --owner "$ORG" --title "$TITLE"`
3. For each repo in `$ALL_REPOS`: link repo to project via `gh project link`
4. Save it as the default: `PROJECT_NUMBER` in `.task-flow` (ask before replacing an existing value)
5. Add **no** fields — use built-in Status / Milestone / Labels. Ask the user to enable built-in workflows (UI-only): Item added → Todo, Item closed → Done, PR merged → Done, Auto-add
6. Print the project URL + `/workflows` URL

---

## knowledge-flow Integration

These commands do NOT run extract automatically, but always end with this reminder when they produce new artifacts:

> "Artifacts created. Run `/task-flow extract {file-path}` to scan for action items and create issues."

| knowledge-flow event             | Artifact to extract from |
| -------------------------------- | ------------------------ |
| `compile` → new research article | the research article     |
| `promote` → new spec file        | the new spec file        |
| `capture` → new ui-ux spec stub  | the ui-ux spec file      |

---

## Gotchas

- **Never auto-create issues** — `add`, `extract`, and `report` must always draft the complete task (title, labels, milestone, target repo, full body) and wait for explicit user approval before calling `gh issue create`. No silent creation, no "I'll just create it" shortcuts. If the user says "draft these" without explicit approval, draft and stop. (`migrate` is exempt — it copies issues that were already approved when first created.)
- **Doc-style contract for all generated artifacts** (issue bodies, roadmap sections, boards) — mirrored verbatim in the init-workspace / knowledge-flow / task-flow / agent-team gotchas; keep the five points aligned:
  - One idea per bullet; bullets over sentences
  - Flow → ASCII/mermaid diagram; comparison → table; prose is the last resort
  - Every artifact has a hard line budget in its template — over budget means cut, not compress
  - Cut anything that doesn't change what the reader does next
  - Conclusion first, detail after
- **Standalone mode** — when there's no WORKSPACE.md, `ALL_REPOS` is not used. All commands target the single detected repo (`$STANDALONE_REPO`). `specs/current/tasks.md` is written to the repo root instead.
- **`tasks.md` and `backlog.md` are read-only** — never edit manually. Always regenerate via `/task-flow sync`.
- **Default project comes only from `.task-flow`** — never auto-detect or pick one. Unset → ask: create (`/task-flow project`) or blank (no project → backlog, no status).
- **Status lives in the GitHub Project** — never create or apply `status:*` labels; never add custom fields the Project already has (Status, Milestone, Labels). Let built-in workflows move Todo/Done; only `start` sets In Progress.
- **type:issue always lives in specs** — never route to team repos, even if area:backend.
- **Team repos may not exist yet** — always check with `gh repo view` before routing. Fall back to specs.
- **Roadmap/version/project commands need workspace mode** — they require `specs/` repo. In standalone mode, tell the user and skip gracefully.
- **Milestone gate on `add`** — in workspace mode, never create an issue without a milestone. If the chosen version has no milestone yet, block and offer `/task-flow version` first. "backlog" is the only valid bypass.
- **`specs/versions.md` is auto-generated** — never edit manually; always regenerate via `/task-flow version`.
- **`specs/roadmap.md` is user-owned** — task-flow only scaffolds or appends sections; never overwrites existing content.
- **Milestones must exist** — create milestone on GitHub before assigning (`gh api repos/{org}/{repo}/milestones`).
- **`done` confirms before closing** — display the issue title + target repo and wait for user confirmation. The repo default (`specs`, or the detected repo in standalone mode) is a fallback, not a routing decision — a wrong guess silently closes someone else's issue.
- **`/task-flow start` creates a linked branch** — uses `gh issue develop` so the branch is recorded as a Development link on the issue. Merging a PR from that branch auto-closes the issue, no `Closes #N` keyword required. Override the base branch via `BASE_BRANCH` in `.task-flow` (default `develop`).
- **Always work in a worktree** — `start` never checks out in the main clone. Default `<repo>/.worktrees/<branch>` (git-excluded locally via `.git/info/exclude`); override with `WORKTREE_DIR`. Remove with `git worktree remove` after merge.
- **Config file is optional** — `.task-flow` at workspace root can set `ORG`, `TEAM_REPOS`, `PROJECT_NUMBER` (default project), `PROJECT_OWNER`, `BASE_BRANCH`, `WORKTREE_DIR`. ORG/TEAM_REPOS auto-detect from git remotes; PROJECT_NUMBER never does. Never commit it (local-only).
- **Never commit tasks.md or backlog.md changes** — output only; user commits manually.
- **`backlog.md` is the focused backlog view** — open issues with no milestone or no project. Assign a milestone + add to a project to graduate an item from backlog to a versioned Todo section in `tasks.md`.

---

## References (load on demand)

| File                         | Load when                                             |
| ---------------------------- | ----------------------------------------------------- |
| `references/routing.md`      | Deciding which repo an issue belongs in               |
| `references/add.md`          | Running `/task-flow add` or `/task-flow report`       |
| `references/extract.md`      | Running `/task-flow extract`                          |
| `references/sync.md`         | Running `/task-flow sync`                             |
| `references/start.md`        | Running `/task-flow start`                            |
| `references/migrate.md`      | Running `/task-flow migrate`                          |
| `references/planning.md`     | Running `/task-flow roadmap`, `version`, or `project` |
| `assets/tasks-template.md`   | Generating `specs/current/tasks.md` layout            |
| `assets/backlog-template.md` | Generating `specs/current/backlog.md` layout          |
| `assets/roadmap-template.md` | Scaffolding `specs/roadmap.md` for a new workspace    |
| `assets/label-setup.sh`      | First-time label setup on a new repo (type/area/severity) |
