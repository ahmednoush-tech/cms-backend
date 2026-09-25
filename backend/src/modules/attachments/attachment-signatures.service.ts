import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SignAttachmentDto } from './dto/sign-attachment.dto';

/**
 * NOT a legally-binding e-signature system — see migration 105's
 * comment for the full disclosure (no PKI, no identity
 * verification beyond normal login, no certificate chain). This
 * records an acknowledgment: a specific authenticated user
 * clicked "sign" on a specific attachment VERSION, with a
 * timestamp and IP for an audit trail.
 */
@Injectable()
export class AttachmentSignaturesService {
  constructor(private prisma: PrismaService) {}

  async sign(companyId: string, actorUserId: string, attachmentId: string, dto: SignAttachmentDto, ipAddress: string | undefined) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id: attachmentId, companyId } });
    if (!attachment) throw new NotFoundException('Attachment not found.');

    return this.prisma.attachmentSignature.create({
      data: {
        companyId,
        attachmentId,
        signedBy: actorUserId,
        signatureType: dto.signatureType,
        signatureData: dto.signatureData,
        ipAddress,
      },
    });
  }

  async listForAttachment(companyId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id: attachmentId, companyId } });
    if (!attachment) throw new NotFoundException('Attachment not found.');

    return this.prisma.attachmentSignature.findMany({
      where: { attachmentId },
      orderBy: { signedAt: 'desc' },
      include: { signedByUser: { select: { id: true, email: true } } },
    });
  }
}
