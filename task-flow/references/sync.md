# Sync Procedure

> Load when running `/task-flow sync`.

## Step 1 — Collect issues from all repos

```bash
ISSUES_JSON="[]"
for REPO in $ALL_REPOS; do
  REPO_ISSUES=$(gh issue list \
    --repo "$ORG/$REPO" \
    --state all \
    --limit 500 \
    --json number,title,labels,milestone,state,url,createdAt,closedAt,assignees,projectItems) \
    || { echo "ERROR: could not read issues from $ORG/$REPO (check 'project' scope) — aborting, board unchanged."; exit 1; }
  # Tag each issue with its repo
  REPO_ISSUES=$(echo "$REPO_ISSUES" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for i in data: i['repo'] = '$REPO'
print(json.dumps(data))
  ")
  ISSUES_JSON=$(echo "[$ISSUES_JSON, $REPO_ISSUES]" | python3 -c "
import json,sys; data=json.load(sys.stdin); print(json.dumps(data[0]+data[1]))
  ")
done

# Status comes from each issue's own project: .projectItems[0].status.name
# No project item → backlog. No project is ever picked here.
```

## Step 2 — Classify by Project Status

Status = `.projectItems[0].status.name` (empty if the issue is in no project).

| Group (output order) | Rule |
|---|---|
| Issues | `type:issue` label, state=open (any Status) |
| One section per Status value | open, in a project, Status ≠ `Todo`/`Done` — `In Progress` first, then any option the team added |
| Todo by milestone | open, in a project, Status = `Todo` or empty — grouped by milestone ascending |
| Backlog | open, **no project** or no milestone |
| ⚠ Done · still open | open, in a project, Status = `Done` — card moved by hand, or PR merged into a non-default branch |
| Done (last 30 days) | state=closed AND closed within 30 days (Status ignored — closed is done) |

## Step 3 — Generate tasks.md

Use the template in `assets/tasks-template.md`. Fill each section with a markdown table.

**Table columns per section:**

Issues section:
```
| # | Title | Area | Severity | Repo | Opened |
```

Status / Todo / ⚠ Done · still open sections:
```
| # | Title | Type | Area | Repo | Milestone |
```

Done section:
```
| # | Title | Type | Area | Repo | Closed |
```

**Row format:**
- `#` column: `[#N](url)` — always link to GitHub Issue
- `Area`: extract all `area:*` labels, strip prefix, join with `/`
- `Type`: extract `type:*` label, strip prefix
- `Severity`: extract `severity:*` label, strip prefix (issues section only)
- `Milestone`: title from milestone object, or `—` if none
- `Opened` / `Closed`: format as `YYYY-MM-DD`

## Step 4 — Write tasks.md

Overwrite `$SPECS/current/tasks.md` entirely. Never append or patch — always full regeneration.

## Step 5 — Generate and write backlog.md

**Backlog = open issues with no milestone or no project**, excluding `type:issue` (those always belong to the Issues table).

Use the template in `assets/backlog-template.md`. One table, columns:
```
| # | Title | Type | Area | Repo | Added |
```

- `Added`: `createdAt` formatted as `YYYY-MM-DD`
- Sort ascending by `createdAt` (oldest first — longest-waiting items surface at the top)

Overwrite `$SPECS/current/backlog.md` entirely. Never append or patch.

## Step 6 — Report

```
Synced {N} issues across {X} repos
  → specs/current/tasks.md
  → specs/current/backlog.md  ({N} unversioned items)

  Issues (open):     {N}
  In Progress:       {N}   ← one line per Status section
  Todo (v1.0):       {N}
  Todo (backlog):    {N}
  ⚠ Done, open:      {N}   ← close them (/task-flow done) or move back
  Done (last 30d):   {N}
```

## Notes

- Closed issues older than 30 days are omitted from the board entirely (keeps it clean).
- Open issues **in no project** go to Backlog — never auto-add them to a project.
- If any repo fetch fails, abort before writing — never overwrite the board with partial or empty data. (`$ALL_REPOS` already drops repos that don't exist.)
- An issue appears in BOTH `tasks.md` (Todo · Backlog section) AND `backlog.md` when it has no milestone or no project. This is intentional — `backlog.md` is the focused, standalone view; `tasks.md` is the full board.
