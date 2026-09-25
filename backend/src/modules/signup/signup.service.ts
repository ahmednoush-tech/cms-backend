import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { enableRlsBypass } from '../../prisma/rls-bypass.util';
import { SignupDto } from './dto/signup.dto';

const SALT_ROUNDS = 12; // matches AuthService.hashPassword() exactly — see that file's own constant

/**
 * A minimal but genuinely USABLE starting chart of accounts — not
 * an empty shell. Without this, a brand-new company would hit
 * "Finance Settings must have a default X account configured"
 * errors on its very first invoice, bill, or payment. This is
 * deliberately a SINGLE generic template, not an industry-specific
 * chart — a real product would eventually offer a choice here, but
 * one sensible default beats zero accounts.
 */
const STARTER_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset', normalBalance: 'debit' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit' },
  { code: '1200', name: 'Tax Recoverable (Input VAT)', type: 'asset', normalBalance: 'debit' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
  { code: '2100', name: 'Tax Payable (Output VAT)', type: 'liability', normalBalance: 'credit' },
  { code: '3000', name: "Owner's Equity", type: 'equity', normalBalance: 'credit' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue', normalBalance: 'credit' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', normalBalance: 'debit' },
  { code: '5100', name: 'Operating Expenses', type: 'expense', normalBalance: 'debit' },
] as const;

@Injectable()
export class SignupService {
  constructor(private prisma: PrismaService) {}

  async signup(dto: SignupDto) {
    // No company exists for this request yet — that is the entire
    // point of this endpoint — so there is no tenant context to
    // scope by. This is bypass_rls call site #4, alongside
    // JwtStrategy's bootstrap lookup and the two @Public() read
    // endpoints. Unlike those three, this one WRITES a brand new
    // tenant's worth of rows, which is exactly why every affected
    // table's RLS policy includes the
    // `OR current_setting('app.bypass_rls', true) = 'on'` clause
    // in the first place (see migration 064) — an INSERT is
    // checked against the same USING expression as a SELECT.
    await enableRlsBypass();

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.adminEmail }, select: { id: true } });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, SALT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: dto.companyName, status: 'active' },
      });

      const accounts = await Promise.all(
        STARTER_ACCOUNTS.map((a) =>
          tx.account.create({
            data: { companyId: company.id, code: a.code, name: a.name, type: a.type, normalBalance: a.normalBalance },
          }),
        ),
      );
      const byCode = Object.fromEntries(accounts.map((a) => [a.code, a.id]));

      await tx.financeSettings.create({
        data: {
          companyId: company.id,
          defaultCashAccountId: byCode['1000'],
          defaultReceivableAccountId: byCode['1100'],
          defaultTaxRecoverableAccountId: byCode['1200'],
          defaultPayableAccountId: byCode['2000'],
          defaultTaxPayableAccountId: byCode['2100'],
          defaultRevenueAccountId: byCode['4000'],
          defaultExpenseAccountId: byCode['5100'],
        },
      });

      const adminRole = await tx.role.create({
        data: { companyId: company.id, name: 'Administrator', description: 'Full access — created automatically at signup.' },
      });

      const allPermissions = await tx.permission.findMany({ select: { id: true } });
      await tx.rolePermission.createMany({
        data: allPermissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
      });

      const user = await tx.user.create({
        data: { companyId: company.id, name: dto.adminName, email: dto.adminEmail, passwordHash, status: 'active' },
      });

      await tx.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });

      // Deliberately returns only non-sensitive identifiers — never
      // the password hash, and the frontend calls the EXISTING,
      // already-tested /auth/login endpoint next with the same
      // credentials to get properly-built JWTs, rather than this
      // method duplicating that token-claim-building logic.
      return { companyId: company.id, companyName: company.name, userId: user.id, email: user.email };
    });
  }
}
