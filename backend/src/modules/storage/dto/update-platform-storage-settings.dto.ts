import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePlatformStorageSettingsDto {
  @IsIn(['local', 's3'])
  storageDriver: 'local' | 's3';

  @IsOptional()
  @IsString()
  s3Region?: string;

  @IsOptional()
  @IsString()
  s3Bucket?: string;

  @IsOptional()
  @IsString()
  s3AccessKeyId?: string;

  /**
   * Optional on purpose — omitting this field means "keep the
   * currently-stored secret unchanged" (see the service's
   * comment). There is no way to submit an update that BLANKS the
   * secret without also changing storageDriver away from 's3'
   * entirely; a field this sensitive is never cleared by accident
   * via an empty string slipping through.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  s3SecretAccessKey?: string;

  @IsOptional()
  @IsString()
  s3Endpoint?: string;

  @IsOptional()
  @IsBoolean()
  s3ForcePathStyle?: boolean;
}
