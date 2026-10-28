# UC-03: Promote Research → New Versioned Spec

**Goal**: Verify that promote creates a correctly named new spec file and marks the research article as promoted.

---

## Setup

Create a research article ready to promote:

```bash
cat > local/research/ideas/leaderboard-feature.md << 'EOF'
---
title: "Leaderboard Feature — Global & Friends Rankings"
type: research
category: ideas
source: local/raw/notes/leaderboard-idea.md
compiled: 2026-04-24
status: draft
---

# Leaderboard Feature

> Source: `local/raw/notes/leaderboard-idea.md` | Compiled: 2026-04-24

## Summary

Add a leaderboard screen showing top predictors by win rate, total PnL, and streak.
Two tabs: Global (all users) and Friends (followed users only).
Drives engagement and social competition — aligns with v1.5 social layer goals.

## Key Points

- Global tab: top 100 by win rate (min 10 predictions), refreshed daily
- Friends tab: ranked among followed users, real-time
- Tapping a user opens their public profile
- Own rank always shown at bottom of list even if outside top 100

## Promotion Candidates

- New screen spec for `app-mobile`: leaderboard tab under the feed tab
- New screen spec for `app-web`: `/leaderboard` route under `(main)` layout group
- Backend: needs a new `/leaderboard` endpoint returning ranked users
EOF
```

---

## Command

```
/knowledge-flow promote
```

When prompted:
- Select: `leaderboard-feature.md`
- Target: A) New spec in `specs/versions/v1.5/`
- Repo: `app-mobile`
- Type: `ui-ux`

---

## Expected LLM Actions

1. Runs `grep -rl "^status: draft"` — finds `leaderboard-feature.md`
2. Shows frontmatter preview via `head -15`
3. Asks user to select — user picks `leaderboard-feature.md`
4. Reads the full research article
5. Asks target destination — user selects option A
6. Lists existing versions: `ls specs/versions/`
7. Proposes filename: `v1.5-mobile-ui-ux.md`
8. **Checks for collision**: `find specs/ -name "v1.5-mobile-ui-ux.md"` — finds existing file
9. Flags collision, asks user for a different name (e.g., `v1.5-mobile-leaderboard-ui-ux.md`)
10. Confirms full path: `specs/versions/v1.5/app-mobile/v1.5-mobile-leaderboard-ui-ux.md`
11. Writes the spec file
12. Surgically updates `local/research/ideas/leaderboard-feature.md` frontmatter:
    - `status: draft` → `status: promoted`
    - Adds `promoted-to: specs/versions/v1.5/app-mobile/v1.5-mobile-leaderboard-ui-ux.md`
    - Adds `promoted-at: 2026-04-24`

---

## Verification Checklist

- [ ] `specs/versions/v1.5/app-mobile/v1.5-mobile-leaderboard-ui-ux.md` exists
- [ ] Spec filename is globally unique: `find specs/ -name "v1.5-mobile-leaderboard-ui-ux.md" | wc -l` = 1
- [ ] Spec contains the leaderboard screen description
- [ ] Research article frontmatter: `status: promoted`
- [ ] Research article frontmatter: `promoted-to:` points to correct path
- [ ] Research article frontmatter: `promoted-at:` is today
- [ ] LLM checked for filename collision before writing
- [ ] No other spec files were modified

---

## Teardown

```bash
rm local/research/ideas/leaderboard-feature.md
rm specs/versions/v1.5/app-mobile/v1.5-mobile-leaderboard-ui-ux.md
```
