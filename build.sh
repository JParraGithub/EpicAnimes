#!/usr/bin/env bash
# Exit on error so Render stops the build when something fails.
set -o errexit

# Install the declared dependencies.
pip install -r requeriments.txt

# Collect static assets for deployment.
python manage.py collectstatic --no-input

# Apply any outstanding migrations before the app starts.
python manage.py migrate
