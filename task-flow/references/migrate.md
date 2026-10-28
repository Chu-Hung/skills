# Migrate Procedure

> Load when running `/task-flow migrate`.
> Use when a team repo (frontend, backend, or admin) has been created on GitHub
> and its issues should move out of specs.

## When to migrate

Trigger: user runs `/task-flow migrate area:frontend` (or backend, admin) after creating the repo.

## Step 1 — List candidates

```bash
# Find open issues in specs with the target area + team-appropriate types
gh issue list \
  --repo "$ORG/specs" \
  --state open \
  --label "area:$AREA" \
  --json number,title,labels,milestone,body,url,projectItems \
  --limit 200 | \
  python3 -c "
import json,sys
data = json.load(sys.stdin)
team_types = {'type:feature','type:bug','type:chore'}
filtered = [i for i in data if any(l['name'] in team_types for l in i['labels'])]
print(json.dumps(filtered))
  "
```

Show as a table. Ask user: "Migrate all N issues, or select specific ones?"

## Step 2 — Verify target repo exists

```bash
gh repo view "$ORG/$TARGET_REPO" --json name -q .name || \
  echo "ERROR: $ORG/$TARGET_REPO does not exist. Create it first."
```

Run `assets/label-setup.sh $ORG/$TARGET_REPO` if labels haven't been set up.

## Step 3 — Migrate each confirmed issue

For each issue:

```bash
# 1. Create in target repo (preserve labels, milestone, and project)
#    PROJECT_TITLE = original's project (projectItems[0].title), else the default; neither → omit → backlog
NEW_LABELS=$(echo "$ISSUE_LABELS" | tr '\n' ',')
NEW_URL=$(gh issue create \
  --repo "$ORG/$TARGET_REPO" \
  --title "$TITLE" \
  --body "$BODY

---
*Migrated from $ORG/specs#$OLD_NUM — original: $OLD_URL*" \
  --label "$NEW_LABELS" \
  --milestone "$MILESTONE" \
  ${PROJECT_TITLE:+--project "$PROJECT_TITLE"} \
  --json url -q .url)

# 2. Close original in specs with migration note
gh issue comment "$OLD_NUM" --repo "$ORG/specs" \
  --body "Migrated to $NEW_URL"
gh issue close "$OLD_NUM" --repo "$ORG/specs"
```

## Step 4 — Update .task-flow config

Add the new repo to TEAM_REPOS if not already there:

```bash
# Edit $_WS/.task-flow
# Change: TEAM_REPOS=frontend
# To:     TEAM_REPOS=frontend,backend  (example)
```

Print the new config line for the user to confirm before writing.

## Step 5 — Sync

Run sync to regenerate `tasks.md` with the new repo included.

## Notes

- `type:research`, `type:spec`, `type:design`, `type:issue` are NEVER migrated — they stay in specs.
- If an issue has multiple area labels (e.g. `area:frontend,area:backend`), do not auto-migrate. Ask user which repo owns it.
- Migration is one-way. Do not create a back-reference in the new repo pointing to specs.
