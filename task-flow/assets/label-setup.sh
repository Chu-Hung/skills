#!/usr/bin/env bash
# Usage: ./label-setup.sh <org/repo>
# Run once per repo to create all required task-flow labels.
# Safe to re-run — skips labels that already exist.

REPO=${1:?Usage: $0 <org/repo>}

create_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" 2>/dev/null \
    && echo "  created: $name" \
    || echo "  exists:  $name"
}

echo "Setting up labels for $REPO..."

# No status labels — task status lives in the GitHub Project Status field.

echo "--- Type ---"
create_label "type:feature"  "7057ff" "New product functionality"
create_label "type:bug"      "d73a4a" "Code defect"
create_label "type:chore"    "c5def5" "Tech debt, maintenance, refactor"
create_label "type:research" "f9d0c4" "Investigation spike, open question"
create_label "type:spec"     "fef2c0" "Documentation update"
create_label "type:design"   "e4b0f0" "Design work or feedback"
create_label "type:issue"    "b60205" "Production incident / user report"

echo "--- Area ---"
create_label "area:frontend" "bfd4f2" "Frontend / UI"
create_label "area:backend"  "d4c5f9" "Backend / API / DB"
create_label "area:admin"    "c2e0c6" "Admin panel"
create_label "area:design"   "f9e4bc" "Design system / assets"
create_label "area:infra"    "ededed" "DevOps, CI/CD, hosting"
create_label "area:specs"    "ffffff" "Documentation"

echo "--- Severity (type:issue only) ---"
create_label "severity:critical" "b60205" "Service down or data loss"
create_label "severity:high"     "e4312b" "Major feature broken"
create_label "severity:medium"   "f4a261" "Degraded experience"
create_label "severity:low"      "f9d0c4" "Minor issue"

echo "Done."
