# UC-02: Compile a Raw Article

**Goal**: Verify that compile reads only the selected file, writes a valid research article, and updates the checkpoint.

---

## Setup

Create the raw input file:

```bash
cat > local/raw/articles/polymarket-analysis.md << 'EOF'
# Polymarket — competitor notes

- Largest prediction market by volume (~$1B monthly)
- Uses USDC on Polygon
- No social layer, pure trading UI
- Markets are binary (yes/no), not perpetuals
- Web-only, no mobile app
- Audience: crypto-native traders, not casual users
- Resolution: relies on UMA oracle + manual review
- Fees: 2% on winnings
EOF
```

---

## Command

```
/knowledge-flow compile
```

When prompted, select: `local/raw/articles/polymarket-analysis.md`

---

## Expected LLM Actions

1. Runs `find -newer $CHECKPOINT` — shows `polymarket-analysis.md`
2. Asks which file to compile — user selects it
3. **Reads only `polymarket-analysis.md`** — no other files read
4. Determines category: `competitors/`
5. Suggests filename: `polymarket-competitor-analysis.md`
6. Confirms target path before writing
7. Writes `local/research/competitors/polymarket-competitor-analysis.md`
8. Runs `touch local/research/_index.md`
9. Appends log entry to `_index.md`

---

## Verification Checklist

- [ ] `local/research/competitors/polymarket-competitor-analysis.md` exists
- [ ] Frontmatter contains `source: local/raw/articles/polymarket-analysis.md`
- [ ] Frontmatter contains `status: draft`
- [ ] Frontmatter contains `category: competitors`
- [ ] `compiled:` date is today
- [ ] All template sections are present: Summary, Key Points, Key Detail, Promotion Candidates
- [ ] `_index.md` mtime is newer than `polymarket-analysis.md`
- [ ] `_index.md` contains a compile log entry for today
- [ ] Only ONE file was read from `local/raw/` (the selected file)

---

## Follow-up: Run status again

After compile, run `/knowledge-flow status` and verify:
- [ ] `polymarket-analysis.md` no longer appears under "New since last compile"
- [ ] `polymarket-analysis.md` no longer appears under "Uncompiled (total)"
- [ ] `polymarket-competitor-analysis.md` appears under "Promotion candidates"

---

## Teardown

```bash
rm local/raw/articles/polymarket-analysis.md
rm local/research/competitors/polymarket-competitor-analysis.md
```
