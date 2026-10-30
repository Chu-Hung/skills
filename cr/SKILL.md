---
name: cr
description: >
  Performs AI-powered code review on Git changes using the `ocr` CLI from
  alibaba/open-code-review. Use when the user asks to review code, review
  a pull request, review staged/unstaged changes, review a commit, or
  compare branches for code quality issues. Produces line-level review
  comments and can automatically apply fixes when requested. With appropriate
  review rules, can detect various types of issues including bugs, security
  vulnerabilities, performance problems, and code quality concerns.
license: Apache-2.0
compatibility: >
  Requires the `ocr` CLI installed (via `npm install -g
  @alibaba-group/open-code-review` or GitHub release binary). Requires a
  configured supported LLM provider before first run (protocols: Anthropic,
  OpenAI Chat Completions, OpenAI Responses, AWS Bedrock).
metadata:
  author: alibaba
  homepage: https://github.com/alibaba/open-code-review
  version: '1.0.0'
---

# Open Code Review (/cr)

A skill for invoking [open-code-review](https://github.com/alibaba/open-code-review) (`ocr`) — an open-source AI code review CLI that reads Git diffs and generates structured, line-level review comments.

## Workflow

### Step 0: Select Review Context and Target

#### 0.1 Detect the mode from the review target's location

The mode depends on **where the review target lives**, not on what is at the
root of the current checkout. Real workspaces (e.g. `~/Workspace/tcg-go`,
`~/Workspace/b06`) look like this:

```
<workspace>/            # NOT a git repo
├── service/ mobile/ admin/ ...   # each its own git repo
├── specs/                        # git repo: living specs + version snapshots
├── docs -> Google Drive ...      # symlink: PM/design sources
├── .worktree/<repo>-<n>/         # worktrees of the repos above
└── .task-flow, AGENTS.md -> ...  # optional workspace config
```

Because `specs/` and `docs/` sit **above** the repo being reviewed, checking the
checkout root always yields Standalone. Instead, walk **up** from the review
target (the PR/branch worktree if one was found, otherwise the current
directory or `--repo` path) to the nearest ancestor that is not a Git checkout
but has `specs/` or `docs/`:

```bash
d=$(cd "$TARGET" && pwd)
WS=""
while [ "$d" != "/" ] && [ "$d" != "$HOME" ]; do
  # -e: `.git` is a file inside worktrees; -d follows the `docs` symlink
  if [ ! -e "$d/.git" ] && { [ -d "$d/specs" ] || [ -d "$d/docs" ]; }; then WS=$d; break; fi
  d=$(dirname "$d")
done
```

- `WS` set → **Workspace mode**. `$WS/specs` and `$WS/docs` are the
  verification sources for Step 3.
- `WS` empty → **Standalone mode**: a single repo with no enclosing workspace.
  Step 3 uses only that repo's own `specs/`/`docs/` if present.

Do not rely on `WORKSPACE.md` (missing or empty in existing workspaces) or on
the checkout's top-level directory listing. Both modes treat `specs/`/`docs/`
the same way during review: they are reserved for post-review verification and
are never passed to OCR as initial background.

#### 0.2 Resolve the repository and worktree

In Workspace mode the workspace holds several repos, so first decide which one
is reviewed:

- **PR input**: map the PR's repository to a child directory by comparing its
  name with `git -C <child> remote get-url origin` for each child repo
  (`TEAM_REPOS` in `<workspace>/.task-flow`, if present, lists the repo names;
  e.g. `tcggo_backend` → `service/`).
- **Branch input**: use the repo the user names; otherwise the repo containing
  the current directory.
- **No target given, cwd is the workspace root** (not a Git repo, so a bare
  `ocr review` fails): run `git -C <child> status --porcelain` per child repo
  and review each repo that has changes separately with `--repo <child>`. If
  none has changes, ask what to review.

Find worktrees with `git -C <repo> worktree list` — authoritative, no guessing.
Worktrees usually live under `<workspace>/.worktree/` or
`<repo>/.worktrees/<branch>/`. Verify the checked-out branch matches the target
before using one. A detached HEAD or different branch is not a match.

#### 0.3 Resolve the review target

When the harness input is a pull request:

1. Read the PR body, linked issues (if any), and existing review comments (if
   any). Summarize their task background, requirements, acceptance criteria,
   constraints, and unresolved review concerns into concise business context.
2. Identify the PR head branch, target/base branch, and repository. The review
   target is always the PR's own base branch on `origin`: for a PR
   `fix/abc -> develop`, review `fix/abc` against `origin/develop`
   (`--from origin/develop --to fix/abc`). Never substitute `main`, `master`,
   or a local (non-`origin/`) base ref.
3. Locate the PR head worktree (0.2). Do not assume a fixed directory.
4. If the worktree exists, run the review from it (`--repo <worktree>`) against
   `origin/<base>`, and detect the mode (0.1) from the worktree path.
5. If the worktree cannot be found, review from the repo's main clone using
   `--from origin/<base> --to <head>` (fetch first if the head is not local),
   and detect the mode from that repo path. Do not assume the current checkout
   represents the PR branch. Never fall back to Standalone just because no
   worktree exists.

When the input identifies a local branch rather than a PR:

1. Identify the branch to review and its target/base branch.
2. If the target branch is not provided, stop and ask which target branch the
   input branch should be reviewed against. Do not guess `main`, `master`, or
   another default (`BASE_BRANCH` in `.task-flow` is a hint to suggest, not an
   answer).
3. Locate the input branch worktree (0.2). If it exists, review the input branch
   against the requested target from that worktree; otherwise use the repo's
   main clone with `--from <target> --to <branch>`. Detect the mode (0.1) from
   that path.

For all other requests (working-copy review), detect the mode from the current
directory. In either mode, build the initial OCR background from the user
request, task details, and any available PR/Issue context — not from the full
specs/docs.

### Step 1: Gather Business Context

Summarize business context before running OCR and pass it via `--background` by
default. For PR input, base the summary on the PR body, linked issue bodies, and
existing PR review comments. For local branch or workspace input, use the user
request and available task context. Keep the summary focused; do not paste full
specs/docs or full review threads.

### Step 2: Run Code Review

**Do not pre-check whether `ocr` is installed** — skip probes like `command -v ocr` or `ocr --version`. Assume the CLI is available and run the review directly; that saves a tool call on the common path. Only if the review fails with `command not found` should you install it per Troubleshooting.

Run the OCR command with appropriate flags. **Always pass the summarized business
context via `--background` by default. Do not use `--background-file` for
specs/docs in the initial review.**

```bash
ocr review --audience agent --background "business context here" [user-args]
```

**Argument handling:**

- **Background context** (RECOMMENDED): use `--background "context"` or `-b "context"` to provide business context for better review quality
- **Default** (no user arguments): reviews staged, unstaged, and untracked changes (workspace mode)
- **Specific commit**: use `--commit` or `-c` to review a single commit against its parent
- **Branch comparison**: use `--from <ref>` and `--to <ref>` to review diff between two refs
- **Timeout**: effective timeout per review group = `--timeout` × review rounds. Default `--timeout 15` with default effort `medium` (2 rounds) gives 30 minutes; `low`/`high` give 15/45 minutes.
- **Concurrency**: default concurrency is 8 file workers; reduce with `--concurrency <n>` if rate limits are hit
- **Preview mode**: use `--preview` or `-p` to preview which files will be reviewed without running the LLM
- **Output file**: use `--output <path>` to write the full result to a file instead of stdout. If the command fails with `unknown flag: --output`, do not continue the review with plain stdout. Ask the user whether to upgrade (`npm i -g @alibaba-group/open-code-review@latest`) and wait for the answer before proceeding. After the user confirms and the upgrade succeeds, rerun with `--output`.
- **Installation**: if `ocr` command is not found, install it by running `npm i -g @alibaba-group/open-code-review`

**Common invocation patterns:**

| User says                                       | Command to run                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "review my changes" / "review the working copy" | `ocr review --audience agent --background "context"`                                                  |
| "review this PR" (base `<base>`, head `<head>`) | `ocr review --audience agent --background "PR/Issue summary" --from origin/<base> --to <head>`        |
| "review feature branch"                         | `ocr review --audience agent --background "context" --from <target> --to <branch>`                    |
| "review commit abc123"                          | `ocr review --audience agent --background "context" --commit abc123`                                  |
| "what would be reviewed?" (dry-run)             | `ocr review --preview`                                                                                                                                        |

**Output mode:**

- Always use `--audience agent` to suppress progress UI and emit only the final summary
- **Prevent output truncation**: For large reviews or restricted tool environments, pass `--output /tmp/ocr_out.txt` and inspect the file in full via a file reading tool instead of piping stdout through `tail` or `head`, which drops earlier review comments.

**On failure:** If `ocr review` exits non-zero (e.g. an LLM connection error), do not retry blindly — consult the Troubleshooting section below for the matching fix before re-running.

### Step 3: Verify Findings Against Specs and Docs

After OCR returns findings, and before reporting or applying fixes, perform a
separate verification pass against relevant `specs/` and `docs/` files. This
pass is intentionally outside the initial OCR prompt to keep review context
small.

Where to look depends on the mode from Step 0.1:

- **Workspace mode**: `$WS/specs` and `$WS/docs`. Read selectively — never
  load whole directories (`docs` is a Google Drive symlink and can be huge).
  - Start from the spec index: `specs/current/current-index.md` or
    `specs/versions.md` / `specs/versions/<version>/<version>-index.md`
    (layout varies per workspace; list `$WS/specs` first).
  - Pick the version/feature from the PR, linked issue, milestone, or branch
    name; use `specs/current/` for behavior that already shipped and the
    matching version snapshot for the change being reviewed.
  - Narrow to the reviewed repo's specs (e.g. `current/service/`, API/DB design
    files) before reading anything in `docs/`. Use `docs/` only for PM/design
    sources the specs defer to.
  - Search `docs/` with symlink-following flags (`rg -L`, `find -L`); plain
    `rg`/`find` skip symlinks and return nothing.
  - If the PR itself is in the `specs` repo, verify against the specs in the
    PR's worktree, not the main clone.
- **Standalone mode**: the repo's own `specs/`/`docs/` if present.

For each finding:

- Check whether the finding is valid under the applicable requirements,
  acceptance criteria, API contracts, and design constraints.
- Mark findings that are invalid or contradicted by the specs/docs as rejected,
  with a short reason.
- Refine the severity or recommendation when the specs/docs provide more precise
  constraints.
- Identify material issues in the changed code that OCR missed when the specs/docs
  clearly require them.

If no relevant specs/docs exist, skip this verification pass and report the OCR
findings as-is, noting that no specification cross-check was available.

### Step 4: Report

OCR output includes structured `severity` (critical / high / medium / low) and `category` (bug / security / performance / maintainability / test / style / documentation / other) on each comment. Present results grouped by severity, discarding `low` severity items that are likely false positives or nitpicks.

### Step 5: Fix

Before applying fixes, check whether the user requested automatic fixes:

- If the user explicitly requested "review and fix" or similar, proceed with automatic fixes
- If the user only requested "review" without fix intent, ask for permission before applying any changes

When the review target is a PR or local branch with a matching worktree, apply
approved fixes in that target branch's worktree (`<pr-worktree>` or
`<branch-worktree>`). Verify the worktree path and checked-out branch before
editing. Never apply those fixes in the current checkout or target/base branch by
accident. If no matching worktree exists, do not edit the main clone's checked-out
branch; report the fixes as suggestions, or ask whether to create a worktree
(`git -C <repo> worktree add`) for the target branch.

When fixing issues and suggestions:

- Focus on critical, high, and medium severity items
- Apply fixes directly to the code when safe and well-defined
- For complex fixes requiring manual intervention, clearly describe what needs to be done
- Always verify fixes with the user before committing

## Output Format

Each comment in OCR's output contains:

- `path`: File path
- `content`: Review comment text
- `start_line` / `end_line`: Line range (both 0 means positioning failed)
- `category`: Issue category (bug, security, performance, maintainability, test, style, documentation, other)
- `severity`: Issue severity (critical, high, medium, low)
- `suggestion_code`: Optional fix suggestion
- `existing_code`: Optional original code snippet
- `thinking`: Optional LLM reasoning process

Present results grouped by severity using this template:

```markdown
## Code Review Results

**Files reviewed**: N
**Issues found**: X critical, Y high, Z medium

### Critical

- **`path/to/file.java:42`** [bug] — Brief description
  > Recommendation: How to fix

### High

- **`path/to/file.java:26`** [bug] — Brief description
  > Recommendation: How to fix

### Medium

- **`path/to/file.ts:88`** [performance] — Brief description
  > Recommendation: How to fix (if applicable)
```

If no critical, high, or medium severity issues remain after filtering, state: "Review complete — no critical, high, or medium issues found in N files."

**Handling mispositioned comments:**

When `start_line` and `end_line` are both `0`, the comment failed to locate the exact position in the file. In such cases:

1. Read the comment content to understand the issue
2. Examine the target file mentioned in the comment
3. Identify the relevant code section based on the comment's context
4. Apply the fix or suggestion to the correct location

## Custom Review Rules

If the user wants project-specific rules, OCR resolves them in this priority order:

1. `--rule <path>` flag (highest)
2. `<repo>/.opencodereview/rule.json`
3. `~/.opencodereview/rule.json`
4. Built-in system defaults (lowest)

By default, the first matching user rule replaces the built-in system rule. Set `merge_system_rule: true` on a rule entry when the matched system rule and user rule should both be included.

Rule file format:

```json
{
  "rules": [
    {
      "path": "**/*.java",
      "rule": "All new methods must validate required parameters for null",
      "merge_system_rule": true
    },
    {
      "path": "**/*mapper*.xml",
      "rule": "Check SQL for injection risks and missing closing tags"
    }
  ]
}
```

To preview which rule applies to a file before reviewing:

```bash
ocr rules check src/main/java/com/example/Foo.java
```

## Advanced Review Options

Beyond the common flags above, `ocr review` exposes a few groups of controls. Run `ocr review --help` for the complete list.

**Scoping**

- `--exclude '<patterns>'` — comma-separated gitignore-style patterns (for example `--exclude '**/generated/*,**/testdata/*'`), merged with `rule.json` excludes.
- `--background-file <path>` — read review context from a Markdown file. Takes precedence over `--background`.

**Output**

- `--format text|json|sarif` — `text` (default) for humans; `json` for machine-readable findings; `sarif` for code-scanning integrations such as GitHub Code Scanning.

**Model**

- `--provider <name>` / `--model <name>` — override the configured provider/model for this run only (for example, to recheck a diff with a different model; the user names the model, `ocr llm providers` lists the built-ins).

**Budget**

- `--max-tokens <n>` — per-group prompt ceiling; defaults to the configured value or the template default (`200000`).
- `--max-tokens-budget <n>` — cap total input + output tokens for the run. Checked before every LLM round: a group already over budget gets one final round to submit findings, no further groups are dispatched, partial results are still published, and skipped files are reported as `failed(budget)`.
- `--no-filter` — keep all review comments and skip the LLM post-filtering call.

## Gotchas

- **LLM must be configured first** — `ocr review` will fail loudly if no LLM is reachable. See the Troubleshooting section below if this happens.
- **Working directory matters** — `ocr review` operates on the Git repo at the current directory. Use `--repo /path/to/repo` to run from elsewhere. A workspace root is not a Git repo, so always pass `--repo <child-repo-or-worktree>` there.
- **Untracked files are reviewed in workspace mode** — running bare `ocr review` includes staged, unstaged, _and_ untracked changes. Stage selectively if you want narrower scope.
- **Large diffs may hit token limits** — `MAX_TOKENS` sets the prompt budget (`200000` in the review template; `ocr scan` uses `58888`); conversation context is compressed to stay within this prompt budget. Model output is capped separately by `MAX_COMPLETION_TOKENS` (`16384`). A file whose diff alone exceeds ~80% of `MAX_TOKENS` is skipped before the LLM is called.
- **Plan phase triggers on either of two thresholds** — a group runs an extra risk-analysis phase before main review when its largest changed file reaches `PLAN_MODE_LINE_THRESHOLD` (default `50`) **or** it holds 2+ files whose combined changed lines reach `PLAN_MODE_GROUP_LINE_THRESHOLD` (default `100`). This adds latency but improves quality.
- **Don't pass `--audience human`** — it streams progress UI that pollutes output. Always use `--audience agent`.
- **Comment language follows config** — the `language` config controls review comment language, defaults to `English`, and accepts any language name (for example `English` or `中文`).
- **Avoid output truncation** — Large review runs produce verbose output. Never pipe command output to `tail` or `head` as it drops review comments from earlier sections. Use `--output <path>` and read it in full; on older CLIs, follow the **Output file** guidance above.
- **Resume an interrupted review** — a failed or interrupted range/commit review can be continued with `ocr review --resume <id>` using the same `--from`/`--to` or `--commit` target (the id is printed as `retry with: --resume <id>` on failure, or find it with `ocr session list`). Workspace resume is not supported.

## Validation

After the review completes, verify success by checking:

1. The command exited with code 0
2. Comments were generated (or "No comments generated" message appears)
3. Warnings (if any) are displayed in stderr

If errors occurred, check the stderr warnings for details about which files failed and why.

## References

- Full docs: https://github.com/alibaba/open-code-review
- NPM package: https://www.npmjs.com/package/@alibaba-group/open-code-review
- Issue tracker: https://github.com/alibaba/open-code-review/issues
