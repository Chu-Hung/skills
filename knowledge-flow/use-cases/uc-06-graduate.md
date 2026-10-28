# UC-06: Graduate a Shipped Version → `specs/current/`

**Goal**: Verify graduate folds a shipped version with the content transform, `removed` bucket, sync-status fill, and the declined-Gate-2 resume path.

---

## Setup

Run in a throwaway fixture workspace — never a real `specs/`.

```bash
WS=$(mktemp -d) && cd "$WS" && touch WORKSPACE.md
mkdir -p specs/current/backend specs/versions/v1.1/backend specs/versions/v1.1/web

cat > specs/versions.md << 'EOF'
| Version | Target | Status | Repos |
|---------|--------|--------|-------|
| v1.0 | TBD | shipped | |
| v1.1 | TBD | shipped | |
EOF

# current-index from the init-workspace template (Mirrors = —)
cp <dreamer-skills>/init-workspace/assets/templates/current-index.md specs/current/

cat > specs/current/backend/current-backend-api.md << 'EOF'
---
title: "Backend — API (Current)"
type: api
repo: backend
status: active
---
## Endpoints
| Method | Path |
|---|---|
| GET | /markets |
| DELETE | /legacy |
EOF

cat > specs/versions/v1.1/backend/v1.1-backend-api.md << 'EOF'
## Endpoints
| Method | Path |
|---|---|
| GET | /markets |
| POST | /follows |
## Removed
- `DELETE /legacy` — dropped in v1.1
EOF

cat > specs/versions/v1.1/web/v1.1-web-ui-ux.md << 'EOF'
---
title: "Web — UI/UX (v1.1)"
type: ui-ux
repo: web
version: v1.1
status: draft
---
## Screens
![feed](../../../assets/versions/v1.1/web/feed.png)
EOF

echo "- [ ] build follows" > specs/versions/v1.1/v1.1-backend-tasks.md
```

---

## Command

```
/knowledge-flow graduate v1.1
```

- Gate 1 → approve; confirm the `removed` row (delete)
- Gate 2 → **No**
- Re-run `/knowledge-flow graduate v1.1` → Gate 2 → **Yes**
- Re-run once more

---

## Expected LLM Actions

1. `$STATUS` = `shipped`; `$MIRRORS` = `—` → treated as first run, stale check skipped
2. Fold set = `v1.1-backend-api.md`, `v1.1-web-ui-ux.md`; `v1.1-backend-tasks.md` listed as skipped
3. Plan rows: backend-api `## Endpoints` = `surgical-update` (adds `/follows`; the missing `/legacy` row is absence, not removal); backend-api `/legacy` = `removed` (from `## Removed`); web-ui-ux = `new`; `Length` column shown, nothing over budget
4. Gate 1 writes; Gate 2 declined → no `_frozen.md`
5. Re-run: `V_LINE == MIRRORS_LINE`, no `_frozen.md` → resume straight to Gate 2 (no re-fold, sync-status untouched)
6. Final re-run: `_frozen.md` present → "already graduated", no-op

---

## Verification Checklist

- [ ] `current/backend/current-backend-api.md` has `POST /follows`, no `DELETE /legacy`; frontmatter unchanged
- [ ] `current/web/current-web-ui-ux.md` frontmatter: title `(Current)`, no `version:`, `status: active`
- [ ] Image link reads `../../assets/versions/v1.1/web/feed.png` (re-anchored, not copied verbatim)
- [ ] No `current-backend-tasks.md` created
- [ ] Sync Status: `Mirrors` = `v1.1`, `Last synced` = today, `Previous version` = `—`
- [ ] Files table gained a `current-web-ui-ux.md` row
- [ ] After first run: no `_frozen.md`; after resume: `specs/versions/v1.1/_frozen.md` exists
- [ ] Resume run did not change `Last synced` or `Previous version`
- [ ] Nothing committed

---

## Teardown

```bash
rm -rf "$WS"
```
