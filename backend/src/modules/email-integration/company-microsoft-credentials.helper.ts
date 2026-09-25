import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptCredential } from '../../common/utils/credentials-encryption.util';

export interface CompanyMicrosoftCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Fetches and decrypts this company's own Azure App Registration
 * credentials — see migration 074 for why these moved from a
 * server-wide MICROSOFT_CLIENT_ID/SECRET to per-company,
 * admin-configurable settings. The secret is decrypted here, at
 * the point of use for a real Microsoft API call, and is never
 * cached or passed further than the immediate caller needs it for.
 */
export async function getCompanyMicrosoftCredentials(prisma: PrismaService, companyId: string): Promise<CompanyMicrosoftCredentials> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { microsoftClientId: true, microsoftClientSecretEncrypted: true },
  });

  if (!company?.microsoftClientId || !company?.microsoftClientSecretEncrypted) {
    throw new UnprocessableEntityException(
      'Outlook integration is not configured for this company yet — an administrator must set it up under Company Settings first.',
    );
  }

  return {
    clientId: company.microsoftClientId,
    clientSecret: decryptCredential(company.microsoftClientSecretEncrypted),
  };
}
