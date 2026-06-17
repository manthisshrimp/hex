#!/usr/bin/env bash
set -euo pipefail

# Run from the repo root:  bash bundle/deploy-fly.sh

if ! command -v fly &>/dev/null; then
  echo "fly CLI not found. Install it from https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

fly auth whoami &>/dev/null || fly auth login

# Prompt for app name
read -rp "App name (e.g. octiron-yourname) [octiron]: " APP_NAME
APP_NAME="${APP_NAME:-octiron}"

# Prompt for region
read -rp "Region [ams]: " REGION
REGION="${REGION:-ams}"

# Check if the app already exists
IS_NEW_APP=true
if fly apps list 2>/dev/null | grep -q "^$APP_NAME\b"; then
  IS_NEW_APP=false
fi

if $IS_NEW_APP; then
  # Prompt for password only on first deploy
  read -rsp "Admin password (used to log in to all apps): " ADMIN_PASSWORD
  echo
  read -rsp "Confirm password: " ADMIN_PASSWORD_CONFIRM
  echo
  if [[ -z "$ADMIN_PASSWORD" ]]; then
    echo "Password cannot be empty."
    exit 1
  fi
  if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then
    echo "Passwords do not match."
    exit 1
  fi
fi

# Update fly.toml with chosen name and region
sed -i "s/^app = .*/app = \"$APP_NAME\"/" bundle/fly.toml
sed -i "s/^primary_region = .*/primary_region = \"$REGION\"/" bundle/fly.toml

# Create the app (skip if it already exists)
if $IS_NEW_APP; then
  fly apps create "$APP_NAME" 2>/dev/null || echo "App $APP_NAME already exists, continuing."
  # Set the password secret on new deployments only
  fly secrets set ADMIN_PASSWORD="$ADMIN_PASSWORD" --app "$APP_NAME"
else
  echo "App $APP_NAME already exists — skipping password update."
fi

# Create the data volume if it doesn't exist
if ! fly volumes list --app "$APP_NAME" 2>/dev/null | grep -q octiron_data; then
  fly volumes create octiron_data --app "$APP_NAME" --region "$REGION" --size 1
fi

# Set up Tigris backup storage (skip if already configured)
if ! fly storage list --app "$APP_NAME" 2>/dev/null | grep -q .; then
  echo "Setting up automatic backups (Tigris object storage)..."
  fly storage create --app "$APP_NAME" --name "${APP_NAME}-backups" 2>/dev/null \
    || echo "Backup storage already exists, continuing."
fi

# Deploy
fly deploy --app "$APP_NAME" --config bundle/fly.toml

echo ""
echo "Deployed! Your apps are at:"
echo "  https://$APP_NAME.fly.dev/dashboard/  ← start here"
echo "  https://$APP_NAME.fly.dev/calendar/"
echo "  https://$APP_NAME.fly.dev/expenses/"
echo "  https://$APP_NAME.fly.dev/inventory/"
echo "  https://$APP_NAME.fly.dev/habits/"
echo "  https://$APP_NAME.fly.dev/todo/"
echo "  https://$APP_NAME.fly.dev/mood/"
echo ""
echo "Log in with the password you set. Backups run nightly and appear in the dashboard."
