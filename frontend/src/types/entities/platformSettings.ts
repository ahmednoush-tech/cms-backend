export interface PlatformSettings {
  id: string;
  productName: string;
  productTagline: string | null;
  logoUrl: string | null;
  updatedAt: string;
}

export interface UpdatePlatformSettingsInput {
  productName?: string;
  productTagline?: string;
}

export type StorageDriver = 'local' | 's3';

export interface PlatformStorageSettings {
  storageDriver: StorageDriver;
  s3Region: string | null;
  s3Bucket: string | null;
  s3AccessKeyId: string | null;
  /** Whether a secret is currently saved — the actual value is never returned by the API. */
  s3SecretAccessKeySet: boolean;
  s3Endpoint: string | null;
  s3ForcePathStyle: boolean;
}

export interface UpdatePlatformStorageSettingsInput {
  storageDriver: StorageDriver;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  /** Omit to keep the currently-saved secret unchanged. */
  s3SecretAccessKey?: string;
  s3Endpoint?: string;
  s3ForcePathStyle?: boolean;
}
