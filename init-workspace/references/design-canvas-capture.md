# Design Canvas Capture Tool

> `specs/scripts/tools/capture-design-canvas.mjs`
> Headless Chrome screenshot capture for design canvases built with DCSection / DCArtboard primitives.
> Outputs finalized PNGs directly to `specs/assets/` — bypasses the `local/raw/images/` → sync-assets flow.

---

## What it does

1. Spins up a local HTTP server over the design folder (allows `<script type="text/babel">` to load)
2. Launches headless Chrome via Puppeteer, waits for the canvas to mount
3. Captures every `[data-dc-slot]` artboard at 2× resolution
4. Writes named PNGs to the output directory

---

## Setup (once per workspace)

```bash
cd specs/scripts/tools
npm install    # installs puppeteer
```

Add to `specs/scripts/tools/`:
- `capture-design-canvas.mjs` — the capture script (copy from reference project or write fresh)
- `package.json` — `{ "type": "module", "dependencies": { "puppeteer": "^24.0.0" } }`
- `{version}-canvas-map.json` — name map for each new version (see below)

---

## Usage

```bash
node specs/scripts/tools/capture-design-canvas.mjs \
  --html  "specs/versions/<V>/design/<Canvas>.html" \
  --out   specs/assets/versions/<V> \
  --prefix <V> \
  --map   specs/scripts/tools/<V>-canvas-map.json \
  --unclip <id1,id2,...>    # artboards whose content overflows the visible area
```

| Flag | Required | Description |
|------|----------|-------------|
| `--html <path>` | yes | Path to the canvas HTML file |
| `--out <dir>` | yes | Output directory — must be under `specs/assets/versions/<V>/` |
| `--prefix <slug>` | yes | Filename prefix, e.g. `v1.5` → outputs `v1.5-<id>.png` |
| `--map <path.json>` | recommended | Override default `<prefix>-<id>` naming with descriptive names |
| `--ids <id,id,...>` | no | Capture only these artboard ids |
| `--unclip <id,id,...>` | no | Remove height/overflow clamp on these artboards (matrix/showcase boards) |
| `--headed` | no | Run Chrome in headed mode for debugging |

---

## Canvas map JSON

Create `specs/scripts/tools/<V>-canvas-map.json` before capturing a new version.
Each key is an artboard `data-dc-slot` id; the value is the output filename (no extension).
Names must be globally unique across all of `specs/assets/` and follow `{version}-{repo}-{description}`.

```json
{
  "home-screen":        "v2.0-mobile-home-screen",
  "profile-screen":     "v2.0-mobile-profile-screen",
  "feed-card-variants": "v2.0-mobile-feed-card-variants"
}
```

---

## Output destination

Captured PNGs land directly in `specs/assets/versions/<V>/` — they are already finalized.
**Do not route them through `local/raw/images/`** — the sync-assets flow is only for manually collected screenshots and Figma exports.

Reference captured images in specs using relative paths:
```markdown
![Feed card](../../assets/versions/v2.0/v2.0-mobile-feed-card-variants.png)
```
(adjust `../../` depth based on the spec file's location inside `specs/`)

---

## Conventions when adding a new version

1. Build the design canvas at `specs/versions/<V>/design/` using DCSection + DCArtboard primitives
2. Create `specs/scripts/tools/<V>-canvas-map.json`
3. Run the capture command — PNGs land in `specs/assets/versions/<V>/`
4. Reference screenshots from the version's UI/UX or handoff spec docs
