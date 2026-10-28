# UC-01: Status Detects New Raw Files

**Goal**: Verify that `/knowledge-flow status` identifies new raw files using `find -newer` without reading any file content.

---

## Setup

```bash
# 1. Ensure checkpoint exists (simulate a previous compile run)
touch local/research/_index.md

# 2. Wait 1 second, then add a new raw file
sleep 1
echo "# Test Article\nSome content about a competitor." > local/raw/articles/test-competitor-notes.md
```

---

## Command

```
/knowledge-flow status
```

---

## Expected LLM Actions

- Runs the `find -newer $CHECKPOINT` shell command
- Runs the `comm -23` shell command for all-time uncompiled files
- Runs `grep -rl "^status: draft"` for promotion candidates
- **Does NOT read any file content** — no Read tool calls on raw files or research files
- Outputs a status report with `test-competitor-notes.md` in "New since last compile"

---

## Verification Checklist

- [ ] `test-competitor-notes.md` appears under "New since last compile"
- [ ] `test-competitor-notes.md` also appears under "Uncompiled (total)"
- [ ] No raw file content was read (no Read tool calls on `local/raw/` files)
- [ ] Checkpoint timestamp is displayed correctly
- [ ] Summary table shows "1" next to "New raw files" and suggests `/knowledge-flow compile`

---

## Teardown

```bash
rm local/raw/articles/test-competitor-notes.md
```
