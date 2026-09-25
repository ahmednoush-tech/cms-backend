import { Module } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { AttachmentSignaturesService } from './attachment-signatures.service';
import { AttachmentsController } from './attachments.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentSignaturesService],
  exports: [AttachmentsService, AttachmentSignaturesService],
})
export class AttachmentsModule {}
