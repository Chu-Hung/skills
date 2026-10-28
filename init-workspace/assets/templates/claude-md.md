# CLAUDE.md

> Agent index for the <ProjectName> project.
> Symlinked: `specs/CLAUDE.md` → `<workspace>/CLAUDE.md`. Always edit in `specs/`.

---

## Workflow Rules (read first, enforce always)

| Rule | What it means |
|------|---------------|
| **Spec-first** | Every feature starts with a spec. No code without a spec. Update spec after every change. |
| **Surgery edit** | Local edits only — never rewrite an entire file. Avoid AI overwrite disasters. |
| **Review-rigorous** | Multiple review rounds for every artifact: RFC → spec → plan → code. |
| **Spec sync** | `specs/current/` must always reflect actual codebase state. |
| **No unauthorized dirs** | Never create or move directories without asking the user. |
| **Test-driven / Doc-first** | No code before tests and docs exist. Write doc and test stubs first. |
| **Atomic commits** | One change per commit. Format: `<type>: <subject>`. |
| **LLM-aware** | Specs optimized for LLM context windows — focused, low-noise, no redundancy. Maintain `_index.md` files for LLM navigation. |
| **No-hallucination** | If unsure, ask immediately. Never fabricate information. |
| **Refactor-first** | Before writing new code, review and refactor existing code for performance and extensibility. |
| **Security-always** | Security is priority one. Never trade security for convenience. |
| **Spec naming** | Files in `specs/` use `{version}-{repo}-{type}.md`. Every filename must be globally unique (Obsidian graph shows filenames only). Never use generic names like `api.md`. Workspace singletons (`roadmap.md`, `wiki.md`, generated `tasks.md`/`backlog.md`) are exempt. |
| **Tasks live in GitHub Issues** | Task tracking is owned by `/task-flow`. `specs/current/tasks.md` and `backlog.md` are auto-generated, read-only boards — never edit or hand-write task lists in specs. |
| **Local-only boundaries** | `local/` and `archived/` are local-only. Never commit, reference in git-tracked files, or expose their paths in specs. |
| **Assets in specs** | Only finalized images go in `specs/assets/`. Working drafts stay in `local/raw/images/`. |

---

## Project Overview

**<ProjectName>** — <one-sentence description>

Package manager: **<pnpm/npm/yarn>** everywhere.

---

## Workspace Layout

```
<workspace>/                  # workspace root (NOT a git repo)
│
├── ── Git-tracked repos ──
<list each repo>              # <role>
├── specs/                    # Project documentation (git repo)
│
├── ── Local-only ──
├── local/                    # Private LLM knowledge base (never pushed)
└── archived/                 # Deprecated — never touch
│
├── ── Symlinks ──
├── CLAUDE.md    -> specs/CLAUDE.md
├── ROADMAP.md   -> specs/roadmap.md
├── WIKI.md      -> specs/wiki.md
└── WORKSPACE.md -> specs/workspace-structure.md
```

---

## Tech Stack

| Repo | Stack |
|------|-------|
<one row per repo>

---

## Specs (`/specs`)

`specs/current/` is the **living spec** — always up to date with the codebase.
`specs/versions/` is version snapshots aligned to the roadmap.

| File/Folder | Contents |
|-------------|----------|
| `specs/roadmap.md` | Version roadmap and status (managed via `/task-flow roadmap`) |
| `specs/wiki.md` | Product overview |
| `specs/workspace-structure.md` | Full workspace layout and rules |
| `specs/current/` | Living spec — current state per repo |
| `specs/current/tasks.md` | Auto-generated task board (`/task-flow sync`) — read-only |
| `specs/versions/<ver>/` | Snapshot per roadmap version |
| `specs/assets/` | Finalized images referenced by specs |

---

## Quick Commands

| Repo | Command | Purpose |
|------|---------|---------|
<fill in per repo>

---

## Knowledge Flow (local → specs)

```
local/raw/  →(LLM compile)→  local/research/  →(promoted)→  specs/versions/vX.Y/
                                               →(matured)→   specs/current/
local/raw/images/  →(finalized)→  specs/assets/
```

LLM maintains all content in `local/research/`. Do not edit manually.
Promote research to `specs/` when it's team-ready.

---

## See also

- `specs/roadmap.md`
- `specs/wiki.md`
- `specs/workspace-structure.md`
