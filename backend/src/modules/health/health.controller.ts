import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * A process that started successfully is not the same thing as a
 * process that can actually serve requests — the most common real
 * failure mode after deployment is the app booting fine while its
 * database connection is misconfigured or the DB itself is
 * unreachable. This endpoint runs one cheap, real query
 * (`SELECT 1`) rather than only reporting "the server is up",
 * which every PaaS's own process-liveness check already covers on
 * its own and would give a false sense of health here.
 *
 * @Public() — a load balancer or platform health check has no
 * user session and must never be asked to authenticate.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(HttpStatus.OK).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        database: 'unreachable',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
