# Knowledge Flow — Use Cases

Use these to verify the skill works correctly before relying on it in production.

Each use case defines:
- **Setup** — files to create before running
- **Command** — what to invoke
- **Expected actions** — what the LLM should do (and not do)
- **Verification** — how to confirm it worked

## Use Cases

| File | Tests |
|------|-------|
| `uc-01-status-detects-new.md` | Status correctly identifies new raw files without reading content |
| `uc-02-compile-article.md` | Compile a web clip into a research article, checkpoint updated |
| `uc-03-promote-new-spec.md` | Promote idea → new versioned spec file, frontmatter updated |
| `uc-04-promote-surgical-update.md` | Promote research → surgical edit to existing `specs/current/` file |
| `uc-05-full-flow.md` | End-to-end: status → compile → promote in one session |
| `uc-06-graduate.md` | Graduate a shipped version: content transform, `removed` bucket, sync-status fill, Gate 2 resume |

## How to run

1. Create the setup files listed in the use case
2. Run the command from the workspace root
3. Check each item in the verification checklist
4. Tear down: remove the test files created during the run

> Never run use cases against real `specs/current/` files — use the test fixtures provided.
