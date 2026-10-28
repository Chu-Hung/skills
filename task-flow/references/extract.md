# Extract Procedure

> Load when running `/task-flow extract`.

## What extraction does

Reads a knowledge-flow artifact (research article, spec, or ui-ux spec stub) and finds action items that should become GitHub Issues. Offers to create issues for selected items.

## Supported source types

| Source | Typical content to extract |
|---|---|
| Research article (`local/research/`) | Open questions, TODOs, "needs investigation", spikes |
| Spec file (`specs/current/` or `specs/versions/`) | Implementation tasks, "TBD" sections, design gaps |
| UI-UX spec stub (`specs/versions/{V}/{repo}/`) | Frontend component tasks, interaction specs to implement |

## Step 1 — Read the source file

Read it fully. Then scan for action items using these signals:

**Explicit markers:**
- Lines containing `TODO`, `FIXME`, `HACK`, `[ ]` (unchecked checkbox)
- Sections titled: "Open questions", "Next steps", "Action items", "Implementation needed", "TBD", "To be decided"

**Implicit signals:**
- "needs to be built / implemented / designed / decided"
- "will require", "should be", "must be" (when paired with a concrete noun)
- Incomplete spec sections with placeholder text
- Any sentence referencing a component, API, or system that doesn't have a spec yet

## Step 2 — Build candidate list

For each item found, infer:

| Field | How to infer |
|---|---|
| Title | Rephrase as imperative. "Open question: how should auth work?" → "Research auth strategy for {feature}" |
| Type | Design section → `type:design`; code reference → `type:feature`; open question → `type:research`; doc gap → `type:spec` |
| Area | From context (UI component → `area:frontend`; API endpoint → `area:backend`; etc.) |
| Milestone | Match to the spec's version if available, else `backlog` |

Present the candidate list as a table:

```
Found N action items in {source-file}:

#  | Title                          | Type     | Area     | Milestone
---|--------------------------------|----------|----------|----------
1  | Research auth strategy         | research | specs    | backlog
2  | Build payment webhook handler  | feature  | backend  | v1.0
3  | Design checkout flow screen    | design   | design   | v1.0
```

## Step 3 — User selects which to draft

Ask: "Which items should I draft as GitHub Issues? (Enter numbers, 'all', or 'none')"

This is selection only — no issues are created at this step.

## Step 4 — Draft full issues for every selected item

For each selected item, build a complete draft using the same template as the `add` flow (read `references/add.md`). Pre-fill all inferred fields. The body must include the source link defined in § "Link back to source" below.

`{budget}` = the body template's budget in `add.md`: **≤ 25 lines** for every extracted type (extract never infers `type:issue`, the only ≤ 30 type).

Render every draft inline using this format — do not abbreviate, do not omit fields:

```
── Draft 1 of N ─────────────────────────────────────────────
Repo:      {org}/{target_repo}
Title:     {title}
Type:      type:{type}
Area:      area:{area}
Project:   {default project title} → Status: Todo   | — (backlog) if no default
Milestone: {milestone}

Body:
{fully rendered body using the template — no placeholders}

Length:    {N}/{budget} lines
─────────────────────────────────────────────────────────────
```

If a body is over budget, cut it and re-render **before** presenting — never show an over-budget draft.

Show all drafts in a single message so the user can review them together.

## Step 5 — Link back to source

Every draft body must include:

```markdown
## Source
Extracted from: `{relative-path-from-workspace-root}`
```

## Step 6 — Wait for explicit approval

Ask: **"Approve which drafts? (`all` / numbers like `1,3` / `edit N` to revise / `cancel`)"**

Resolve the response using the canonical **Approval vocabulary** in `references/add.md` § "Approval vocabulary". For `extract` specifically, a subset reply (e.g. `1,3,5`) means create only those drafts and drop the unselected drafts without creating them.

Never call `gh issue create` until the user explicitly approves which drafts to create.

## Step 7 — Create the approved drafts

Only after explicit approval, run `gh issue create` for each approved draft (see `references/add.md` § "gh issue create command").

## Step 8 — Confirm

"Created N issues from {source-file}. Run `/task-flow sync` to update the Obsidian board."

## knowledge-flow reminder format

At the end of each knowledge-flow command that produces a new artifact, append exactly:

```
---
Artifact created: `{relative-path}`
Run `/task-flow extract {relative-path}` to scan for action items.
```
