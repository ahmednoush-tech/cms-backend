/**
 * Transcribed directly from backend/src/common/interceptors/response.interceptor.ts
 * and backend/src/common/filters/http-exception.filter.ts (verified this session,
 * Phase 3A). Do not add fields that don't exist on the actual backend shapes.
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Success envelope: { data, meta, errors: null } */
export interface ApiSuccessEnvelope<T> {
  data: T;
  meta: PaginationMeta | Record<string, unknown> | null;
  errors: null;
}

/** Error envelope: { data: null, meta: null, errors: [{ code, message }] } */
export interface ApiErrorEnvelope {
  data: null;
  meta: null;
  errors: Array<{ code: string; message: string | string[] }>;
}

/**
 * Backend error codes, transcribed from HttpExceptionFilter.codeForStatus().
 * Kept as a union now so the centralized error handler (api/client.ts) can
 * switch on it — and so a future move to per-business-rule error codes
 * (Phase 3A design doc, decision 7) has a natural place to extend this
 * without restructuring anything else.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 400
  | 'AUTHENTICATION_ERROR' // 401
  | 'AUTHORIZATION_ERROR' // 403
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409
  | 'BUSINESS_RULE_VIOLATION' // 422
  | 'INTERNAL_ERROR'; // 500

export interface PaginatedFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
}
