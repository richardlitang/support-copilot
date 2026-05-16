#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/support_copilot}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export AI_PROVIDER=mock
export SUPPORT_MATCH_THRESHOLD="${SUPPORT_MATCH_THRESHOLD:-0}"

COOKIE_JAR="$(mktemp)"
FIXTURE_FILE="$(mktemp "${TMPDIR:-/tmp}/milestone-fixture.XXXXXX.md")"

cleanup() {
  rm -f "$COOKIE_JAR" "$FIXTURE_FILE"
}
trap cleanup EXIT

cat > "$FIXTURE_FILE" <<'DOC'
# Export setup troubleshooting

Why did the export fail after setup? The export failed after setup because billing setup was incomplete.

## Fix

Finish billing setup, then retry the export from the Exports page.
DOC

echo "Verifying Milestone 1 against ${APP_URL}"

echo "Checking health endpoint..."
curl -fsS "${APP_URL}/api/health" >/dev/null

echo "Checking readiness endpoint..."
curl -fsS "${APP_URL}/api/ready" >/dev/null

echo "Applying migrations..."
npm run db:migrate

echo "Uploading test document..."
UPLOAD_RESPONSE="$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "${APP_URL}/api/upload" -F "files=@${FIXTURE_FILE};type=text/markdown;filename=milestone-export.md")"
DOCUMENT_ID="$(node -e "const data=JSON.parse(process.argv[1]); const doc=data.outcomes?.find((item)=>item.documentId); if (!doc) process.exit(1); console.log(doc.documentId);" "$UPLOAD_RESPONSE")"

echo "Waiting for document ${DOCUMENT_ID} to become ready..."
node --input-type=module -e "
const documentId = process.argv[1];
const appUrl = process.argv[2];
const cookie = process.argv[3];
const deadline = Date.now() + 30000;
while (Date.now() < deadline) {
  const response = await fetch(appUrl + '/api/documents', { headers: { cookie } });
  const payload = await response.json();
  const document = payload.documents?.find((item) => item.id === documentId);
  if (document?.status === 'ready') process.exit(0);
  if (document?.status === 'failed') {
    console.error('Document ingestion failed');
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
console.error('Timed out waiting for document readiness');
process.exit(1);
" "$DOCUMENT_ID" "$APP_URL" "$(tr -s '\t' ' ' < "$COOKIE_JAR" | awk '/support_session_id/ {print "support_session_id="$7}' | tail -n 1)"

echo "Checking chunks, pipeline events, and ingestion job records..."
node --input-type=module -e "
import pg from 'pg';
const documentId = process.argv[1];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const chunks = await client.query('select count(*)::int as count from document_chunks where document_id = \$1', [documentId]);
const events = await client.query('select event_type from pipeline_events where entity_id = \$1 order by created_at asc', [documentId]);
const jobs = await client.query('select status, attempt_count from document_ingestion_jobs where document_id = \$1 order by created_at desc limit 1', [documentId]);
await client.end();
if ((chunks.rows[0]?.count ?? 0) < 1) {
  console.error('Expected document chunks to exist');
  process.exit(1);
}
const eventTypes = events.rows.map((row) => row.event_type);
for (const required of ['DOCUMENT_UPLOADED', 'DOCUMENT_INGESTION_ENQUEUED', 'DOCUMENT_INGESTION_STARTED', 'DOCUMENT_READY']) {
  if (!eventTypes.includes(required)) {
    console.error('Missing pipeline event: ' + required);
    process.exit(1);
  }
}
const latestJob = jobs.rows[0];
if (!latestJob) {
  console.error('Expected document_ingestion_jobs row for uploaded document');
  process.exit(1);
}
if (latestJob.status !== 'completed') {
  console.error('Expected ingestion job status completed, got ' + latestJob.status);
  process.exit(1);
}
" "$DOCUMENT_ID"

echo "Checking investigation returns cited output..."
INVESTIGATION_RESPONSE="$(curl -fsS -b "$COOKIE_JAR" -X POST "${APP_URL}/api/investigate" -H "Content-Type: application/json" -d '{"ticket":"Why did the export fail after setup?","ragEnabled":true,"executionMode":"draft_answer"}')"
node -e "const data=JSON.parse(process.argv[1]); if (!data.customerReply?.claims?.length && !data.claims?.length) process.exit(1); const citations = new Set([...(data.customerReply?.claims ?? []), ...(data.internalDiagnosis?.claims ?? [])].flatMap((claim)=>claim.citations ?? claim.citationIds ?? [])); if (!citations.size) process.exit(1);" "$INVESTIGATION_RESPONSE"

echo "Running tests..."
npm run test

echo "Running typecheck..."
npm run typecheck

echo "Running build..."
npm run build

echo "Milestone 1 verified."
