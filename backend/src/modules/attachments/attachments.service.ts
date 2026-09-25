import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { AttachableEntityType } from './attachable-entity-types';
import { STORAGE_PROVIDER, StorageProvider, DownloadTarget } from '../storage/storage-provider.interface';

/** Only common business document/image types — never executables or scripts. */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  /**
   * Every upload is verified against the ACTUAL target record,
   * scoped to the caller's company — entityId by itself proves
   * nothing (there is no database-level foreign key to any single
   * table for a polymorphic reference), so this map is the entire
   * ownership boundary.
   */
  private async assertEntityOwnership(companyId: string, entityType: AttachableEntityType, entityId: string): Promise<void> {
    const checks: Record<AttachableEntityType, () => Promise<{ id: string } | null>> = {
      customer: () => this.prisma.customer.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      lead: () => this.prisma.lead.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      opportunity: () => this.prisma.opportunity.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      quotation: () => this.prisma.quotation.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      project: () => this.prisma.project.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      work_order: () => this.prisma.workOrder.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      task: () => this.prisma.task.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      invoice: () => this.prisma.invoice.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      bill: () => this.prisma.bill.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      purchase_order: () => this.prisma.purchaseOrder.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      fixed_asset: () => this.prisma.fixedAsset.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      vendor: () => this.prisma.vendor.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      employee: () => this.prisma.employee.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
      interaction: () => this.prisma.interaction.findFirst({ where: { id: entityId, companyId, deletedAt: null }, select: { id: true } }),
    };

    const check = checks[entityType];
    if (!check) {
      throw new UnprocessableEntityException(`Unsupported attachment entity type: ${entityType}`);
    }
    const found = await check();
    if (!found) {
      throw new NotFoundException(`${entityType} not found.`);
    }
  }

  /**
   * MIME type and size are ALSO enforced at the controller's
   * FileInterceptor config (fileFilter + limits), so a request is
   * rejected before ever reaching here; the checks below are a
   * second, defense-in-depth layer, not the only gate.
   */
  async upload(
    companyId: string,
    actorUserId: string,
    dto: UploadAttachmentDto,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(`File type "${file.mimetype}" is not allowed.`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new UnprocessableEntityException(`File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
    }

    await this.assertEntityOwnership(companyId, dto.entityType, dto.entityId);

    // The original filename is METADATA ONLY — it never becomes a
    // path component. The actual stored name is fully randomized,
    // and only its extension is derived (safely) from the
    // original, purely so a downloaded file opens correctly.
    const safeExt = extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
    const storedFileName = `${randomUUID()}${safeExt}`;

    await this.storage.upload(`${companyId}/${storedFileName}`, file.buffer, file.mimetype);

    // Two-step create: documentGroupId must reference a real row's
    // id, but a brand-new document's FIRST version has no group to
    // join yet — it starts its own, which means pointing at
    // itself. A single INSERT cannot reference the id it is about
    // to generate, so this creates the row first (documentGroupId
    // temporarily meaningless) and immediately corrects it to its
    // own id in a second statement, before returning.
    const created = await this.prisma.attachment.create({
      data: {
        companyId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        fileName: file.originalname,
        storedFileName,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedBy: actorUserId,
        documentGroupId: randomUUID(), // placeholder, corrected below — never left pointing at a nonexistent row for longer than this one request
      },
    });
    return this.prisma.attachment.update({ where: { id: created.id }, data: { documentGroupId: created.id } });
  }

  /**
   * Uploads a NEW version of an existing document — the previous
   * version's row is kept (for history) but flipped to
   * isCurrentVersion: false; the new row becomes the current one,
   * with versionNumber = the group's current max + 1. Signatures
   * on the OLD version stay exactly where they are (see migration
   * 105's comment on why they are never carried forward).
   */
  async uploadNewVersion(
    companyId: string,
    actorUserId: string,
    previousAttachmentId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    const previous = await this.prisma.attachment.findFirst({ where: { id: previousAttachmentId, companyId } });
    if (!previous) throw new NotFoundException('Attachment not found.');

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(`File type "${file.mimetype}" is not allowed.`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new UnprocessableEntityException(`File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
    }

    const currentMax = await this.prisma.attachment.aggregate({
      where: { documentGroupId: previous.documentGroupId },
      _max: { versionNumber: true },
    });
    const nextVersionNumber = (currentMax._max.versionNumber ?? previous.versionNumber) + 1;

    const safeExt = extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
    const storedFileName = `${randomUUID()}${safeExt}`;
    await this.storage.upload(`${companyId}/${storedFileName}`, file.buffer, file.mimetype);

    return this.prisma.$transaction(async (tx) => {
      await tx.attachment.updateMany({ where: { documentGroupId: previous.documentGroupId }, data: { isCurrentVersion: false } });
      return tx.attachment.create({
        data: {
          companyId,
          entityType: previous.entityType,
          entityId: previous.entityId,
          fileName: file.originalname,
          storedFileName,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          uploadedBy: actorUserId,
          documentGroupId: previous.documentGroupId,
          versionNumber: nextVersionNumber,
          isCurrentVersion: true,
        },
      });
    });
  }

  /** Every version of one document, newest first — includes who signed each one, if anyone has. Accepts ANY version's id (not specifically the current one) and resolves the shared documentGroupId internally, since a caller browsing history may only have an old version's id at hand. */
  async listVersions(companyId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id: attachmentId, companyId } });
    if (!attachment) throw new NotFoundException('Attachment not found.');

    return this.prisma.attachment.findMany({
      where: { companyId, documentGroupId: attachment.documentGroupId },
      orderBy: { versionNumber: 'desc' },
      include: {
        uploadedByUser: { select: { id: true, email: true } },
        signatures: { include: { signedByUser: { select: { id: true, email: true } } } },
      },
    });
  }

  async findAllForEntity(companyId: string, entityType: AttachableEntityType, entityId: string) {
    await this.assertEntityOwnership(companyId, entityType, entityId);
    return this.prisma.attachment.findMany({
      // Only the CURRENT version of each document shows in the
      // main list — older versions clutter this view and are
      // reachable via listVersions() instead.
      where: { companyId, entityType, entityId, isCurrentVersion: true },
      orderBy: { createdAt: 'desc' },
      include: { uploadedByUser: { select: { id: true, email: true } } },
    });
  }

  /** Returns a DownloadTarget (stream a local path, or redirect to a presigned URL) only after confirming the attachment belongs to the caller's company. */
  async getDownloadInfo(companyId: string, id: string): Promise<{ target: DownloadTarget; fileName: string; mimeType: string }> {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, companyId } });
    if (!attachment) throw new NotFoundException('Attachment not found.');
    const target = await this.storage.getDownloadTarget(`${companyId}/${attachment.storedFileName}`);
    return { target, fileName: attachment.fileName, mimeType: attachment.mimeType };
  }

  /**
   * Hard delete, both the database row and the physical file — an
   * attachment carries no financial audit-trail requirement.
   * Deleting the CURRENT version of a multi-version document
   * promotes the next-most-recent version back to current, so the
   * document never ends up with zero current version while older
   * ones still exist.
   */
  async remove(companyId: string, id: string) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, companyId } });
    if (!attachment) throw new NotFoundException('Attachment not found.');

    await this.prisma.attachment.delete({ where: { id } });
    await this.storage.delete(`${companyId}/${attachment.storedFileName}`);

    if (attachment.isCurrentVersion) {
      const nextCurrent = await this.prisma.attachment.findFirst({
        where: { documentGroupId: attachment.documentGroupId },
        orderBy: { versionNumber: 'desc' },
      });
      if (nextCurrent) {
        await this.prisma.attachment.update({ where: { id: nextCurrent.id }, data: { isCurrentVersion: true } });
      }
    }
  }
}
