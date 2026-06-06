#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database (idempotent)..."
npx prisma db seed || echo "Seed skipped or failed — rooms may already exist"

echo "Starting server..."
exec node dist/app.js
