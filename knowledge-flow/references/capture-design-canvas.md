# Capture Design Canvas Procedure

> Load this file **only** when the user has explicitly asked to run `/knowledge-flow capture`.
> Other commands (`status`, `compile`) must never auto-load this reference or redirect to capture.

> **Always confirm with the user before running the capture tool.** After mode detection and
> parameter discovery, present the planned invocation and wait for explicit approval. Never
> auto-proceed.

The capture tool (`capture-design-canvas.mjs`) screenshots design files and saves PNGs to a
local staging area (`local/captures/`) for review before promotion to `specs/assets/`.

Three modes, auto-detected from file type and content:

| Mode | Trigger | Behavior |
|------|---------|----------|
| `dc` | `.html` with `data-dc-slot` | Screenshots each `[data-dc-slot]` artboard individually |
| `simple` | `.html` without `data-dc-slot` | Full-page screenshot of the entire page |
| `svg` | `.svg` file | Renders SVG at natural size → single PNG |

---

## Step 1 — Verify the tool is installed (shell only)

```bash
TOOL="$SPECS/scripts/tools/capture-design-canvas.mjs"
PKG="$SPECS/scripts/tools/package.json"
NM="$SPECS/scripts/tools/node_modules/puppeteer"

[ -f "$TOOL" ] && echo "tool: OK" || echo "tool: MISSING"
[ -f "$PKG"  ] && echo "pkg:  OK" || echo "pkg:  MISSING"
[ -d "$NM"   ] && echo "deps: OK" || echo "deps: MISSING (run npm install)"
```

If the tool is missing, install it from the skill bundle:

```bash
SKILL_ASSETS=~/.claude/skills/knowledge-flow/assets
mkdir -p "$SPECS/scripts/tools"
cp "$SKILL_ASSETS/capture-design-canvas.mjs" "$SPECS/scripts/tools/"
cp "$SKILL_ASSETS/capture-package.json"      "$SPECS/scripts/tools/package.json"
echo "Copied. Now run: cd $SPECS/scripts/tools && npm install"
```

If deps are missing:
```bash
cd "$SPECS/scripts/tools" && npm install
```

---

## Step 2 — Identify files and detect mode

Check mode for a single file:
```bash
grep -c 'data-dc-slot' "<html-path>"
# > 0 → dc mode
# = 0 → simple mode
# .svg extension → svg mode
```

For DC canvas mode, discover artboard IDs:
```bash
grep -o 'data-dc-slot="[^"]*"' "<html-path>" \
  | sed 's/data-dc-slot="//;s/"//' \
  | sort
```

---

## Step 3 — Confirm capture parameters

| Parameter | DC mode | Simple / SVG mode |
|-----------|---------|-------------------|
| **Version tag** | Which version? (e.g. `v1.0`) | Which version? |
| **Repo / surface** | `web`, `mobile`, `admin`, etc. | same |
| **Output dir** | `local/captures/<group>/` | `local/captures/<group>/` |
| **Prefix** | `<version>-<repo>` | `<version>-<repo>` |
| **Viewport** | n/a (artboard-sized) | `WxH` (e.g. `1440x1024` desktop, `390x844` mobile) |
| **Overflow IDs** | Which need `--unclip`? | n/a |
| **Canvas map** | Build if artboard IDs aren't descriptive | n/a |

**Output always goes to `local/captures/`** — never directly to `specs/assets/` for simple/SVG
captures. DC canvas captures may go to `specs/assets/versions/<V>/` when the design is finalized.

---

## Step 3b — Confirm with user before running

Before running the tool, present the planned invocation to the user and wait for explicit
approval. Example prompt:

> "Ready to capture `<file>` in `<mode>` mode → output to `<out>`. Proceed?"

Do **not** auto-run. If the user has not explicitly approved, stop and ask.

---

## Step 4 — Run the capture

### Simple HTML — single file
```bash
node "$SPECS/scripts/tools/capture-design-canvas.mjs" \
  --html  "<html-path>" \
  --out   "$_WS/local/captures/<group>" \
  --prefix "<version>-<repo>" \
  --viewport 1440x1024
```

### Simple HTML — batch (entire directory)
```bash
node "$SPECS/scripts/tools/capture-design-canvas.mjs" \
  --dir   "<dir-path>" \
  --out   "$_WS/local/captures/<group>" \
  --prefix "<version>-<repo>" \
  --viewport 1440x1024
```

### SVG — batch (entire logos directory)
```bash
node "$SPECS/scripts/tools/capture-design-canvas.mjs" \
  --dir   "<logos-dir>" \
  --ext   svg \
  --out   "$_WS/local/captures/<group>" \
  --prefix "<version>-design-system"
```

### DC canvas — single file
```bash
node "$SPECS/scripts/tools/capture-design-canvas.mjs" \
  --html  "<canvas.html>" \
  --out   "$SPECS/assets/versions/<V>" \
  --prefix <V> \
  --map   "$SPECS/scripts/tools/<V>-canvas-map.json" \
  --unclip <overflow-ids,comma-separated>
```

The tool prints each captured file and a final count:
```
OK  admin-dashboard                          -> v1.0-web-admin-dashboard.png (142 KB)
OK  logo-primary.svg                         -> v1.1-design-system-logo-primary.png (8 KB)
2/2 captured · out: local/captures/desktop
```

Use `--headed` to watch Chrome run (useful when a capture fails silently).

---

## Step 5 — Review captures

Open the output folder and verify:
- Screenshots are full-page and not clipped
- Fonts loaded correctly (fallback system fonts are OK)
- No blank/black frames

```bash
open "$_WS/local/captures/<group>"
```

---

## Step 6 — Record in `_captured.md`

After a successful capture, append the source file path (relative to `local/raw/images/`) to `_captured.md` so that `/knowledge-flow status` knows this file has been processed:

```bash
CAPTURE_MANIFEST="$RAW/images/_captured.md"
# Initialize with header if file doesn't exist
[ ! -f "$CAPTURE_MANIFEST" ] && printf '# Captured Canvases Manifest\n\n> One raw path per line (relative to local/raw/images/). Managed by /knowledge-flow capture — do not edit manually.\n> Used by /knowledge-flow status to show capture status in DESIGN CANVASES and exclude from UNSYNCED IMAGES.\n' > "$CAPTURE_MANIFEST"

# Append source path (relative to local/raw/images/) — skip duplicates
SOURCE_REL=$(echo "<source-file-path>" | sed "s|$RAW/images/||")
grep -qxF "$SOURCE_REL" "$CAPTURE_MANIFEST" || echo "$SOURCE_REL" >> "$CAPTURE_MANIFEST"
```

Do this for every file captured in the current run — one line per source file.

---

## Step 8 — Create the ui-ux spec stub (optional, for DC canvas captures)

After a DC canvas capture that goes directly to `specs/assets/`, write a spec stub.
Target: `specs/versions/<V>/<repo>/` named `<V>-<repo>-ui-ux.md`.

Check for filename collision first:
```bash
find "$SPECS" -name "<V>-<repo>-ui-ux.md"
```

Spec template:
```markdown
---
title: "<Repo> — UI/UX (<V>)"
type: ui-ux
repo: <repo>
version: <V>
source: local/raw/<relative-html-path>
captured: YYYY-MM-DD
status: draft
---

# <Repo> — UI/UX (<V>)

> Captured from design canvas: `local/raw/<relative-html-path>`

## Screens

### <Screen Name>

![<description>](../../assets/versions/<V>/<filename>.png)

<notes about the screen>

## Navigation

## Components
```

---

## Step 9 — Update the version index (DC canvas captures only)

If `specs/versions/<V>/<V>-index.md` exists, surgical edit to add the new spec:
```markdown
| `<V>-<repo>-ui-ux.md` | <repo> | ui-ux |
```

---

## Gotchas

- **Output to `local/` for simple/SVG** — `local/captures/` is staging. Never commit it. Promote to `specs/assets/` via `sync-assets` when the design is finalized.
- **DC canvas → `specs/assets/` directly** — only when the design is team-ready and you want it in the spec.
- **Overflow boards (DC mode)** — matrix/showcase artboards clip at `.dc-card` height. Pass via `--unclip` or they'll be cut off.
- **Puppeteer not found** — always run `npm install` from `specs/scripts/tools/`, not the workspace root.
- **`--headed` for debugging** — if a capture produces blank PNGs or errors, run with `--headed` to watch Chrome.
- **SVG viewport** — the tool reads `viewBox` or `width`/`height` attrs. If neither exists, defaults to 800×600.
- **Batch `--dir`** — processes files in alphabetical order. Use `--ext html` (default) or `--ext svg`.
- **PNGs in `local/captures/` are never added to `_manifest.md`** — that manifest is for `local/raw/images/` only.
- **Captured PNGs in `specs/assets/` bypass `local/raw/images/`** — never add them to `_manifest.md` either.
- **Spec naming** — all files in `specs/` must follow `{version}-{repo}-{type}.md`. Read `spec-naming.md` if unsure.
- **Never commit** — output only; user commits manually.
