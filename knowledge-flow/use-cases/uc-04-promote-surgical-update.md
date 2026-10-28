# UC-04: Promote Research → Surgical Update to Existing Spec

**Goal**: Verify that promoting to an existing spec applies a surgical edit — adding a new section without touching unrelated content.

---

## Setup

**Step 1**: Create research article:

```bash
cat > local/research/tech-spikes/jupiter-swap-slippage.md << 'EOF'
---
title: "Jupiter Swap — Slippage Configuration Findings"
type: research
category: tech-spikes
source: local/raw/notes/swap-slippage-spike.md
compiled: 2026-04-24
status: draft
---

# Jupiter Swap — Slippage Configuration

> Source: `local/raw/notes/swap-slippage-spike.md` | Compiled: 2026-04-24

## Summary

Investigated optimal slippage settings for Jupiter Swap integration.
Default 0.5% slippage causes failed txs during volatile markets.
Dynamic slippage based on token volatility improves success rate significantly.

## Key Points

- Static 50 bps slippage fails ~12% of txs in volatile markets
- Jupiter's `dynamicSlippage` param auto-adjusts based on market conditions
- Recommended: enable `dynamicSlippage: { maxBps: 300 }` as default
- For stable-to-stable swaps, keep static 10 bps
- Always set `prioritizationFeeLamports: "auto"` to avoid priority fee failures

## Promotion Candidates

- Add a "Slippage Configuration" section to `current-backend-api.md` under the swap module docs
EOF
```

**Step 2**: Note the current line count of the target spec:

```bash
wc -l specs/current/backend/current-backend-api.md
```

---

## Command

```
/knowledge-flow promote
```

When prompted:
- Select: `jupiter-swap-slippage.md`
- Target: B) Surgical update to `specs/current/backend/current-backend-api.md`

---

## Expected LLM Actions

1. Runs `grep -rl "^status: draft"` — finds `jupiter-swap-slippage.md`
2. Shows frontmatter preview via `head -15`
3. User selects `jupiter-swap-slippage.md` — reads it fully
4. User selects option B (surgical update)
5. **Does NOT read the entire `current-backend-api.md`** — searches for the relevant section:
   ```bash
   grep -n "swap\|Swap\|SWAP" specs/current/backend/current-backend-api.md
   ```
6. Reads only the swap section (targeted Read with offset/limit)
7. Identifies the correct insertion point (after the swap section header)
8. Applies surgical edit: inserts a new "### Slippage Configuration" subsection
9. Does not modify any other lines
10. Updates research article frontmatter: `status: promoted`, `promoted-to:`, `promoted-at:`

---

## Verification Checklist

- [ ] `specs/current/backend/current-backend-api.md` contains a new "Slippage Configuration" section
- [ ] New section mentions `dynamicSlippage`, `maxBps: 300`, and stable-to-stable exception
- [ ] Line count of `current-backend-api.md` increased by the expected number of new lines
- [ ] No existing content in `current-backend-api.md` was removed or modified
- [ ] Research article frontmatter: `status: promoted`
- [ ] Research article frontmatter: `promoted-to: specs/current/backend/current-backend-api.md`
- [ ] LLM used targeted Read (not full file read) before editing

---

## Teardown

```bash
rm local/research/tech-spikes/jupiter-swap-slippage.md
# Manually revert the surgical edit to current-backend-api.md
# (use git diff or remove the added section)
```
