---
name: knowledge-flow
description: |
  Manage the data flow from local/ to specs/ in a project workspace.
  Handles compile raw inputs into research notes, promote research to specs,
  sync finalized assets to specs/assets/, capture design canvas HTML files
  into screenshots + ui-ux spec stubs, and graduate a shipped version's spec
  into specs/current/.
  Use when asked to "knowledge status", "compile raw", "promote to spec",
  "sync assets", "capture design", "screenshot canvas", "graduate a shipped version",
  "graduate to current", "retire a spec version", or "what's new in local/".
---

# Knowledge Flow

```
local/raw/        →(compile)→   local/research/   →(promote)→   specs/
local/raw/images/ →(sync-assets)→ specs/assets/
local/raw/*.html  →(capture)→   specs/assets/versions/<V>/  +  specs/versions/<V>/<repo>-ui-ux.md
specs/versions/<V>/ →(graduate)→ specs/current/
```

## Commands

| Command | What it does |
|---------|-------------|
| `/knowledge-flow status` | Show new raw files, uncompiled files, promotion candidates, unsynced images |
| `/knowledge-flow compile` | Compile a raw file into a research article (silently skips `.html` files) |
| `/knowledge-flow capture` | **Opt-in only.** Capture artboards from a design canvas HTML → PNGs + ui-ux spec stub. Never auto-suggested by other commands. |
| `/knowledge-flow promote` | Promote a research article to a spec |
| `/knowledge-flow graduate <V>` | Fold a shipped version's spec into `specs/current/`, then retire it |
| `/knowledge-flow sync-assets` | Copy finalized images to `specs/assets/` |

> **Capture is opt-in.** Other commands never push the user toward `/knowledge-flow capture`. Only run it when the user explicitly asks.
>
> **New users:** if `local/raw/` contains HTML design canvases, `status` won't surface them — run `/knowledge-flow capture` directly to process them.

---

## Setup (run before every command)

```bash
_WS=$(pwd)
while [ "$_WS" != "/" ]; do
  [ -f "$_WS/WORKSPACE.md" ] && break
  _WS=$(dirname "$_WS")
done
[ ! -f "$_WS/WORKSPACE.md" ] && echo "ERROR: WORKSPACE.md not found" && exit 1

RAW="$_WS/local/raw"
RESEARCH="$_WS/local/research"
SPECS="$_WS/specs"
CHECKPOINT="$RESEARCH/_index.md"
```

---

## Command: Status

**Token cost: zero — pure shell, never reads file content.**

```bash
echo "=== NEW SINCE LAST COMPILE ==="
if [ -f "$CHECKPOINT" ]; then
  find "$RAW" -not -path "$RAW/images/*" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" \) -newer "$CHECKPOINT" | sed "s|$_WS/||" | sort
else
  echo "(no checkpoint — showing all raw files)"
  find "$RAW" -not -path "$RAW/images/*" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" \) | sed "s|$_WS/||" | sort
fi

echo "=== ALL UNCOMPILED ==="
comm -23 \
  <(find "$RAW" -not -path "$RAW/images/*" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" \) | sed "s|$_WS/||" | sort) \
  <(grep -rh "^source:" "$RESEARCH" --include="*.md" 2>/dev/null | sed 's/^source: *//' | sort)

echo "=== PROMOTION CANDIDATES ==="
grep -rl "^status: draft" "$RESEARCH" --include="*.md" 2>/dev/null | sort

echo "=== UNSYNCED IMAGES ==="
ASSET_MANIFEST="$RAW/images/_manifest.md"
CAPTURE_MANIFEST="$RAW/images/_captured.md"
comm -23 \
  <(find "$RAW/images" -type f | grep -v '/_manifest.md' | grep -v '/_captured.md' | grep -v '.DS_Store' | sed "s|$RAW/images/||" | python3 -c "import sys,unicodedata; [print(unicodedata.normalize('NFC',l.rstrip('\n'))) for l in sys.stdin]" | sort) \
  <(cat <(grep -v '^#' "$ASSET_MANIFEST" 2>/dev/null | grep -v '^$') \
        <(grep -v '^#' "$CAPTURE_MANIFEST" 2>/dev/null | grep -v '^$') | sort)

echo "=== CHECKPOINT ==="
[ -f "$CHECKPOINT" ] && stat -f "Last compile: %Sm" -t "%Y-%m-%d %H:%M" "$CHECKPOINT" || echo "Never compiled"
```

Format the output as a status report. Highlight any items needing action. If all sections are empty: "Everything is up to date."

> If there are unsynced images, read `references/sync-assets.md`.
> If there are promotion candidates, read `references/promote.md`.
> **Do not mention or surface `.html` design canvases here.** Capture is opt-in — only discuss it if the user explicitly asks about HTML files or design canvases.

---

## Command: Compile

Read `references/compile.md` for the full procedure.

**Quick summary:**
1. Run status to find new/uncompiled files (shell only)
2. User picks one file
3. If the file is `.html`, silently skip it (it is not a compile target). Do **not** suggest `/knowledge-flow capture` — capture is opt-in and only runs when the user explicitly asks for it.
4. Read only that file — nothing else
5. Write research article using template in `assets/research-template.md`
6. `touch "$CHECKPOINT"` after all selected files are done
7. End with: "Artifact created: `{relative-path}`. Run `/task-flow extract {relative-path}` to scan for action items."

---

## Command: Capture

> **Opt-in only.** This command runs only when the user explicitly asks (e.g. "capture this canvas", "/knowledge-flow capture"). Do not invoke or suggest it from `status`, `compile`, or any other flow.

Read `references/capture-design-canvas.md` for the full procedure.

**Quick summary:**
1. List `.html` candidates in `local/raw/` (shell only — only when user has asked)
2. User selects one
3. `grep -c 'data-dc-slot'` confirms it's a real canvas (not a plain HTML file)
4. Check/install the tool at `specs/scripts/tools/` (copy from `assets/` if missing)
5. Discover artboard IDs via `grep -o 'data-dc-slot="[^"]*"'` (shell only)
6. Confirm version, repo, canvas map, overflow IDs **with the user — wait for explicit approval before running the tool**
7. Run `node specs/scripts/tools/capture-design-canvas.mjs ...`
8. Write a `ui-ux` spec stub with image references in `specs/versions/<V>/<repo>/`
9. End with: "Artifact created: `{relative-path}`. Run `/task-flow extract {relative-path}` to scan for action items."

---

## Command: Promote

Read `references/promote.md` for the full procedure.

**Quick summary:**
1. List candidates via `grep -rl "^status: draft"` (shell only)
2. Preview each via `head -15` (frontmatter only)
3. User picks one — then read it fully
4. Surgical edit or new file in `specs/`
5. Update research article frontmatter: `status: promoted`, `promoted-to:`, `promoted-at:`
6. End with: "Artifact created: `{relative-path}`. Run `/task-flow extract {relative-path}` to scan for action items."

---

## Command: Graduate

Read `references/graduate.md` for the full procedure.

**Quick summary:**
1. Confirm `<V>` status is `shipped` in `versions.md` (anchored shell grep) — refuse otherwise
2. Ordering guard vs Mirrors (row position, not semver): refuse if `<V>` precedes Mirrors; if equal, branch on `_frozen.md` (present → no-op, absent → resume straight to Gate 2); first run (no Mirrors yet) skips the stale check. Then stale-version check — all shell only
3. Build fold set — content-type files only (`*-api.md`/`*-database.md`/`*-ui-ux.md`/`*-system-design.md`/`*-design-tokens.md`); list skipped files
4. Print per-section plan (new/surgical-update/conflict/removed/unchanged + Length vs budget) before any write
5. Gate 1: user approves fold + resolves conflicts/removals → surgical writes to `current/` + fill sync-status table (create only if missing)
6. Gate 2 (separate): user confirms retire → write `versions/<V>/_frozen.md`
7. End with: "Graduated `<V>` → `current/`. Commit with: `git ...`"

---

## Command: Sync Assets

Read `references/sync-assets.md` for the full procedure.

---

## Gotchas

- **`_index.md` is the checkpoint** — its mtime marks "last compiled at". Always `touch "$CHECKPOINT"` after a compile run, never skip it.
- **`local/raw/images/_manifest.md` tracks synced assets** — one raw path per line. Files are renamed on sync, so filename comparison against `specs/assets/` is unreliable. Always append to the manifest after syncing, never skip it.
- **`local/raw/images/_captured.md` tracks captured canvases** — one raw path per line (relative to `local/raw/images/`). Append after every `capture` run so status knows these files are processed, not missing.
- **`comm -23` requires sorted input** — both process substitutions must pipe through `sort` or results are wrong.
- **`stat` flag differs by OS** — macOS uses `stat -f "%Sm" -t "%Y-%m-%d"`, Linux uses `stat -c "%y"`.
- **Doc-style contract for all generated artifacts** (research articles, specs, stubs) — mirrored verbatim in the init-workspace / knowledge-flow / task-flow / agent-team gotchas; keep the five points aligned:
  - One idea per bullet; bullets over sentences
  - Flow → ASCII/mermaid diagram; comparison → table; prose is the last resort
  - Every artifact has a hard line budget in its template — over budget means cut, not compress
  - Cut anything that doesn't change what the reader does next
  - Conclusion first, detail after
- **Never read `archived/`** — off-limits in all operations.
- **Never commit** — output only; user commits manually.
- **Spec naming is enforced** — all files in `specs/` must follow `{version}-{repo}-{type}.md`. Reject generic names. Workspace-level singletons (`roadmap.md`, `versions.md`, `wiki.md`, and the generated `tasks.md`/`backlog.md` boards) are exempt — see `references/spec-naming.md` for the full list.
- **HTML files are design canvases, not text docs** — `compile` silently skips **all** `.html` files (canvas or plain-text); if a user expects a non-canvas HTML doc to compile, tell them to convert it to `.md` first. **Never** auto-suggest `/knowledge-flow capture`; it is opt-in and runs only when the user explicitly asks.
- **Capture requires explicit user confirmation** — even when invoked, confirm parameters (version, repo, canvas map, overflow IDs) and wait for approval before running the tool. Never auto-proceed.
- **Captured PNGs bypass `local/raw/images/`** — they go directly to `specs/assets/versions/<V>/`. Never add them to `_manifest.md`.
- **`_frozen.md` distinguishes retired from resume-pending** — when `<V>`'s row equals Mirrors, its presence means already graduated and retired (no-op); its absence means the fold already landed but retire never happened, so `graduate` skips straight to Gate 2 instead of re-folding. Never write it before Gate 2 is approved.
- **Graduate's fold set is a content-type allowlist** — only `*-api.md`, `*-database.md`, `*-ui-ux.md`, `*-system-design.md`, `*-design-tokens.md`. Tasks/index/traceability/bd/qa/design docs are always skipped — list them, don't fold them.
- **Graduate is a two-stage gate** — Gate 1 (fold + per-conflict resolution) and Gate 2 (retire) are separate approvals. Declining Gate 2 leaves `current/` folded but the version un-retired; never write `_frozen.md` on Gate 1 approval alone.
- **Mirrors lives in `current-index.md`'s sync-status table** — parse it (don't assume), then locate both Mirrors and `<V>` as rows in `versions.md` to compare order.
- **Graduate is forward-only, with a resume path** — refuse if `<V>`'s row precedes Mirrors'; if equal, branch on `_frozen.md` (no-op if present, resume to Gate 2 if absent); proceed if `<V>` is after Mirrors. First run (Mirrors `—` or no block) skips the stale check; Gate 1 fills the `—` placeholders (creates the block only if it's missing — never a second one).
- **Graduate never touches `archived/`** — it only reads `specs/versions/` and writes `specs/current/`; the content-type allowlist already excludes anything else.

---

## References (load on demand)

| File | Load when |
|------|-----------|
| `references/compile.md` | Running `/knowledge-flow compile` (text/doc files) |
| `references/capture-design-canvas.md` | Running `/knowledge-flow capture` |
| `references/promote.md` | Running `/knowledge-flow promote` |
| `references/graduate.md` | Running `/knowledge-flow graduate <V>` |
| `references/sync-assets.md` | Running `/knowledge-flow sync-assets` or there are unsynced images |
| `references/spec-naming.md` | Naming a new spec file or unsure about convention |
| `assets/research-template.md` | Writing a new research article |
| `assets/capture-design-canvas.mjs` | Source of the capture script — copy to `specs/scripts/tools/` if missing |
| `assets/capture-package.json` | `package.json` for the capture tool — copy to `specs/scripts/tools/package.json` if missing |
| `use-cases/` | Verifying the workflow or testing a scenario |
