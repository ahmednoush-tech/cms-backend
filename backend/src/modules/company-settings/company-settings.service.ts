import { Injectable, Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { UpdateMicrosoftIntegrationDto } from './dto/update-microsoft-integration.dto';
import { encryptCredential } from '../../common/utils/credentials-encryption.util';
import { STORAGE_PROVIDER, StorageProvider, DownloadTarget } from '../storage/storage-provider.interface';
import { logoStorageKeyToPublicPath, inferLogoMimeType } from './logo-url.util';

export const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Every field EXCEPT microsoftClientId/microsoftClientSecretEncrypted
 * — those are deliberately excluded from the general company
 * settings response and are only ever readable (as a
 * secretConfigured boolean, never the secret itself) through
 * getMicrosoftIntegrationSettings() below. Without this explicit
 * select, get() would use Prisma's default "return every column",
 * which would have silently started leaking the encrypted secret
 * ciphertext the moment those columns were added to the model.
 */
const SAFE_COMPANY_SELECT = {
  id: true,
  name: true,
  legalName: true,
  email: true,
  phone: true,
  website: true,
  logo: true,
  address: true,
  city: true,
  country: true,
  taxNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CompanySettingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  /** logo is rewritten from the raw stored key to the stable public serving path — see logo-url.util.ts. Never return the raw key to a client. */
  private withPublicLogoPath<T extends { id: string; logo: string | null }>(company: T): T {
    return { ...company, logo: logoStorageKeyToPublicPath(company.id, company.logo) };
  }

  async get(companyId: string) {
    const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null }, select: SAFE_COMPANY_SELECT });
    if (!company) throw new NotFoundException('Company not found.');
    return this.withPublicLogoPath(company);
  }

  async update(companyId: string, dto: UpdateCompanySettingsDto) {
    await this.get(companyId);
    const updated = await this.prisma.company.update({ where: { id: companyId }, data: dto, select: SAFE_COMPANY_SELECT });
    return this.withPublicLogoPath(updated);
  }

  /**
   * Uploaded through the same StorageProvider abstraction as
   * Attachments (local disk by default, S3 when a platform admin
   * configures it) — NOT direct fs.writeFile to this one server's
   * disk, which was a real, disclosed problem: a logo uploaded to
   * one app instance behind a load balancer was invisible to
   * requests landing on a different instance. company.logo now
   * stores the STORAGE KEY, never a directly-servable path — see
   * logo-url.util.ts for why, and PublicCompanyInfoController's
   * logo endpoint for how it's actually served.
   */
  async uploadLogo(companyId: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(`Logo file type "${file.mimetype}" is not allowed — use JPEG, PNG, WebP, or SVG.`);
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      throw new UnprocessableEntityException(`Logo exceeds the maximum allowed size of ${MAX_LOGO_SIZE_BYTES / (1024 * 1024)} MB.`);
    }

    const rawCompany = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null }, select: SAFE_COMPANY_SELECT });
    if (!rawCompany) throw new NotFoundException('Company not found.');

    if (rawCompany.logo) {
      // rawCompany.logo here is the raw stored KEY (this method
      // reads it straight from Prisma, never through
      // withPublicLogoPath) — exactly what storage.delete() needs.
      await this.storage.delete(rawCompany.logo);
    }

    const safeExt = extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '') || '.png';
    const key = `logos/${companyId}-${randomUUID()}${safeExt}`;
    await this.storage.upload(key, file.buffer, file.mimetype);

    const updated = await this.prisma.company.update({ where: { id: companyId }, data: { logo: key }, select: SAFE_COMPANY_SELECT });
    return this.withPublicLogoPath(updated);
  }

  /**
   * Resolves the stored key to an actual DownloadTarget — used by
   * PublicCompanyInfoController's logo endpoint, called fresh on
   * every request so an S3-backed logo's presigned URL is always
   * newly issued (they expire in minutes) rather than cached
   * anywhere stale.
   */
  async getLogoDownloadTarget(companyId: string): Promise<{ target: DownloadTarget; mimeType: string }> {
    const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { logo: true } });
    if (!company?.logo) throw new NotFoundException('This company has no logo set.');
    const target = await this.storage.getDownloadTarget(company.logo);
    return { target, mimeType: inferLogoMimeType(company.logo) };
  }

  /**
   * Returns whether a Client Secret has been saved, NEVER the
   * secret's value — not even its ciphertext. This is the only
   * safe way to let a settings screen show "a secret is already
   * configured" without ever transmitting anything secret back
   * over the wire after the initial save.
   */
  async getMicrosoftIntegrationSettings(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { microsoftClientId: true, microsoftClientSecretEncrypted: true },
    });
    if (!company) throw new NotFoundException('Company not found.');
    return {
      clientId: company.microsoftClientId,
      secretConfigured: !!company.microsoftClientSecretEncrypted,
    };
  }

  /**
   * clientSecret is optional on purpose — an admin updating just
   * the Client ID (or the redirect URI elsewhere) should not be
   * forced to re-enter the secret every time, since it is never
   * sent back to the frontend to begin with, so there's nothing
   * for a form to "resubmit unchanged". Only encrypt and overwrite
   * the stored secret when a new one is actually provided.
   */
  async updateMicrosoftIntegrationSettings(companyId: string, dto: UpdateMicrosoftIntegrationDto) {
    await this.get(companyId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        microsoftClientId: dto.clientId,
        ...(dto.clientSecret ? { microsoftClientSecretEncrypted: encryptCredential(dto.clientSecret) } : {}),
      },
      select: { microsoftClientId: true, microsoftClientSecretEncrypted: true },
    }).then((updated) => ({ clientId: updated.microsoftClientId, secretConfigured: !!updated.microsoftClientSecretEncrypted }));
  }
}
