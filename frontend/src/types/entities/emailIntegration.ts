export interface EmailIntegrationStatus {
  connected: boolean;
  connectedEmail?: string;
  lastSyncedAt?: string | null;
}

export interface EmailSyncResult {
  matchedCount: number;
  skippedAlreadySynced: number;
  skippedNoMatch: number;
  totalFetched: number;
}
