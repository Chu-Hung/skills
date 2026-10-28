---
name: init-workspace
description: Initialize a new multi-repo project workspace with the standard layout (root workspace, specs git repo, local private LLM knowledge base, source code repos). Use when a user says "init workspace", "create workspace", "set up new project workspace", "bootstrap project", or "initialize project structure".
---

# Init Workspace

Set up a new project workspace following the standard multi-repo layout:
- Root folder = workspace container (NOT a git repo)
- `specs/` = documentation git repo (single source of truth, team-visible)
- `local/` = private LLM knowledge base (never pushed — raw inputs, compiled research, outputs)
- `archived/` = deprecated; never touch
- Source code repos = individual git repos inside root

The knowledge flow is:
```
local/raw/  →(LLM compile)→  local/research/  →(promoted when ready)→  specs/versions/vX.Y/
                                               →(matured to current)→   specs/current/
local/raw/images/  →(finalized)→  specs/assets/
```

Companion skills the scaffold must stay compatible with:
- **knowledge-flow** — locates the workspace via the `WORKSPACE.md` symlink; reads the `local/` manifests created below
- **task-flow** — owns task tracking (GitHub Issues); reads `specs/roadmap.md` (lowercase) and generates `specs/current/tasks.md`. Never scaffold hand-written task files.

---

## Step 1 — Gather inputs

Ask the user (all at once, in a single message):

1. **Workspace name** — root folder name (e.g. `myproject`)
2. **Parent directory** — where to create it (default: current working directory)
3. **Project description** — one sentence: what it does and for whom
4. **Repos** — list of source code repos and their role (e.g. `backend: NestJS API`, `app-mobile: Expo app`). Say "none yet" to skip.
   > **Naming convention:** repos use `{project}-{role}` — role describes the service's purpose, not its tech stack. Use `backend` not `nestjs`, `web` not `nextjs`, `admin` not `react-admin`. Examples: `myapp-web`, `myapp-backend`, `myapp-admin`, `myapp-worker`.
5. **Clone or scaffold?** — for each repo: clone from GitHub URL, scaffold empty git repo, or skip
6. **Package manager** — pnpm / npm / yarn (default: pnpm)
7. **specs git remote** — GitHub URL for the `specs/` repo (optional, add later)
8. **First version tag** — starting roadmap version label (default: `v0.1`)
9. **AI agents** — which agent index files to create: Claude only (default), or Claude + Gemini

Present the full plan — directory tree, files to create, repos to clone/scaffold — and ask for confirmation before touching the filesystem.

---

## Step 2 — Create workspace skeleton

```bash
WORKSPACE=<workspace-name>
PARENT=<parent-directory>
ROOT="$PARENT/$WORKSPACE"
V=<first-version-tag>   # e.g. v0.1

# Root (not a git repo)
mkdir -p "$ROOT"

# specs structure
mkdir -p "$ROOT/specs/current"
mkdir -p "$ROOT/specs/assets/current"
mkdir -p "$ROOT/specs/assets/versions/$V"
mkdir -p "$ROOT/specs/versions/$V"
mkdir -p "$ROOT/specs/scripts/tools"
# specs/scripts/tools/ holds the design canvas capture script (see references/design-canvas-capture.md)
# Populate it after init: copy capture-design-canvas.mjs + package.json, then npm install

# local knowledge base
mkdir -p "$ROOT/local/raw/articles"
mkdir -p "$ROOT/local/raw/papers"
mkdir -p "$ROOT/local/raw/images"
mkdir -p "$ROOT/local/raw/conversations"
mkdir -p "$ROOT/local/raw/notes"
mkdir -p "$ROOT/local/research/competitors"
mkdir -p "$ROOT/local/research/market-analysis"
mkdir -p "$ROOT/local/research/tech-spikes"
mkdir -p "$ROOT/local/research/ideas"
mkdir -p "$ROOT/local/outputs/reports"
mkdir -p "$ROOT/local/outputs/slides"

# archived (placeholder, never use)
mkdir -p "$ROOT/archived"
```

For each repo, also:
```bash
mkdir -p "$ROOT/<repo-name>"
```

And for each repo, mirror both current spec dirs and version spec dirs:
```bash
# current spec dir per repo
mkdir -p "$ROOT/specs/current/<repo-name>"
mkdir -p "$ROOT/specs/assets/current/<repo-name>"

# version spec dir per repo
mkdir -p "$ROOT/specs/versions/$V/<repo-name>"
mkdir -p "$ROOT/specs/assets/versions/$V/<repo-name>"
```

---

## Step 3 — Init specs as a git repo

```bash
cd "$ROOT/specs"
git init
```

If the user provided a remote URL:
```bash
git remote add origin <specs-remote-url>
```

---

## Step 4 — Write root-level boundary files

### `$ROOT/.gitignore`

```
# Workspace root is NOT a git repo. Each subdirectory is its own repo.
local/
archived/
.DS_Store
*.swp
```

### `$ROOT/local/.gitignore`

```
# Entire local/ is private. Never commit to any repo.
*
!.gitignore
```

### `$ROOT/local/raw/_index.md`

```markdown
# Raw Inputs Index

> LLM-maintained index. One line per file: path, source, date added, one-sentence summary.
> This file is the entry point for the LLM compilation workflow: raw/ → research/.

| File | Source | Added | Summary |
|------|--------|-------|---------|
```

### `$ROOT/local/raw/images/_manifest.md`

```markdown
# Synced Images Manifest

> One raw filename per line. Managed by `/knowledge-flow sync-assets` — do not edit manually.
> Used by `/knowledge-flow status` to detect unsynced images (filename comparison is unreliable after rename on sync).
```

### `$ROOT/local/research/_index.md`

```markdown
# Research Wiki Index

> LLM-maintained. The LLM writes and maintains all content here — do not edit manually.
> Brief summary of every article so the LLM can decide what to load without reading everything.
> Organized by topic; update when new articles are added or existing ones are updated.

## Competitors
## Market Analysis
## Tech Spikes
## Ideas
```

Create a `_index.md` in each research subdirectory too (competitors, market-analysis, tech-spikes, ideas) with the same header and an empty table:

```markdown
# <Section> Index

> LLM-maintained. One line per article: filename, one-sentence summary.

| File | Summary |
|------|---------|
```

### `$ROOT/local/outputs/_index.md`

```markdown
# Outputs Index

> LLM-generated artifacts. Reports, slide decks, and analysis ready for review.
> All Marp slides go in slides/, all markdown reports go in reports/.

| File | Type | Date | Description |
|------|------|------|-------------|
```

---

## Step 5 — Write specs bootstrap files

Full templates live in `assets/templates/`. For each row:

- Read the template (batch-read all templates up front — order doesn't matter)
- Replace every `<placeholder>` with project-specific values
- Delete any leading HTML comment — it is a template instruction, never file content
- Write the result to the target path
- Templates are the contract — don't invent extra sections or drop existing ones

| Target file | Template |
|-------------|----------|
| `$ROOT/specs/CLAUDE.md` | `assets/templates/claude-md.md` |
| `$ROOT/specs/GEMINI.md` | `assets/templates/claude-md.md` (only if requested — see below) |
| `$ROOT/specs/roadmap.md` | `assets/templates/roadmap.md` |
| `$ROOT/specs/wiki.md` | `assets/templates/wiki.md` |
| `$ROOT/specs/workspace-structure.md` | none — write from scratch (see below) |
| `$ROOT/specs/current/current-index.md` | `assets/templates/current-index.md` |
| `$ROOT/specs/current/current-system-design.md` | `assets/templates/current-system-design.md` |
| Per-repo stubs (see below) | `assets/templates/repo-stub.md` |
| `$ROOT/specs/versions/$V/$V-index.md` | `assets/templates/version-index.md` |

> **`roadmap.md` is lowercase on purpose** — `/task-flow roadmap` and the milestone
> gate in `/task-flow add` read `specs/roadmap.md` by exact path. Do not create an
> uppercase `ROADMAP.md` file; the uppercase name exists only as a root symlink (Step 6).

### GEMINI.md (only if user explicitly requested it)

Same content as CLAUDE.md — parallel agent index for Google Gemini. Adjust the opening lines only:

```markdown
# GEMINI.md

> Agent index for the <ProjectName> project (Gemini).
> Symlinked: `specs/GEMINI.md` → `<workspace>/GEMINI.md`. Always edit in `specs/`.
```

If the user did not ask for Gemini, skip this file entirely.

### `workspace-structure.md`

Write a doc mirroring the **exact** directory tree created in Step 2. Sections to include:
- **Overview** — workspace root is not a git repo; individual subdirs are
- **`specs/` layout** — full tree with one-line description per file/folder
- **`local/` layout** — full tree; explain the knowledge flow (raw → research → specs)
- **`archived/`** — deprecated, never touch
- **Workspace Rules** — table identical to the Workflow Rules in CLAUDE.md
- **Obsidian Setup** — open `<workspace>/` as vault root; both `specs/` and `local/research/` visible in graph view; use Obsidian Web Clipper to save articles to `local/raw/articles/` as `.md`; use Marp plugin to preview `local/outputs/slides/`
- **Spec Tooling** — document `specs/scripts/tools/` and the design canvas capture script; see `references/design-canvas-capture.md` for usage, map file format, and output conventions

### Per-repo stub specs

For each repo, create one stub per applicable document type from `assets/templates/repo-stub.md`.
Write to `specs/current/<repo>/current-<repo>-<type>.md` **and** `specs/versions/$V/<repo>/$V-<repo>-<type>.md`
(same template; the filename prefix and the title's `<Current|V>` placeholder differ —
use `Current` in the current stub, the version tag in the version stub).

| Type | Filename suffix | Applies to |
|------|-----------------|-----------|
| API design | `-api.md` | backend, any HTTP server |
| Database schema | `-database.md` | backend, any data store |
| UI/UX | `-ui-ux.md` | app-mobile, app-web, admin, landing |

Skip types that don't apply to the repo. In each stub, add only the type-specific
sections matching its type (listed in the template's comment block) and delete the
comment block itself — it is a template instruction, not stub content.

> **No tasks stubs.** Task tracking is owned by `/task-flow`: tasks live in GitHub
> Issues and the board at `specs/current/tasks.md` is auto-generated by
> `/task-flow sync`. Hand-written `-tasks.md` stubs would compete with that board —
> never create them.

---

## Step 6 — Create root-level symlinks

```bash
cd "$ROOT"
ln -sf specs/CLAUDE.md CLAUDE.md
ln -sf specs/roadmap.md ROADMAP.md
ln -sf specs/wiki.md WIKI.md
ln -sf specs/workspace-structure.md WORKSPACE.md
```

> `WORKSPACE.md` is required — it is the sentinel file that `knowledge-flow` uses to locate the workspace root. Without it, `/knowledge-flow status|compile|promote|sync-assets` will fail with "WORKSPACE.md not found".

Only if the user requested GEMINI.md:
```bash
ln -sf specs/GEMINI.md GEMINI.md
```

---

## Step 7 — Handle source code repos

For each repo:

**Option A — Clone from GitHub:**
```bash
git clone <repo-url> "$ROOT/<repo-name>"
```

**Option B — Scaffold new empty repo:**
```bash
cd "$ROOT/<repo-name>"
git init
# Write minimal README.md with repo name and one-line description
# Write .gitignore appropriate for the repo's tech stack
```

**Option C — User will add manually:** Note it in the summary, skip.

After cloning/scaffolding any repo, check for existing code before suggesting changes:
- If code exists, read key files and note the actual stack in the CLAUDE.md Tech Stack table (refactor-first: understand before modifying)
- Never overwrite existing files

---

## Step 8 — First commit in specs/

```bash
cd "$ROOT/specs"
git add .
git commit -m "init: bootstrap specs workspace"
```

Ask the user before pushing:
> Push initial commit to `origin/main`?

If yes:
```bash
git push -u origin main
```

---

## Step 9 — Print summary

```
Workspace created at: <absolute-path>

Directory tree:
  <workspace>/
  ├── specs/            (git repo, remote: <remote or "not set">)
  ├── local/            (local-only, not tracked)
  ├── archived/         (placeholder, do not use)
  ├── CLAUDE.md      -> specs/CLAUDE.md
  ├── ROADMAP.md     -> specs/roadmap.md
  ├── WIKI.md        -> specs/wiki.md
  ├── WORKSPACE.md   -> specs/workspace-structure.md  ← required by /knowledge-flow
  <list each repo>

Repos:
  - <repo-name>: <cloned from <url> | scaffolded | pending — user will add>

─────────────────────────────────────────────
  REQUIRED NEXT STEP: activate knowledge-flow
─────────────────────────────────────────────

  /knowledge-flow is now your daily workflow for moving information
  from research into specs. Run it whenever you have new raw inputs.

  Commands (run from anywhere inside <workspace>/):
    /knowledge-flow status       ← run this first, always
    /knowledge-flow compile      ← compile a raw file into a research article
    /knowledge-flow promote      ← promote a research article to a spec
    /knowledge-flow sync-assets  ← copy finalized images to specs/assets/

  The flow:
    local/raw/  →(compile)→  local/research/  →(promote)→  specs/

  Drop articles, notes, PDFs into local/raw/ — the LLM compiles them
  into structured research notes, and you decide when to promote them
  to specs. Nothing goes directly into specs/ — it flows through research first.

─────────────────────────────────────────────

Other next steps:
  1. Open <workspace>/ as your Obsidian vault root
     - Install Web Clipper → clips land in local/raw/articles/ as .md
     - Install Marp plugin → preview slides in local/outputs/slides/
  2. Set up tasks: /task-flow version <V> to create the GitHub milestone,
     then /task-flow add — the board generates into specs/current/tasks.md
  3. Fill in specs/current/ stubs as you build each repo
  4. Run /init inside each repo to generate a repo-level CLAUDE.md
  5. Set specs remote if not done: git -C specs/ remote add origin <url>

Workflow reminder:
  Spec-first → Surgery edit → Test+Doc before code → Refactor-first → Atomic commits
```

---

## Non-Negotiables

- Root workspace must NOT be a git repo — only its subdirectories are
- `local/` and `archived/` must never be committed, referenced in specs, or exposed externally
- Never create or move directories without confirming with the user first
- Always show the full plan and get confirmation before touching the filesystem
- Spec filenames in `specs/` must be globally unique — use `{version}-{repo}-{type}.md` or `current-{repo}-{type}.md`; never generic names. Workspace singletons (`roadmap.md`, `wiki.md`, `workspace-structure.md`, generated boards) are the only exception
- The roadmap file is `specs/roadmap.md` (lowercase) — task-flow depends on that exact path; `ROADMAP.md` exists only as a root symlink
- Tasks are GitHub Issues managed by `/task-flow` — never scaffold `-tasks.md` stubs or hand-written task lists in specs
- Repo names follow `{project}-{role}` — role is purpose-based, not tech-based (`backend` not `nestjs`, `web` not `nextjs`, `admin` not `react-admin`)
- If the user says "none yet" for repos, still create the full skeleton and all stub specs
- Symlinks point `root → specs/`, never the reverse — specs is the source of truth
- The `_index.md` files in `local/research/` are LLM-maintained; never bulk-edit them manually
- When checking existing repos (Option C), read before writing — refactor-first applies
- If GEMINI.md is created (user-requested only), it must contain identical Workflow Rules as CLAUDE.md
- **Doc-style contract for all generated artifacts** (bootstrap files, stubs, indexes) — mirrored verbatim in the init-workspace / knowledge-flow / task-flow / agent-team gotchas; keep the five points aligned:
  - One idea per bullet; bullets over sentences
  - Flow → ASCII/mermaid diagram; comparison → table; prose is the last resort
  - Every artifact has a hard line budget in its template — over budget means cut, not compress
  - Cut anything that doesn't change what the reader does next
  - Conclusion first, detail after

---

## References & assets (load on demand)

| File | Load when |
|------|-----------|
| `references/design-canvas-capture.md` | User asks about design screenshot tooling, or when writing the Spec Tooling section of `workspace-structure.md` |
| `assets/templates/*.md` | Step 5 — one template per bootstrap file; read each before writing its target |
