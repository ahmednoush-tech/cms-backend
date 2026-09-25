import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const DEDUP_WINDOW_HOURS = 24;

export interface ExpiringEmployeeResult {
  id: string;
  name: string;
  iqamaNumber: string | null;
  iqamaExpiryDate: Date;
  daysRemaining: number;
}

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * On-demand check — this system has no background cron
   * scheduler (see migration 075's comment), so this runs only
   * when triggered: a person clicking "Check Now" in the UI, or an
   * external scheduler hitting this same endpoint periodically.
   *
   * Notifies every user who holds Administration:employees:edit —
   * found via the SAME include shape already used and proven in
   * auth.service.ts (userRoles → role → rolePermissions →
   * permission), filtered in JavaScript rather than a Prisma
   * relation `some` filter, since that filter shape has no
   * precedent anywhere else in this codebase and this feature
   * writes real notifications — not a place to risk unverified
   * query syntax.
   *
   * Deduplicated per (user, employee) within a 24-hour window, so
   * clicking "Check Now" repeatedly in the same day never spams
   * the same person with duplicate notifications about the same
   * employee's Iqama.
   */
  async checkExpiringIqamas(companyId: string, daysThreshold: number = 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const expiringEmployees = await this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: 'active',
        iqamaExpiryDate: { not: null, lte: thresholdDate },
      },
      select: { id: true, firstName: true, lastName: true, iqamaNumber: true, iqamaExpiryDate: true },
      orderBy: { iqamaExpiryDate: 'asc' },
    });

    const msPerDay = 1000 * 60 * 60 * 24;
    const employeeResults: ExpiringEmployeeResult[] = expiringEmployees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      iqamaNumber: e.iqamaNumber,
      iqamaExpiryDate: e.iqamaExpiryDate!,
      daysRemaining: Math.round((e.iqamaExpiryDate!.getTime() - today.getTime()) / msPerDay),
    }));

    if (employeeResults.length === 0) {
      return { expiringCount: 0, notificationsSent: 0, employees: [] };
    }

    const usersToNotify = await this.getUsersWithEmployeeEditPermission(companyId);
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

    let notificationsSent = 0;
    for (const employee of employeeResults) {
      for (const user of usersToNotify) {
        const alreadyNotified = await this.prisma.notification.findFirst({
          where: { userId: user.id, entityType: 'employee_iqama', entityId: employee.id, createdAt: { gte: dedupCutoff } },
        });
        if (alreadyNotified) continue;

        await this.notifications.create({
          companyId,
          userId: user.id,
          type: 'iqama_expiring',
          title: `Iqama expiring soon: ${employee.name}`,
          message: `Iqama ${employee.iqamaNumber ? `#${employee.iqamaNumber} ` : ''}expires on ${employee.iqamaExpiryDate.toISOString().slice(0, 10)} (${employee.daysRemaining} day(s) remaining).`,
          entityType: 'employee_iqama',
          entityId: employee.id,
        });
        notificationsSent++;
      }
    }

    return { expiringCount: employeeResults.length, notificationsSent, employees: employeeResults };
  }

  private async getUsersWithEmployeeEditPermission(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: { companyId },
      include: {
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      },
    });

    return users.filter((u) =>
      u.userRoles.some((ur) =>
        ur.role.rolePermissions.some(
          (rp) => rp.permission.module === 'Administration' && rp.permission.resource === 'employees' && rp.permission.action === 'edit',
        ),
      ),
    );
  }
}
