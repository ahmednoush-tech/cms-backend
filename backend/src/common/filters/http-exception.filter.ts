import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Normalizes every thrown error into:
 *   { data: null, meta: null, errors: [{ code, message, details? }] }
 *
 * Status code mapping follows the approved spec:
 *   400 validation, 401 auth, 403 authorization, 404 not found,
 *   409 conflict, 422 business rule violation, 500 unexpected.
 *
 * Business-rule violations should be thrown as
 * UnprocessableEntityException (422) from the service layer,
 * e.g. an invalid workflow status transition.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Unexpected server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : (body as any).message ?? exception.message;
      code = HttpExceptionFilter.codeForStatus(status);
    } else {
      // Previously `this.logger.error(exception)` — passing a raw
      // Error object to NestJS's Logger.error() does not reliably
      // print a stack trace (its second parameter expects a
      // string). An unexpected 500 with no usable stack trace in
      // the logs is exactly the failure this whole logging pass
      // exists to prevent, so this is now explicit: the message on
      // one line, the full stack trace on the next.
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(err.message, err.stack);
    }

    response.status(status).json({
      data: null,
      meta: null,
      errors: [
        {
          code,
          message,
        },
      ],
    });
  }

  private static codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'AUTHENTICATION_ERROR';
      case 403:
        return 'AUTHORIZATION_ERROR';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'BUSINESS_RULE_VIOLATION';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
