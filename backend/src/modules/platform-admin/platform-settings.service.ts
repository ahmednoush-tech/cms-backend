import { Injectable, Inject, UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { STORAGE_PROVIDER, StorageProvider, DownloadTarget } from '../storage/storage-provider.interface';

const SETTINGS_ID = '00000000-0000-0000-0000-00000000005e';

export const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

const PUBLIC_LOGO_PATH = '/api/v1/platform-settings/logo';

function inferLogoMimeType(logoKey: string): string {
  const ext = logoKey.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

/**
 * Mizan's own editable product identity — see migration 081's
 * comment. Every screen showing Mizan's own branding should fetch
 * this via the PUBLIC endpoint rather than the old static
 * common:productName/productTagline translation keys.
 */
@Injectable()
export class PlatformSettingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  /** logoUrl is rewritten from the raw stored key to the stable public serving path — same reasoning as company-settings' logo-url.util.ts. Never return the raw key to a client. */
  private withPublicLogoPath<T extends { logoUrl: string | null }>(settings: T): T {
    return { ...settings, logoUrl: settings.logoUrl ? PUBLIC_LOGO_PATH : null };
  }

  async get() {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!settings) {
      throw new Error('Platform settings row is missing — migration 081 should have seeded it.');
    }
    return this.withPublicLogoPath(settings);
  }

  async update(dto: UpdatePlatformSettingsDto) {
    await this.get();
    const updated = await this.prisma.platformSettings.update({ where: { id: SETTINGS_ID }, data: dto });
    return this.withPublicLogoPath(updated);
  }

  /**
   * Uploaded through the same StorageProvider abstraction as
   * Attachments and the tenant-company logo (see
   * company-settings.service.ts's uploadLogo) — NOT direct
   * fs.writeFile to this one server's disk, which had the exact
   * same real, disclosed problem: invisible to requests landing on
   * a different app instance behind a load balancer. logoUrl now
   * stores the STORAGE KEY, never a directly-servable path.
   */
  async uploadLogo(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(`Logo file type "${file.mimetype}" is not allowed — use JPEG, PNG, WebP, or SVG.`);
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      throw new UnprocessableEntityException(`Logo exceeds the maximum allowed size of ${MAX_LOGO_SIZE_BYTES / (1024 * 1024)} MB.`);
    }

    const rawSettings = await this.prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!rawSettings) {
      throw new Error('Platform settings row is missing — migration 081 should have seeded it.');
    }

    if (rawSettings.logoUrl) {
      // rawSettings.logoUrl here is the raw stored KEY (read
      // straight from Prisma, never through withPublicLogoPath) —
      // exactly what storage.delete() needs.
      await this.storage.delete(rawSettings.logoUrl);
    }

    const safeExt = extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '') || '.png';
    const key = `platform/platform-${randomUUID()}${safeExt}`;
    await this.storage.upload(key, file.buffer, file.mimetype);

    const updated = await this.prisma.platformSettings.update({ where: { id: SETTINGS_ID }, data: { logoUrl: key } });
    return this.withPublicLogoPath(updated);
  }

  /** Resolves the stored key to an actual DownloadTarget — used by PlatformSettingsController's logo endpoint, called fresh on every request (see company-settings' equivalent for why). */
  async getLogoDownloadTarget(): Promise<{ target: DownloadTarget; mimeType: string }> {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!settings?.logoUrl) throw new NotFoundException('No platform logo is set.');
    const target = await this.storage.getDownloadTarget(settings.logoUrl);
    return { target, mimeType: inferLogoMimeType(settings.logoUrl) };
  }
}
