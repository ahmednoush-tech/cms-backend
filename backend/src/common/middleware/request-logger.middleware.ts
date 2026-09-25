import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Logs every request as it FINISHES (not as it arrives), so the
 * log line always carries the real status code and actual
 * duration — the two things that matter most when reading logs
 * after an incident.
 *
 * A request slower than SLOW_REQUEST_THRESHOLD_MS is logged at
 * WARN instead of the normal LOG level — this system has a few
 * genuine, disclosed performance risks (e.g. bank reconciliation's
 * full-history balance aggregate, the auto-match loop) that were
 * never load-tested; a slow-request warning is the cheapest way to
 * notice if one of them is actually a problem in practice, without
 * having to guess in advance which one.
 */
const SLOW_REQUEST_THRESHOLD_MS = 1000;

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} — ${durationMs}ms`;

      if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
        this.logger.warn(`SLOW: ${line}`);
      } else if (res.statusCode >= 500) {
        this.logger.error(line);
      } else if (res.statusCode >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    });

    next();
  }
}
