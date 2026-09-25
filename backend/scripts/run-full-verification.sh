#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Full Phase 2B verification pipeline.
#
# Performs, in order, exactly what was requested:
#   1. Start a dedicated disposable test PostgreSQL
#   2. Run all migrations against it
#   3. Load minimum seed data
#   4. Run the complete unit test suite
#   5. Run the complete e2e test suite (incl. tenant isolation)
#   6. Print a summary
#
# Usage:
#   ./scripts/run-full-verification.sh
#
# Requires: docker (or docker compose), node >= 20, npm.
# ============================================================

cd "$(dirname "$0")/.."

TEST_DB_URL="postgresql://cms_test:cms_test_password@localhost:5433/cms_test?schema=public"

echo "=== [1/6] Starting dedicated test PostgreSQL (docker-compose.test.yml) ==="
docker compose -f docker-compose.test.yml up -d
echo "Waiting for healthy status..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' cms_test_db 2>/dev/null)" = "healthy" ]; do
  sleep 1
done
echo "Test database is up on localhost:5433."

echo ""
echo "=== [2/6] Installing dependencies ==="
npm install

echo ""
echo "=== [3/6] Applying approved migrations (001-019) and seed data (020-022) ==="
export DATABASE_URL="$TEST_DB_URL"
npx prisma generate
# Applied directly via psql, in filename order — these are the
# approved raw-SQL migrations, not Prisma migration-history
# folders, so `prisma migrate deploy` does not apply here.
for f in prisma/migrations-raw/*.sql; do
  echo "  -> applying $f"
  PGPASSWORD=cms_test_password psql -h localhost -p 5433 -U cms_test -d cms_test -f "$f" -v ON_ERROR_STOP=1
done

echo ""
echo "=== [4/6] Running unit test suite ==="
npm test -- --coverage --colors=false | tee /tmp/unit-test-output.log

echo ""
echo "=== [5/6] Running e2e test suite (tenant isolation, auth, RBAC, soft-delete, duplicates) ==="
DATABASE_URL="$TEST_DB_URL" npm run test:e2e -- --colors=false | tee /tmp/e2e-test-output.log

echo ""
echo "=== [6/6] Summary ==="
echo "Unit test output: /tmp/unit-test-output.log"
echo "E2E test output:  /tmp/e2e-test-output.log"
echo ""
echo "Tear down the test database with:"
echo "  docker compose -f docker-compose.test.yml down -v"
