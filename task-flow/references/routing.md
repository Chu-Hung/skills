# Task Routing Rules

> Load when deciding which repo an issue belongs in.

## Decision tree

```
type:research OR type:spec OR type:design OR type:issue?
  └─▶ specs  (always, no exception)

type:feature OR type:bug OR type:chore?
  └─▶ route by area:
        area:frontend  →  org/frontend
        area:backend   →  org/backend
        area:admin     →  org/admin
        area:infra     →  specs
        area:specs     →  specs
        area:design    →  specs
        multiple areas →  ask user to pick primary area
  └─▶ if target repo doesn't exist on GitHub:
        fall back to specs, add note in issue body:
        "> Temporary: routed to specs until org/{repo} is created."
```

## Area → repo map

| Area label | Target repo | Notes |
|---|---|---|
| `area:frontend` | `org/frontend` | UI, components, pages |
| `area:backend` | `org/backend` | API, services, DB |
| `area:admin` | `org/admin` | Admin panel |
| `area:infra` | `specs` | DevOps, CI/CD, hosting |
| `area:design` | `specs` | Design system, assets |
| `area:specs` | `specs` | Documentation |

## Cross-area issues

If an issue touches multiple team areas (e.g. frontend + backend):
1. Ask user: "Which team owns this?"
2. Other area gets a linked issue or a reference in the body.
3. Do not create duplicate issues across repos.

## Type:issue is always specs

Production issues reported by users or team are tracked centrally in `specs` regardless of which service caused them. When the root cause is identified, a `type:bug` is created in the relevant team repo and linked.
