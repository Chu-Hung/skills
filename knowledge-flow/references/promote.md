# Promote Procedure

> Load this file when running `/knowledge-flow promote`.

## Steps

1. **List candidates** (shell only):
```bash
grep -rl "^status: draft" "$RESEARCH" --include="*.md" | sort
```

2. **Preview each candidate** — frontmatter only, no full content:
```bash
# For each candidate file:
head -15 "{candidate}"
```
Show a table: filename | category | source | compiled date.

3. **Ask user which to promote** (AskUserQuestion).

4. **Read the selected research article** fully (now we pay the token cost).

5. **Ask where to promote**:
   - **A) New spec in `specs/versions/{version}/`** — new versioned feature spec
   - **B) Surgical update to existing `specs/current/{repo}/` file** — add a section or update existing content
   - **C) New file in `specs/current/{repo}/`** — new living-doc module

6. **Determine the target filename** using spec naming convention.
   When unsure, read `references/spec-naming.md`.
   Always confirm the full path with the user before writing.

7. **For option A or C** — write the new spec file.
   Style: one idea per bullet; flow → diagram, comparison → table, prose last resort; cut anything that doesn't change what the reader does next. Respect the target template's line budget (repo stubs: ≤ 60 lines filled). Over budget → cut, don't compress.
   Before writing, check `Length: {N}/{budget} lines` against the target template's budget — over budget → cut and re-check; never write an over-budget spec.

8. **For option B** — read only the relevant section of the target file, apply surgical edit.
   Never rewrite the entire file. Add or update the specific section only.

9. **Update the research article frontmatter** (surgical edit — first 10 lines only):
```
status: promoted
promoted-to: specs/{relative-path}
promoted-at: YYYY-MM-DD
```

10. Confirm: "Promoted → `{spec-path}`. Commit with: `docs: add {filename}`"

## Surgical edit rules

- Identify the exact section to add or update
- Insert at a logical location (after related content, or at end of relevant section)
- Preserve all surrounding content exactly
- Never change unrelated lines
- Never reformat or reorder existing content

## Promote checklist

- [ ] Spec filename follows `{version}-{repo}-{type}.md`
- [ ] Filename is globally unique across all of `specs/`
- [ ] Research article frontmatter updated to `status: promoted`
- [ ] `promoted-to:` and `promoted-at:` fields added
- [ ] If new file: referenced in the appropriate index (`current-index.md` or `vX.X-index.md`)
