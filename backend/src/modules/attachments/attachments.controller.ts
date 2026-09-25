import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AttachmentsService, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from './attachments.service';
import { AttachmentSignaturesService } from './attachment-signatures.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { SignAttachmentDto } from './dto/sign-attachment.dto';
import { ATTACHABLE_ENTITY_TYPES, AttachableEntityType } from './attachable-entity-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

const uploadFileInterceptorOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      callback(new UnprocessableEntityException(`File type "${file.mimetype}" is not allowed.`), false);
      return;
    }
    callback(null, true);
  },
};

@ApiTags('Attachments')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/attachments')
export class AttachmentsController {
  constructor(
    private attachmentsService: AttachmentsService,
    private attachmentSignaturesService: AttachmentSignaturesService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @Permissions('Common:attachments:upload')
  @UseInterceptors(FileInterceptor('file', uploadFileInterceptorOptions))
  upload(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new UnprocessableEntityException('No file was uploaded.');
    }
    return this.attachmentsService.upload(companyId, actorUserId, dto, file);
  }

  @Get()
  @Permissions('Common:attachments:view')
  findAllForEntity(
    @CurrentUser('companyId') companyId: string,
    @Query('entityType') entityType: AttachableEntityType,
    @Query('entityId', ParseUUIDPipe) entityId: string,
  ) {
    if (!ATTACHABLE_ENTITY_TYPES.includes(entityType)) {
      throw new UnprocessableEntityException(`Unsupported attachment entity type: ${entityType}`);
    }
    return this.attachmentsService.findAllForEntity(companyId, entityType, entityId);
  }

  @Get(':id/download')
  @Permissions('Common:attachments:view')
  async download(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { target, fileName, mimeType } = await this.attachmentsService.getDownloadInfo(companyId, id);
    if (target.kind === 'redirect') {
      res.redirect(target.url);
      return;
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(target.filePath);
  }

  /**
   * Streams the file INLINE (Content-Disposition: inline) rather
   * than as a forced download — the browser's own PDF/image
   * viewer opens it directly. Only meaningful for MIME types
   * browsers know how to render natively (PDF, images); anything
   * else falls back to a download anyway, since that is a browser
   * behavior this endpoint has no control over.
   */
  @Get(':id/preview')
  @Permissions('Common:attachments:view')
  async preview(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { target, fileName, mimeType } = await this.attachmentsService.getDownloadInfo(companyId, id);
    if (target.kind === 'redirect') {
      // The presigned URL itself already serves the right Content-Type from the object store's stored metadata — no inline/attachment header to add here, since this app server never touches the bytes for this path.
      res.redirect(target.url);
      return;
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(target.filePath);
  }

  @Post(':id/versions')
  @ApiConsumes('multipart/form-data')
  @Permissions('Common:attachments:upload')
  @UseInterceptors(FileInterceptor('file', uploadFileInterceptorOptions))
  uploadNewVersion(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new UnprocessableEntityException('No file was uploaded.');
    }
    return this.attachmentsService.uploadNewVersion(companyId, actorUserId, id, file);
  }

  @Get(':id/versions')
  @Permissions('Common:attachments:view')
  listVersions(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.listVersions(companyId, id);
  }

  @Post(':id/sign')
  @Permissions('Common:attachments:sign')
  sign(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignAttachmentDto,
    @Ip() ip: string,
  ) {
    return this.attachmentSignaturesService.sign(companyId, actorUserId, id, dto, ip);
  }

  @Get(':id/signatures')
  @Permissions('Common:attachments:view')
  listSignatures(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentSignaturesService.listForAttachment(companyId, id);
  }

  @Delete(':id')
  @Permissions('Common:attachments:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentsService.remove(companyId, id);
  }
}
