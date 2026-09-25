import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { enableRlsBypass } from '../../prisma/rls-bypass.util';
import { logoStorageKeyToPublicPath } from '../company-settings/logo-url.util';

/**
 * Deliberately separate from QuotationsService — this is the ONE
 * place in the whole backend where a quotation is looked up with
 * NO authentication at all, so it gets its own tightly-scoped,
 * explicit-select query rather than reusing (and risking drift
 * from) the internal service's fuller view. A draft is excluded
 * for the same reason it's excluded from the customer portal: it
 * may contain pricing that hasn't been finalized to share yet.
 */
@Injectable()
export class PublicQuotationService {
  constructor(private prisma: PrismaService) {}

  async getByToken(token: string) {
    // No JWT, no company context — this route is @Public() by
    // design, reachable via nothing but the quotation's own
    // unguessable UUID token. See rls-bypass.util.ts.
    await enableRlsBypass();

    const quotation = await this.prisma.quotation.findFirst({
      where: { publicToken: token, deletedAt: null, status: { not: 'draft' } },
      select: {
        quotationNumber: true,
        status: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        validUntil: true,
        createdAt: true,
        items: {
          select: { id: true, description: true, quantity: true, unitPrice: true, discount: true, tax: true, total: true },
        },
        customer: { select: { companyName: true } },
        company: { select: { id: true, name: true, logo: true, email: true, phone: true, website: true } },
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found.');
    // company.logo is rewritten from the raw storage key to the
    // stable public serving path — see logo-url.util.ts. Never
    // return the raw key to this fully unauthenticated endpoint.
    return {
      ...quotation,
      company: { ...quotation.company, logo: logoStorageKeyToPublicPath(quotation.company.id, quotation.company.logo) },
    };
  }
}
