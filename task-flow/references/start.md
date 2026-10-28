# Start Procedure

> Load when running `/task-flow start`.

Sets the issue's **Project Status → In Progress**, creates a linked branch from `develop`, and opens it in a **git worktree** inside the target repo. When the linked branch is merged via PR, GitHub auto-closes the issue and the Project's built-in workflow moves it to Done — no `Closes #N` keyword, no labels.

## Usage

```
/task-flow start #<id> [repo]
```

- `<id>` — issue number (with or without leading `#`)
- `[repo]` — defaults to `specs` (workspace mode) or the detected standalone repo

## Procedure

```bash
# Resolve args
ISSUE_NUM="${1#\#}"   # strip optional leading '#'
if [ "$STANDALONE" = "true" ]; then
  REPO="${2:-$REPO_NAME}"
else
  REPO="${2:-specs}"
fi

# Optional override from .task-flow: BASE_BRANCH (default: develop)
BASE_BRANCH="${BASE_BRANCH:-develop}"

# 1. Status → In Progress in the issue's own project (status lives in the Project, not labels)
ISSUE_URL=$(gh issue view "$ISSUE_NUM" --repo "$ORG/$REPO" --json url -q .url)
# Issue's own project: number + owner straight from GraphQL — no title lookup (any owner, no 30-item cap)
read -r ISSUE_PROJ_NUM ISSUE_PROJ_OWNER < <(gh api graphql \
  -f o="$ORG" -f r="$REPO" -F n="$ISSUE_NUM" -f query='
  query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){ issue(number:$n){
    projectItems(first:1){ nodes{ project{ number owner{ ...on Organization{login} ...on User{login} } } } } } } }' \
  -q '.data.repository.issue.projectItems.nodes[0].project // empty | "\(.number) \(.owner.login)"')
if [ -n "$ISSUE_PROJ_NUM" ]; then
  # Issue already lives in a project — use that one, not the default
  PROJECT_NUMBER="$ISSUE_PROJ_NUM"
  PROJECT_OWNER="$ISSUE_PROJ_OWNER"
fi
# Not in a project and no default → STOP and ask (SKILL.md § Default project):
#   create → /task-flow project, then re-run · blank → skip status, continue
if [ -n "$PROJECT_NUMBER" ]; then
  # item-add is idempotent — returns the existing item if already in the project
  ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" \
    --url "$ISSUE_URL" --format json -q .id)
  PROJECT_ID=$(gh project view "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json -q .id)
  read -r FIELD_ID OPTION_ID < <(gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" \
    --format json -q '.fields[] | select(.name=="Status")
      | .id + " " + (.options[] | select(.name=="In Progress") | .id)')
  gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
    --field-id "$FIELD_ID" --single-select-option-id "$OPTION_ID" >/dev/null \
    || echo "WARNING: could not set Status → In Progress (check Status field has an 'In Progress' option)."
else
  echo "NOTE: no project — Status not set; issue stays in backlog."
fi

# 2. Verify base branch exists; fall back to repo default if not
if ! gh api "repos/$ORG/$REPO/branches/$BASE_BRANCH" &>/dev/null; then
  FALLBACK=$(gh repo view "$ORG/$REPO" --json defaultBranchRef -q .defaultBranchRef.name)
  echo "WARNING: '$BASE_BRANCH' not found on $ORG/$REPO. Falling back to default branch '$FALLBACK'."
  BASE_BRANCH="$FALLBACK"
fi

# 3. Reuse an existing linked branch if there is one
if EXISTING=$(gh issue develop "$ISSUE_NUM" --repo "$ORG/$REPO" --list 2>/dev/null); then
  EXISTING=$(echo "$EXISTING" | awk 'NR==1 {print $1}')
else
  echo "ERROR: could not check for existing linked branch. Aborting."
  return 1
fi

if [ -n "$EXISTING" ]; then
  BRANCH_NAME="$EXISTING"
  echo "Issue #$ISSUE_NUM already has a linked branch: $BRANCH_NAME"
else
  # 4. Build branch name: <type>/<issue-num>-<slug>
  META=$(gh issue view "$ISSUE_NUM" --repo "$ORG/$REPO" --json title,labels)
  TITLE=$(echo "$META" | jq -r .title)
  TYPE=$(echo "$META" | jq -r '.labels[].name' | grep '^type:' | head -1 | sed 's/^type://')
  SLUG=$(echo "$TITLE" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' \
    | cut -c1-40 \
    | sed 's/-$//')
  BRANCH_NAME="${TYPE:-task}/${ISSUE_NUM}${SLUG:+-$SLUG}"

  # 5. Create the linked branch on the remote
  gh issue develop "$ISSUE_NUM" --repo "$ORG/$REPO" \
    --base "$BASE_BRANCH" --name "$BRANCH_NAME"
fi

# 6. Open the branch in a worktree inside the target repo — never switch the main checkout
LOCAL_DIR=""
if [ "$STANDALONE" = "true" ]; then
  LOCAL_DIR="$_WS"
elif [ -d "$_WS/$REPO/.git" ]; then
  LOCAL_DIR="$_WS/$REPO"
fi

if [ -n "$LOCAL_DIR" ]; then
  # Optional override from .task-flow: WORKTREE_DIR (default: <repo>/.worktrees)
  WT_ROOT="${WORKTREE_DIR:-$LOCAL_DIR/.worktrees}"
  git -C "$LOCAL_DIR" fetch origin "$BRANCH_NAME" 2>/dev/null

  # Branch checked out in the main clone (old start did that) — never work there
  if [ "$(git -C "$LOCAL_DIR" branch --show-current)" = "$BRANCH_NAME" ]; then
    echo "ERROR: '$BRANCH_NAME' is checked out in the main clone ($LOCAL_DIR)."
    echo "Switch it back (git -C \"$LOCAL_DIR\" switch $BASE_BRANCH), then re-run start."
    return 1
  fi

  # Reuse the worktree if this branch is already checked out in one (skip entry 1 = main clone)
  WT_PATH=$(git -C "$LOCAL_DIR" worktree list --porcelain \
    | awk -v b="refs/heads/$BRANCH_NAME" '/^worktree /{p=substr($0,10); n++} n>1 && $0=="branch "b{print p}')

  if [ -z "$WT_PATH" ]; then
    WT_PATH="$WT_ROOT/${BRANCH_NAME//\//-}"
    if git -C "$LOCAL_DIR" show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
      git -C "$LOCAL_DIR" worktree add "$WT_PATH" "$BRANCH_NAME"
    else
      git -C "$LOCAL_DIR" worktree add --track -b "$BRANCH_NAME" "$WT_PATH" "origin/$BRANCH_NAME"
    fi
  fi

  # Keep the default worktree root out of git status — local exclude, never .gitignore
  if [ -z "$WORKTREE_DIR" ]; then
    EXCLUDE="$(git -C "$LOCAL_DIR" rev-parse --path-format=absolute --git-common-dir)/info/exclude"
    grep -qxF '.worktrees/' "$EXCLUDE" 2>/dev/null || echo '.worktrees/' >> "$EXCLUDE"
  fi
  echo "Worktree: $WT_PATH"
else
  echo "NOTE: branch created on the remote. Clone '$ORG/$REPO' into the workspace, then re-run start to get a worktree."
fi

echo "Issue #$ISSUE_NUM → In Progress, branch '$BRANCH_NAME' from '$BASE_BRANCH' in worktree '$WT_PATH' (linked; PR merge will auto-close)."
```

**After the script:** do all work for this task inside `$WT_PATH` (`cd` there). The main checkout stays on its current branch, so parallel tasks never collide.

```text
<repo>/                      # main checkout — untouched
└── .worktrees/              # git-excluded
    ├── feature-42-add-search-bar/
    └── bug-57-fix-login-redirect/
```

## Why a linked branch?

`gh issue develop` records the new branch as a **Development** link on the issue. When a PR is opened from that branch and merged, GitHub closes the linked issue automatically — independent of any `Closes #N` keyword in the PR body. This makes `start → branch → PR → merge → close` work end-to-end with no extra wiring.

## Configuration

`.task-flow` (workspace root, gitignored) may set:

```bash
BASE_BRANCH=develop          # default; use 'main' or 'staging' if your repo differs
WORKTREE_DIR=/abs/path       # optional; default <repo>/.worktrees
```

## Branch naming

Format: `<type>/<issue-num>-<slug>`

- `<type>` — value of the `type:*` label (`feature`, `bug`, `chore`, …); falls back to `task` if absent.
- `<slug>` — issue title lowercased, non-alphanumerics replaced with `-`, capped at ~40 chars, trailing `-` stripped.
- If `<slug>` ends up empty (title was all symbols), the branch is just `<type>/<issue-num>`.

Examples:
- `feature/42-add-search-bar`
- `bug/57-fix-login-redirect`
- `chore/91-bump-eslint`

## Idempotency

- Re-running on an In Progress issue is safe — Status stays the same.
- If the branch already has a worktree, that worktree is reused.
- If the issue already has a linked branch, that branch is reused (no second branch is created).

## Edge cases

- **`develop` doesn't exist** — falls back to the repo's default branch with a warning. Set `BASE_BRANCH` in `.task-flow` to silence it.
- **No `type:*` label on the issue** — branch prefix becomes `task/`.
- **No local clone of the repo** — branch is created on the remote; no worktree. Clone the repo, then re-run `start`.
- **Issue in no project** — added to the default project. No default → ask (§ Default project); `blank` → Status skipped, issue stays in backlog; branch + worktree still happen.
- **Issue in several projects** — the first one is used; mention the others to the user.
- **Cleanup** — after the PR merges: `git -C <repo> worktree remove .worktrees/<name>`.
- **Standalone mode** — `REPO` defaults to the detected standalone repo, and `$_WS` is the repo root, so the worktree lands in `$_WS/.worktrees/`.
- **Multiple type labels** — first one wins (`grep '^type:' | head -1`).
