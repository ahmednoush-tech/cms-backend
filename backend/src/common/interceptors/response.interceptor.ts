import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta: Record<string, unknown> | null;
  errors: null;
}

/**
 * Wraps every successful controller return value in the
 * standard { data, meta, errors } envelope. If a service
 * already returns { items, meta } (paginated list), meta is
 * lifted to the top level and items becomes data.
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        if (
          result &&
          typeof result === 'object' &&
          'items' in result &&
          'meta' in result
        ) {
          const { items, meta } = result as any;
          return { data: items, meta, errors: null };
        }
        return { data: result, meta: null, errors: null };
      }),
    );
  }
}
