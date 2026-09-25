import { IsIn, IsString, MinLength } from 'class-validator';

export class SignAttachmentDto {
  @IsIn(['typed', 'drawn'])
  signatureType: 'typed' | 'drawn';

  /** A typed full name, or a base64-encoded PNG of a drawn signature — either is just an audit record, not something this system verifies cryptographically (see AttachmentSignaturesService's file comment). */
  @IsString()
  @MinLength(1)
  signatureData: string;
}
