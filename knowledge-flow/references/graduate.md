# Graduate Procedure

> Load this file when running `/knowledge-flow graduate <V>`.

## Steps

1. **Setup** — reuse the workspace setup block from `SKILL.md` (resolves `$_WS`, `$SPECS`). No `WORKSPACE.md` found → error, do nothing.

2. **Detect shipped** (shell only, dots escaped for the anchor):
```bash
V="v1.4.7"                                   # version arg
V_ESC=$(echo "$V" | sed 's/\./\\./g')
ROW=$(grep -E "^\|[[:space:]]*${V_ESC}[[:space:]]*\|" "$SPECS/versions.md")
STATUS=$(echo "$ROW" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$4); print $4}')
```
   `$STATUS` must equal `shipped`. Anything else → refuse, write nothing, report the actual status.

3. **Ordering check** (shell only) — Mirrors comes from `current-index.md`'s sync-status table, compared by row position in `versions.md` (chronological order, not semver math):
```bash
MIRRORS=$(grep -E "^\|[[:space:]]*\*\*Mirrors\*\*[[:space:]]*\|" "$SPECS/current/current-index.md" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3}')
[ "$MIRRORS" = "—" ] && MIRRORS=""          # template placeholder = never graduated
MIRRORS_LINE=$(grep -nE "^\|[[:space:]]*$(echo "$MIRRORS" | sed 's/\./\\./g')[[:space:]]*\|" "$SPECS/versions.md" | cut -d: -f1)
V_LINE=$(grep -nE "^\|[[:space:]]*${V_ESC}[[:space:]]*\|" "$SPECS/versions.md" | cut -d: -f1)
```
   - `$V_LINE` empty (grep missed) → refuse: "$V not found in versions.md" — stop, write nothing.
   - `$MIRRORS` empty (row value `—`, or no sync-status block at all) → **first run**: skip the stale check (step 4), proceed straight to step 5. Step 8 fills the block (or creates it if absent).
   - `$MIRRORS` non-empty but `$MIRRORS_LINE` empty (Mirrors value doesn't match any row — corrupted state) → refuse: "can't locate Mirrors ($MIRRORS) in versions.md" — stop, write nothing. Never evaluate `-lt`/`-eq`/`-gt` on an empty string.
   - `$V_LINE -lt $MIRRORS_LINE` → refuse: "current/ mirrors a newer version ($MIRRORS) than $V — graduating $V would roll it backward." Write nothing.
   - `$V_LINE -eq $MIRRORS_LINE` → current already mirrors `$V`; branch on `versions/$V/_frozen.md`:
     - Exists → already graduated **and** retired → print "already graduated", stop. No-op.
     - Missing → **resume**: the fold already landed but retire never happened. Skip steps 4-8 entirely (no re-fold, no sync-status rewrite) and go straight to **Gate 2** (retire confirmation).
   - `$V_LINE -gt $MIRRORS_LINE` → forward graduate, proceed to step 4 unaffected.

4. **Stale check** (shell only) — shipped versions sitting between Mirrors and `$V` in `versions.md` row order. Use an `awk` range (`NR>a && NR<b`), never `sed -n "a,b p"` — when Mirrors and `$V` are adjacent rows (the common single-step graduate) `b` equals `a+1` and a `sed` range inverts to `a+1,a`, which on BSD/macOS `sed` prints the start line instead of nothing, false-flagging `$V`'s own row as "stale":
```bash
awk -v a="$MIRRORS_LINE" -v b="$V_LINE" 'NR>a && NR<b' "$SPECS/versions.md" | grep -E "\|[[:space:]]*shipped[[:space:]]*\|"
```
   Any hits → warn, list them, ask the user how to proceed (graduate those first / skip and fold `$V` only / abort). Never silently skip. Adjacent rows (`V_LINE == MIRRORS_LINE + 1`) always yield an empty set — no warning.

5. **Build the fold set** — content types only, by filename suffix. Test the dir explicitly first — a `find | sort` pipeline returns `sort`'s exit code, not `find`'s, so a missing dir would otherwise go unnoticed:
```bash
[ -d "$SPECS/versions/$V" ] || DIR_MISSING=1
find "$SPECS/versions/$V" -type f \( -name "*-api.md" -o -name "*-database.md" -o -name "*-ui-ux.md" -o -name "*-system-design.md" -o -name "*-design-tokens.md" \) | sort
```
   - `$DIR_MISSING` set → stop here: "versions/$V/ does not exist — nothing to graduate." Do not update `Mirrors`, do not write `_frozen.md`, do not reach Gate 1 or Gate 2.
   - Everything else under `versions/$V/` (tasks, index, traceability, bd/qa/design docs) is **skipped** — list the skipped files too.
   - Fold set above empty (dir exists, no content specs) → stop here: "versions/$V/ has no content specs to fold — nothing to graduate." Same non-actions as above.

6. **Path transform**, per fold candidate: `versions/<V>/<dir>/<V>-<rest>.md` → `current/<dir>/current-<rest>.md` (root-level: `versions/<V>/<V>-<rest>.md` → `current/current-<rest>.md`). Preserve the folder, strip the leading `<V>-`, prefix `current-`.

   **Content transform** — never fold version-bound content verbatim:

   | Source | Folded into `current/` |
   |---|---|
   | `title: "… (<V>)"` | `title: "… (Current)"` — `new` targets only |
   | `version: <V>` | dropped — `new` targets only |
   | `status: draft` / `in-progress` | `status: active` — `new` targets only |
   | Existing target's frontmatter | untouched — fold edits the body only. Sole exception: `status: stub` → `status: active` |
   | Image link `…/assets/versions/<V>/<path>` | re-anchored from the **target's** dir: `current/<repo>/` → `../../assets/versions/<V>/<path>`, `current/` → `../assets/versions/<V>/<path>`. Discard the source's `../` prefix — depth differs |
   | Inline `<V>` mentions in body text | kept — history, not a path |

7. **Per-section plan** — print BEFORE any write, one row per (file, section) the fold touches, one bucket per row, by comparing only that section of the target:
   - `new` — target doesn't exist yet
   - `surgical-update` — target exists, new content is purely additive
   - `conflict` — target exists, the relevant section differs — needs a user pick. A section that both adds **and** changes lines is a `conflict`, never `surgical-update`
   - `removed` — `$V` explicitly removes something `current/` documents (a `Removed`/`Deprecated` section, ~~struck~~ row). Never infer removal from absence — version specs may be deltas
   - `unchanged` — target already matches

   Add a `Length` column: projected target lines vs the budget in the target's template (`Budget when filled: ≤ N lines` — repo stubs: 60). Template has no budget line (`current-system-design.md`, `*-design-tokens.md`) → default 60. Over budget → flag `over-budget`.

8. **Gate 1 — fold approval** (AskUserQuestion): show the plan, resolve every `conflict` (which side wins), confirm every `removed` (delete or keep), and cut every `over-budget` fold until it fits — never write an over-budget target. On approval:
   - Write `new`/`surgical-update`/resolved-`conflict`/confirmed-`removed` files as surgical named-section edits to `current/{repo}/*` — never a whole-file rewrite.
   - Update `current/current-index.md` sync-status: `Mirrors` → `$V`, `Last synced` → today, `Previous version` → old Mirrors.
   - First run (block holds `—` placeholders) → fill it: `Mirrors` = `$V`, `Last synced` = today, `Previous version` stays `—`. No block at all (pre-template workspace) → create it in the `init-workspace` `current-index.md` template's format.
   - Add Files-table rows for any brand-new `current/` files; flip the Status column `stub` → `active` for every folded target.

9. **Gate 2 — retire confirmation** (separate AskUserQuestion, after Gate 1 lands): "Retire `versions/$V/` now?"
   - Yes → write `versions/$V/_frozen.md` (marker below).
   - No → stop. `current/` is folded; `$V` stays un-retired until graduate is re-run.

10. Confirm: "Graduated `$V` → `current/`. Commit with: `git add ... && git commit -m \"docs: graduate $V into current\"`"

## `_frozen.md` marker

```
# Frozen — graduated to specs/current/
graduated: YYYY-MM-DD
folded-into: specs/current/
note: versions/ is never edited after release (frozen). See current/ for the living spec.
```

## Surgical edit rules

- Identify the exact section each fold touches — never rewrite a whole `current/` file
- New `current/` files use `current-{repo}-{type}.md`; `current-index.md` IS updated, per step 8 (sync-status + Files rows only, still surgical) — the untouched-in-place rule applies to the OTHER singletons (`versions.md`, `roadmap.md`, `wiki.md`, `tasks.md`, `backlog.md`)
- Preserve all surrounding content exactly; never reformat or reorder
- Never touch `archived/` — the content-type allowlist and specs-only paths already exclude it
- Never commit — output only, print the suggested commit message

## Graduate checklist

- [ ] Version status confirmed `shipped` in `versions.md` before any write
- [ ] Ordering guard enforced — refuse if `$V` row precedes Mirrors; if equal, branch on `_frozen.md` (present → no-op, absent → resume straight to Gate 2); first run (no Mirrors yet) skips the stale check
- [ ] `$V` not found in `versions.md`, or Mirrors set but unresolvable, refuses cleanly — never hits bash arithmetic on an empty string
- [ ] Stale shipped versions between Mirrors and `$V` surfaced, not silently skipped
- [ ] Fold set limited to content-type files; skipped files listed
- [ ] Missing `versions/$V/` dir or empty fold set aborts before Gate 1 — `Mirrors` untouched, no `_frozen.md`
- [ ] Content transform applied — `new` targets get `(Current)` title, no `version:`, `status: active`; image links re-anchored to the target's depth
- [ ] Per-section plan (new/surgical-update/conflict/removed/unchanged + Length) shown before Gate 1; stub targets flipped to `active` (frontmatter + Files table)
- [ ] Conflicts and removals resolved by explicit user pick, not auto-merge; mixed add+change sections bucketed `conflict`
- [ ] No target written over its template's line budget
- [ ] `current-index.md` sync-status updated (Mirrors, Last synced, Previous version) + Files table — `—` placeholders filled on first run; block created only if missing
- [ ] Gate 2 retire confirmation is separate from Gate 1 fold approval
- [ ] `_frozen.md` written only after an explicit "yes" to retire
- [ ] Nothing committed — user commits manually
