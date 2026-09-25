import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { enableRlsBypass } from '../../prisma/rls-bypass.util';
import { logoStorageKeyToPublicPath } from './logo-url.util';

@Injectable()
export class PublicCompanyInfoService {
  constructor(private prisma: PrismaService) {}

  /**
   * This system currently has no self-service company signup —
   * every deployment has exactly one active company row, seeded
   * manually. Picking the OLDEST active company is therefore a
   * safe, disclosed assumption for a single-tenant deployment, not
   * a real multi-tenant selection rule; a genuine multi-company
   * product would need this endpoint to accept some per-tenant
   * identifier (subdomain, custom domain, etc.) instead.
   *
   * Only `name` and `logo` are returned — deliberately excludes
   * email, phone, address, and tax number, which have no reason to
   * be visible to an unauthenticated visitor on a login screen.
   * `logo` is rewritten to the stable public serving path, never
   * the raw storage key — see logo-url.util.ts.
   */
  async get() {
    // No JWT, no company context — reachable pre-login by design.
    // See rls-bypass.util.ts.
    await enableRlsBypass();

    const company = await this.prisma.company.findFirst({
      where: { status: 'active', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, logo: true },
    });
    if (!company) throw new NotFoundException('No active company found.');
    return { name: company.name, logo: logoStorageKeyToPublicPath(company.id, company.logo) };
  }
}
