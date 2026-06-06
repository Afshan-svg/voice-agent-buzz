#!/bin/sh
set -e

echo "Running database migrations..."
# Clear failed deploy state from earlier broken migration (no-op if already resolved)
npx prisma migrate resolve --rolled-back "20260530173610_whatsapp_messages" 2>/dev/null || true
npx prisma migrate deploy

echo "Seeding database (idempotent)..."
npx prisma db seed || echo "Seed skipped or failed — rooms may already exist"

echo "Starting server..."
exec node dist/app.js
