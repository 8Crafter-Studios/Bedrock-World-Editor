#!/bin/bash
set -euo pipefail

echo "=== Collecting macOS artifacts for notarization ==="

# Find all .zip files produced by Forge (one per arch)
ZIP_FILES=()
while IFS= read -r -d '' zip; do
  ZIP_FILES+=("$zip")
done < <(find out/make -name "*.zip" -type f -print0)

if [ ${#ZIP_FILES[@]} -eq 0 ]; then
  echo "No ZIP files found. Cannot notarize."
  exit 1
fi

echo "Found ZIPs:"
printf ' - %s\n' "${ZIP_FILES[@]}"

# Loop through each ZIP (x64, arm64, or both)
for ZIP_PATH in "${ZIP_FILES[@]}"; do
  echo ""
  echo "=== Submitting $ZIP_PATH to notarytool ==="

  xcrun notarytool submit "$ZIP_PATH" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_ID_APP_SPECIFIC_PASSWORD" \
    --verbose \
    --output-format json > notarize.json

  SUBMISSION_ID=$(jq -r '.id' notarize.json)
  echo "Submission ID: $SUBMISSION_ID"

  echo "Polling for notarization result…"

  # Poll with retries
  for i in {1..60}; do
    if ! xcrun notarytool log "$SUBMISSION_ID" \
      --apple-id "$APPLE_ID" \
      --team-id "$APPLE_TEAM_ID" \
      --password "$APPLE_ID_APP_SPECIFIC_PASSWORD" \
      --verbose \
      --output-format json > log.json 2> log.err; then
        # If the failure is the expected 404 case, keep polling
        if grep -q "Submission log is not yet available" log.err; then
          echo "Log not ready yet, retrying in 30 seconds…"
          sleep 30
          continue
        fi

        echo "Unexpected error from notarytool log:"
        cat log.json
        exit 1
    fi

    # Apple returns 404 for several seconds after upload — this is normal
    if grep -q "Submission log is not yet available" log.err; then
      echo "Log not ready yet, retrying in 30 seconds…"
      sleep 30
      continue
    fi

    if ! jq empty log.json 2>/dev/null; then
      echo "Log not valid JSON yet, retrying in 30 seconds…"
      sleep 30
      continue
    fi

    STATUS=$(jq -r '.status // empty' log.json)

    if [ "$STATUS" = "Accepted" ]; then
      echo "Notarization succeeded for $ZIP_PATH"
      break
    fi

    echo "Status: ${STATUS:-Unknown}, retrying in 30 seconds…"
    sleep 30
  done

  echo "=== Stapling artifacts for this architecture ==="

  # Staple the .app, .dmg, and .zip for this architecture
  # Find matching .app and .dmg by directory
  DIR=$(dirname "$ZIP_PATH")

  APP_PATH=$(find "$DIR" -name "*.app" -type d | head -n 1)
  DMG_PATH=$(find "$DIR" -name "*.dmg" -type f | head -n 1)

  if [ -n "$APP_PATH" ]; then
    echo "Stapling $APP_PATH"
    xcrun stapler staple "$APP_PATH"
  fi

  if [ -n "$DMG_PATH" ]; then
    echo "Stapling $DMG_PATH"
    xcrun stapler staple "$DMG_PATH"
  fi

  # echo "Stapling $ZIP_PATH"
  # xcrun stapler staple "$ZIP_PATH"

done

echo ""
echo "=== All notarization + stapling complete ==="
