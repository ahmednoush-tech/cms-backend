import { IsIn, IsUUID } from 'class-validator';
import { ATTACHABLE_ENTITY_TYPES, AttachableEntityType } from '../attachable-entity-types';

export class UploadAttachmentDto {
  @IsIn(ATTACHABLE_ENTITY_TYPES)
  entityType: AttachableEntityType;

  @IsUUID()
  entityId: string;
}
