/**
 * One-time script to create (or update) a Platform Admin account.
 *
 * WHY THIS IS A SCRIPT, NOT PART OF MIGRATION 080: a SQL migration
 * with a pre-computed password hash baked in would mean a known
 * default credential sits in version control forever — even
 * labeled "change immediately", that is a real, recurring source
 * of production breaches. This script instead reads the actual
 * admin's real email/name/password from environment variables at
 * the moment it's run, so nothing secret is ever committed.
 *
 * USAGE (run once per environment, then discard the env vars):
 *   PLATFORM_ADMIN_EMAIL="ops@mizan.sa" \
 *   PLATFORM_ADMIN_NAME="Mizan Operations" \
 *   PLATFORM_ADMIN_PASSWORD="<a real, strong password>" \
 *   npx ts-node scripts/seed-platform-admin.ts
 *
 * Safe to re-run: upserts by email, so running it again with a new
 * PLATFORM_ADMIN_PASSWORD for the same email rotates that admin's
 * password rather than creating a duplicate.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // matches AuthService.hashPassword() and SignupService exactly

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const name = process.env.PLATFORM_ADMIN_NAME;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!email || !name || !password) {
    console.error('Missing required environment variables: PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_NAME, PLATFORM_ADMIN_PASSWORD.');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('PLATFORM_ADMIN_PASSWORD must be at least 12 characters for an account with cross-company access.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const admin = await prisma.platformAdmin.upsert({
      where: { email },
      create: { email, name, passwordHash },
      update: { name, passwordHash },
    });
    console.log(`Platform admin ready: ${admin.email} (id: ${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
