import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12; // matches auth.service.ts exactly

// Both already created by migration 020 (which runs automatically
// via `prisma migrate deploy`, before this script ever runs) —
// this script does NOT create the company or the role, only the
// FIRST USER who can actually log in as that role. Migration 021
// (kept in migrations-raw/ for reference, deliberately EXCLUDED
// from the real prisma/migrations/ folder) attempted to seed demo
// users directly in SQL with placeholder strings like
// '$2b$12$hash_super_admin' instead of real bcrypt hashes — those
// are not valid hashes of anything and could never successfully
// log in. This script exists specifically to fix that: it hashes
// a real password with the real bcrypt package at run time.
const DEMO_COMPANY_ID = '11111111-1111-1111-1111-111111111111';
const SUPER_ADMIN_ROLE_ID = '31111111-1111-1111-1111-111111111111';
const ADMIN_USER_ID = '51111111-1111-1111-1111-111111111111';
const ADMIN_EMAIL = 'admin@demo-company.com';
const ADMIN_PASSWORD = 'ChangeMe123!'; // change this immediately after first login — see the printed reminder below.

async function main() {
  const company = await prisma.company.findUnique({ where: { id: DEMO_COMPANY_ID } });
  if (!company) {
    throw new Error(
      `Expected company ${DEMO_COMPANY_ID} to already exist (created by migration 020) — run "npx prisma migrate deploy" first.`,
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existingUser) {
    console.log(`Seed already applied — ${ADMIN_EMAIL} already exists. Nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  await prisma.user.create({
    data: {
      id: ADMIN_USER_ID,
      companyId: DEMO_COMPANY_ID,
      name: 'Admin',
      email: ADMIN_EMAIL,
      passwordHash,
      status: 'active',
    },
  });

  await prisma.userRole.create({
    data: { userId: ADMIN_USER_ID, roleId: SUPER_ADMIN_ROLE_ID },
  });

  console.log('=================================================');
  console.log('Seed complete. Log in with:');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN.');
  console.log('=================================================');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
