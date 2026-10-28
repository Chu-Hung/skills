# Spec Naming Convention

> Load this file when naming a new spec file or unsure about the convention.

## Rule

All files in `specs/` follow: **`{version}-{repo}-{type}.md`**

Every filename must be **globally unique** across all of `specs/` — Obsidian graph view shows filenames only, with no folder context.

## Exempt files (do not rename, do not flag)

The rule applies to **spec documents**. Workspace-level singleton files are exempt
because they exist exactly once per workspace (no uniqueness problem) and other
tooling depends on their exact names:

| File | Owner |
|------|-------|
| `specs/CLAUDE.md`, `specs/GEMINI.md` | init-workspace (agent index) |
| `specs/roadmap.md` | task-flow (user-owned strategy doc) |
| `specs/versions.md` | task-flow (auto-generated milestone registry) |
| `specs/wiki.md`, `specs/workspace-structure.md` | init-workspace |
| `specs/current/current-system-design.md` | init-workspace (cross-repo architecture living doc) |
| `specs/current/tasks.md`, `specs/current/backlog.md` | task-flow (auto-generated boards — read-only) |
| `specs/current/current-index.md`, `specs/versions/<V>/<V>-index.md` | index files |
| `specs/versions/<V>/_frozen.md` | knowledge-flow graduate (retire marker) |

Never "fix" these names to match the convention — task-flow and knowledge-flow
locate them by exact path. `_frozen.md` repeats once per retired version — it is
exempt because graduate checks for it by exact name, not because it is unique.
Exempt files keep their names; they are still edited surgically, never recreated.

## Version values

| Value | When to use |
|-------|-------------|
| `current` | Living doc in `specs/current/` — reflects actual codebase state |
| `v1.0`, `v1.5`, `v2.0`, ... | Versioned snapshot or delta in `specs/versions/vX.X/` |

## Repo values

Use the actual repo folder names from the workspace. Common examples:

| Value | Repo |
|-------|------|
| `backend` | Backend API |
| `mobile` | Mobile app |
| `web` | Web client |
| `admin` | Admin portal |
| `landing` | Landing page |
| `system` | Cross-repo (architecture, infra) |

## Type values

| Value | Contents |
|-------|----------|
| `api` | REST API endpoints, request/response format |
| `database` | DB schema, tables, relationships |
| `ui-ux` | Screens, components, routing |
| `tasks` | Implementation task list for this version |
| `system-design` | Architecture, data flow, integrations |
| `design-tokens` | Colors, typography, spacing, radii — design system values |
| `index` | Index of all docs for a version |

## Examples

```
current-backend-api.md          ✓
current-mobile-ui-ux.md         ✓
v1.5-backend-tasks.md           ✓
v2.0-web-ui-ux.md               ✓

api.md                          ✗  (not unique, no version, no repo)
tasks.md                        ✗  (generic)
backend.md                      ✗  (no type)
v1.5-backend-new-endpoints.md   ✗  (type is not from approved list — use "api")
```

## Checking for uniqueness

Before creating a new file:
```bash
find "$SPECS" -name "*.md" | xargs -I{} basename {} | sort
```
Confirm the new filename does not already exist anywhere in `specs/`.
