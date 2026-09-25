import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DuplicateCandidate {
  id: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  customerCode: string;
  matchedOn: ('email' | 'phone' | 'companyName')[];
}

export interface CheckDuplicatesInput {
  email?: string;
  phone?: string;
  companyName?: string;
  /** When checking during an UPDATE, exclude the customer's own row from matching against itself. */
  excludeId?: string;
}

/**
 * SOFT detection only — this never blocks a create/update, it only
 * surfaces potential matches for a human to review. A real
 * business can legitimately have two branches sharing a company
 * name, or two contacts sharing a switchboard phone number; the
 * decision to proceed anyway always belongs to the person creating
 * the record. The frontend calls this BEFORE submitting a create,
 * shows any matches as a confirmation step, and lets the user
 * proceed or go back and edit.
 *
 * Matching is EXACT (case-insensitive for text fields), not fuzzy
 * — no similarity/trigram matching is used, since that would
 * require a Postgres extension (pg_trgm) with no precedent
 * anywhere in this codebase. "Acme Corp" and "Acme Corporation"
 * are therefore NOT caught; only exact matches (ignoring case, and
 * ignoring formatting for phone numbers) are. Phone numbers are
 * compared after stripping everything except digits — a
 * deliberately conservative check, not a full phone-number-
 * normalization library.
 */
@Injectable()
export class CustomerDuplicateDetectionService {
  constructor(private prisma: PrismaService) {}

  async checkForDuplicates(companyId: string, input: CheckDuplicatesInput): Promise<DuplicateCandidate[]> {
    const normalizedPhone = input.phone ? input.phone.replace(/\D/g, '') : undefined;

    if (!input.email && !normalizedPhone && !input.companyName) {
      return [];
    }

    const byId = new Map<string, DuplicateCandidate>();
    const baseWhere = {
      companyId,
      deletedAt: null,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    };

    if (input.email || input.companyName) {
      const orConditions: Record<string, unknown>[] = [];
      if (input.email) orConditions.push({ email: { equals: input.email, mode: 'insensitive' as const } });
      if (input.companyName) orConditions.push({ companyName: { equals: input.companyName, mode: 'insensitive' as const } });

      const candidates = await this.prisma.customer.findMany({
        where: { ...baseWhere, OR: orConditions },
        select: { id: true, companyName: true, email: true, phone: true, customerCode: true },
      });

      for (const c of candidates) {
        const matchedOn: DuplicateCandidate['matchedOn'] = [];
        if (input.email && c.email?.toLowerCase() === input.email.toLowerCase()) matchedOn.push('email');
        if (input.companyName && c.companyName?.toLowerCase() === input.companyName.toLowerCase()) matchedOn.push('companyName');
        byId.set(c.id, { ...c, matchedOn });
      }
    }

    if (normalizedPhone) {
      // Phone comparison needs JS-side digit stripping — fetched separately rather than folded into the SQL OR above.
      const withPhone = await this.prisma.customer.findMany({
        where: { ...baseWhere, phone: { not: null } },
        select: { id: true, companyName: true, email: true, phone: true, customerCode: true },
      });
      for (const c of withPhone) {
        if (c.phone?.replace(/\D/g, '') !== normalizedPhone) continue;
        const existing = byId.get(c.id);
        if (existing) {
          existing.matchedOn.push('phone');
        } else {
          byId.set(c.id, { ...c, matchedOn: ['phone'] });
        }
      }
    }

    return Array.from(byId.values());
  }
}
