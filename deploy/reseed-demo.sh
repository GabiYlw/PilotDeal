#!/usr/bin/env bash
# Restores the public demo to the sample data: the seed deletes every company (cascading to
# contacts, deals and interactions), inserts the sample data again and embeds its notes.
# Run daily by cron on the server (see deploy/README.md):
#   17 4 * * * bash /home/ubuntu/PilotDeal/deploy/reseed-demo.sh >> /home/ubuntu/reseed-demo.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

# flock: skip this run if the previous one is still going.
exec 9>/tmp/pilotdeal-reseed.lock
if ! flock -n 9; then
  echo "$(date -Is) previous reseed still running, skipping"
  exit 0
fi

echo "$(date -Is) reseeding the demo database"
docker compose -f docker-compose.prod.yml exec -T api node dist/prisma/seed.js
echo "$(date -Is) done"
