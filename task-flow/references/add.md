# Add / Report Procedure

> Load when running `/task-flow add` or `/task-flow report`.

---

## Step 0 — Roadmap/version pre-check (workspace mode only)

Skip this step entirely in standalone mode.

Before asking for any issue fields, anchor the task to a roadmap version:

1. Read `specs/roadmap.md` — if it doesn't exist, warn and ask the user to run `/task-flow roadmap` first or type `skip` to bypass
2. List active milestones from the specs repo:
   ```bash
   gh api "repos/$ORG/specs/milestones" -q '.[].title'
   ```
3. Present roadmap version headings + milestone list + "backlog" option
4. Ask: **"Which version does this task belong to?"**
5. Validate the choice:
   - If a named version is chosen but has **no milestone** on any repo yet → **block**: "Run `/task-flow version {name}` to create the milestone first, then retry."
   - If "backlog" → proceed; milestone field will be set to `backlog`
   - If roadmap skipped → proceed; remind at the end to update the roadmap

This gate exists because tasks without a version context are hard to prioritize and often never get done.

---

## Add — required fields

Collect in order. Do not create the issue until all required fields are confirmed.

| Field | Required | Rule |
|---|---|---|
| Title | yes | See naming rules below. ≤72 chars. |
| Type | yes | One of 7 types. See taxonomy in SKILL.md. |
| Area | yes | One or more area labels. If multiple, ask which is primary for routing. |
| Milestone | yes | `v1.0`, `v1.1`, … or `backlog`. Must exist on target repo — verify first. |
| Body | recommended | See body template below. |

## Title naming rules

Pattern by type — always start with a capital verb, no trailing period:

| Type | Pattern | Example |
|---|---|---|
| `feature` | `Add {feature} to {component}` | `Add checkout flow to payment page` |
| `bug` | `Fix {symptom} in {component}` | `Fix cart total rounding in checkout` |
| `chore` | `Refactor/Update/Remove {thing}` | `Refactor auth middleware to use JWT` |
| `research` | `Research {topic} for {context}` | `Research Solana pay integration options` |
| `spec` | `Document {topic} spec` | `Document product listing API spec` |
| `design` | `Design {screen} for {flow}` | `Design product card for storefront` |
| `issue` | `{Component}: {symptom}` | `Checkout: payment fails on mobile Safari` |

**Reject these patterns** — rewrite before creating:
- Vague: "Fix bug", "Update stuff", "Improvements"
- Ownership language: "We should…", "Need to…", "I want…"
- Past tense: "Added X", "Fixed Y"
- Question form: "How do we handle X?"

## Body template (all types except type:issue)

> **Budget: ≤ 25 lines.** What/Why ≤ 3 bullets each. Flow → diagram; comparison → table; prose last resort. Over budget → cut, don't compress.

```markdown
## What
- {bullet — what this task does; ≤ 3 bullets}

## Why
- {bullet — motivation or business reason; ≤ 3 bullets}

## Acceptance criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

## Notes
- {constraint, spec link, or related issue — ≤ 3 bullets; omit section if none}

---
*Created via /task-flow add on {date}*
```

## Production issue body template (type:issue only)

> **Budget: ≤ 30 lines.** Summary ≤ 2 bullets. Over budget → cut, don't compress.

```markdown
## Summary
- {bullet — what is broken; ≤ 2 bullets}

## Reporter
{name or "user report" / "team report"}

## Severity
{critical / high / medium / low}

## Steps to reproduce
1. {step}
2. {step}

## Expected vs actual
- **Expected:** {behavior}
- **Actual:** {behavior}

## Impact
{who is affected, how many users, revenue impact if known}

## Environment
{platform, version, browser if applicable}

---
*Reported via /task-flow report on {date}*
```

## Pre-creation checklist

- [ ] Milestone exists on target repo (`gh api repos/{org}/{repo}/milestones -q '.[].title'`)
- [ ] Default project resolved — unset → asked `create` / `blank` (SKILL.md § Default project)
- [ ] Labels exist on target repo (run `assets/label-setup.sh` if first issue on that repo)
- [ ] Routing confirmed — correct repo selected per `references/routing.md`
- [ ] Full draft presented to the user
- [ ] **Explicit approval received** before `gh issue create`

## Draft-and-approve flow (mandatory)

Never call `gh issue create` without first presenting a complete draft and getting explicit approval.

1. **Render the full draft** in the chat using this format — do not abbreviate, do not omit fields:

   ```
   ── Draft issue ──────────────────────────────────────────────
   Repo:      {org}/{target_repo}
   Title:     {title}
   Type:      type:{type}
   Area:      area:{area}[, area:{area2}]
   Project:   {default project title} → Status: Todo   | — (backlog) if no default
   Milestone: {milestone}
   {Severity: severity:{level}   ← only for type:issue}

   Body:
   {fully rendered body using the template — no placeholders}

   Length:    {N}/{budget} lines
   ─────────────────────────────────────────────────────────────
   ```

   If the body is over budget, cut it and re-render **before** presenting — never show an over-budget draft.

2. **Ask explicitly**: "Approve this draft and create the issue? (`yes` / `edit {field}` / `cancel`)"

3. Handle the response per the **Approval vocabulary** below.

4. Treat silence or ambiguous replies as **not approved**. Ask again rather than assuming.

### Approval vocabulary (canonical — used by `add`, `extract`, `report`)

| Intent  | Accepted tokens                                       | Action                                                                  |
| ------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Approve | `yes`, `approve`, `create`, `all`                     | Proceed to `gh issue create` for the relevant draft(s)                  |
| Subset  | comma-separated indices (e.g. `1,3,5`) — `extract` only | Create only the listed drafts; drop the rest without creating          |
| Revise  | `edit {field}`, `edit N`, or any change request       | Update the draft, re-render the full draft, ask again                   |
| Cancel  | `cancel`, `no`, `none`                                | Stop. Do not create. Do not partially create.                           |

Anything outside this vocabulary (silence, ambiguous reply, off-topic) is treated as **not approved** — re-ask rather than guess.

## gh issue create command (only after explicit approval)

```bash
gh issue create \
  --repo "$ORG/$TARGET_REPO" \
  --title "$TITLE" \
  --body "$BODY" \
  --label "type:$TYPE,area:$AREA" \
  --milestone "$MILESTONE" \
  ${PROJECT_TITLE:+--project "$PROJECT_TITLE"}
# For type:issue also add: --label "severity:$SEVERITY"
# --project only when a default project is set; blank → omit → issue stays in backlog
# No status label — the Project's "Item added" workflow sets Status: Todo
```

## After creation

1. Print the issue URL
2. Say: "Run `/task-flow sync` to update the Obsidian board."
