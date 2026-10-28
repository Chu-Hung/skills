# UC-05: End-to-End Flow

**Goal**: Verify the full pipeline — status → compile → status again → promote — in a single session.

---

## Setup

```bash
# Ensure checkpoint exists
touch local/research/_index.md

# Add a new raw article (after checkpoint)
sleep 1
cat > local/raw/articles/polymarket-social-layer.md << 'EOF'
# Polymarket Social Features — Research Notes

Polymarket recently launched social profiles and activity feeds.
Key observations:
- Users can follow other traders and see their prediction history
- No direct messaging — feed only
- Activity is public by default, no opt-out
- Feed algorithm: chronological, no ranking
- Engagement: likes on predictions (no comments)
- Mobile: responsive web only, no native app

Opportunity for Foresee:
- Our social layer (v1.5) adds follows + activity feed — this validates the direction
- We can differentiate with: native mobile UX, ranked feed, streaks, comment threads
EOF
```

---

## Session Flow

### Step 1 — Run status

```
/knowledge-flow status
```

**Verify:**
- [ ] `polymarket-social-layer.md` appears under "New since last compile"
- [ ] No file content was read

---

### Step 2 — Compile the article

```
/knowledge-flow compile
```

Select: `polymarket-social-layer.md`

**Verify:**
- [ ] `local/research/competitors/polymarket-social-layer-analysis.md` created (or similar name)
- [ ] Frontmatter: `source: local/raw/articles/polymarket-social-layer.md`
- [ ] Frontmatter: `status: draft`
- [ ] Checkpoint (`_index.md` mtime) updated

---

### Step 3 — Run status again

```
/knowledge-flow status
```

**Verify:**
- [ ] `polymarket-social-layer.md` is **gone** from "New since last compile"
- [ ] `polymarket-social-layer.md` is **gone** from "Uncompiled (total)"
- [ ] New research article appears under "Promotion candidates"

---

### Step 4 — Promote to spec

```
/knowledge-flow promote
```

Select the compiled article.
Target: B) Surgical update to `specs/current/current-system-design.md` — add a competitor note under a relevant section.

**Verify:**
- [ ] `current-system-design.md` has a new competitor reference
- [ ] Surrounding content unchanged
- [ ] Research article: `status: promoted`, `promoted-to:` set

---

### Step 5 — Final status check

```
/knowledge-flow status
```

**Verify:**
- [ ] "Promotion candidates" is now empty (or shows 0)
- [ ] Summary table: all counts are 0 or "Nothing new"
- [ ] "Everything is up to date" if nothing else is pending

---

## Teardown

```bash
rm local/raw/articles/polymarket-social-layer.md
rm local/research/competitors/polymarket-social-layer-analysis.md
# Revert surgical edit to current-system-design.md
```
