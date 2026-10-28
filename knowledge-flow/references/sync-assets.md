# Sync Assets Procedure

> Load this file when running `/knowledge-flow sync-assets` or when status shows unsynced images.

## Steps

1. **List unsynced images** (shell only):
```bash
comm -23 \
  <(find "$RAW/images" -type f | sed "s|$RAW/images/||" | sort) \
  <(find "$SPECS/assets" -type f | xargs -I{} basename {} | sort)
```

2. **Show the list** to user. Ask which image(s) are finalized and ready to sync.
   "Finalized" = ready to be referenced in a published spec. Drafts/iterations stay in `local/raw/images/`.

3. **For each selected image**, ask:
   - **Target location**:
     - `specs/assets/current/{repo}/` — for current spec images
     - `specs/assets/versions/{version}/` — for versioned spec images
   - **New filename** (globally unique, descriptive):
     Format: `{version}-{repo}-{description}.{ext}`
     Example: `v1.5-app-mobile-feed-card-component.png`

4. **Show copy plan**, confirm, then execute:
```bash
cp "$RAW/images/{original}" "$SPECS/assets/{target}/{new-name}.{ext}"
```

5. **Append to manifest** — record the raw path so status knows it's been synced:
```bash
echo "{original}" >> "$RAW/images/_manifest.md"
```

6. Ask: "Reference this image in a spec file now?"
   - If yes: ask which spec file, then surgical edit to inject:
     `![{description}](../../assets/{target}/{new-name}.{ext})`
   - Adjust relative path based on the spec file's location in `specs/`

6. Confirm: "Synced {N} image(s). Commit with: `assets: add {description}`"

## Design canvas captures — bypass path

PNGs produced by `specs/scripts/tools/capture-design-canvas.mjs` are already finalized.
They land directly in `specs/assets/versions/<V>/` and **do not go through `local/raw/images/`**.
Do not add them to the `_manifest.md` — the manifest only tracks manually collected images.
Do not prompt the user to run sync-assets for these; they are already in place.

---

## Naming rules

- Must be globally unique across all of `specs/assets/` (Obsidian shows filenames only)
- Use kebab-case
- Include version prefix: `current-` or `vX.X-`
- Be descriptive enough to identify without context: `v1.5-app-mobile-feed-card-empty-state.png` not `empty-state.png`
