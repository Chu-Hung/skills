# Compile Procedure

> Load this file when running `/knowledge-flow compile` on text/doc files (`.md`, `.txt`, `.pdf`).
>
> **If the selected file is `.html`:** silently skip it — compile is for text/doc files only.
> Do **not** suggest `/knowledge-flow capture`. Capture is opt-in and runs only when the user
> explicitly asks for it.

## Steps

1. **Find candidates** (shell only — no content read):
```bash
# New since last compile
find "$RAW" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" \) -newer "$CHECKPOINT" | sort

# Or all uncompiled (if checkpoint is missing)
comm -23 \
  <(find "$RAW" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" \) | sort) \
  <(grep -rh "^source:" "$RESEARCH" --include="*.md" 2>/dev/null | sed 's/^source: *//' | sort)
```

2. **Present the list** to the user. Ask which file(s) to compile:
   - A) Most recent new file (default)
   - B) Specific file from the list
   - C) All new since last compile (process sequentially, one at a time)

3. **For each selected file** — read it and determine:
   - **Category**: `competitors/`, `market-analysis/`, `tech-spikes/`, or `ideas/`
   - **Filename**: `{topic}-{type}.md` — unique within `local/research/`
   - Confirm: "`{source}` → `local/research/{category}/{filename}.md` — proceed?"

4. **Write the research article** using `assets/research-template.md`.
   Delete the template's instruction HTML comment (sits after the frontmatter) — it is an instruction, never article content.
   Fill every frontmatter field — especially `source:` (this is how tracking works).
   Style: **budget ≤ 40 lines total** — one idea per bullet; flow → diagram, comparison → table, prose last resort; cut anything that doesn't change what the reader does next. Over budget → cut, don't compress.
   Before writing, check `Length: {N}/40 lines` — over budget → cut and re-check; never write an over-budget article.

5. **After all files are compiled**, update the checkpoint:
```bash
touch "$CHECKPOINT"
# Append compile log entry to _index.md (surgical edit — one line)
echo "- $(date '+%Y-%m-%d %H:%M') compiled: {filenames}" >> "$CHECKPOINT"
```

6. Confirm: "Compiled {N} file(s). Checkpoint updated."

## Category guide

| Content | Category |
|---------|----------|
| Competitor products, market players | `competitors/` |
| Market sizing, trends, user research | `market-analysis/` |
| Technical explorations, POCs, library evals | `tech-spikes/` |
| Feature ideas, product concepts | `ideas/` |

## One file at a time

Never read multiple raw files simultaneously. Read, write, confirm — then move to the next.
