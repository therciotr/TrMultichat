#!/usr/bin/env bash
set -euo pipefail

prompt="${1:-}"

# Git may ask for either Username or Password in HTTPS auth.
if [[ "$prompt" == *Username* ]]; then
  echo "${GIT_USERNAME:-}"
  exit 0
fi

if [[ "$prompt" == *Password* ]]; then
  echo "${GITHUB_TOKEN:-}"
  exit 0
fi

# Fallback: return token for any other prompt.
echo "${GITHUB_TOKEN:-}"

