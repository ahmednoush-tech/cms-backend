import { Test } from '@nestjs/testing';
import { EmployeeDocumentsService } from './employee-documents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationsServiceBackedBy } from '../notifications/testing/notifications-test-adapter';

describe('EmployeeDocumentsService', () => {
  let service: EmployeeDocumentsService;
  let prisma: any;

  const userWithEditPermission = {
    id: 'user-hr',
    userRoles: [
      {
        role: {
          rolePermissions: [{ permission: { module: 'Administration', resource: 'employees', action: 'edit' } }],
        },
      },
    ],
  };
  const userWithoutEditPermission = {
    id: 'user-sales',
    userRoles: [
      {
        role: {
          rolePermissions: [{ permission: { module: 'CRM', resource: 'leads', action: 'view' } }],
        },
      },
    ],
  };

  function daysFromNow(days: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d;
  }

  beforeEach(async () => {
    prisma = {
      employee: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
      notification: { findFirst: jest.fn(), create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [EmployeeDocumentsService, { provide: PrismaService, useValue: prisma }, { provide: NotificationsService, useValue: notificationsServiceBackedBy(prisma) }],
    }).compile();

    service = moduleRef.get(EmployeeDocumentsService);
  });

  it('returns zero counts and does no user lookup when nothing is expiring', async () => {
    prisma.employee.findMany.mockResolvedValue([]);

    const result = await service.checkExpiringIqamas('company-1');

    expect(result).toEqual({ expiringCount: 0, notificationsSent: 0, employees: [] });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('computes daysRemaining correctly for each expiring employee', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali', iqamaNumber: '1234567890', iqamaExpiryDate: daysFromNow(15) },
    ]);
    prisma.user.findMany.mockResolvedValue([]);

    const result = await service.checkExpiringIqamas('company-1');

    expect(result.expiringCount).toBe(1);
    expect(result.employees[0].daysRemaining).toBe(15);
    expect(result.employees[0].name).toBe('Ahmed Ali');
  });

  it('only queries employees whose iqamaExpiryDate falls within the given threshold', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    await service.checkExpiringIqamas('company-1', 60);

    const call = prisma.employee.findMany.mock.calls[0][0];
    expect(call.where.companyId).toBe('company-1');
    expect(call.where.status).toBe('active');
    expect(call.where.iqamaExpiryDate.not).toBeNull();
  });

  it('notifies only users holding Administration:employees:edit, not every user in the company', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali', iqamaNumber: null, iqamaExpiryDate: daysFromNow(10) },
    ]);
    prisma.user.findMany.mockResolvedValue([userWithEditPermission, userWithoutEditPermission]);
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({});

    const result = await service.checkExpiringIqamas('company-1');

    expect(result.notificationsSent).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const createCall = prisma.notification.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe('user-hr');
  });

  it('skips creating a duplicate notification for the same user+employee within the 24-hour dedup window', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali', iqamaNumber: null, iqamaExpiryDate: daysFromNow(10) },
    ]);
    prisma.user.findMany.mockResolvedValue([userWithEditPermission]);
    prisma.notification.findFirst.mockResolvedValue({ id: 'existing-notification' });

    const result = await service.checkExpiringIqamas('company-1');

    expect(result.notificationsSent).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('creates one notification per (employee, user) pair when multiple employees and multiple HR users exist', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali', iqamaNumber: null, iqamaExpiryDate: daysFromNow(5) },
      { id: 'emp-2', firstName: 'Sara', lastName: 'Omar', iqamaNumber: null, iqamaExpiryDate: daysFromNow(20) },
    ]);
    const secondHrUser = { id: 'user-hr-2', userRoles: userWithEditPermission.userRoles };
    prisma.user.findMany.mockResolvedValue([userWithEditPermission, secondHrUser]);
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({});

    const result = await service.checkExpiringIqamas('company-1');

    expect(result.expiringCount).toBe(2);
    expect(result.notificationsSent).toBe(4);
  });

  it('includes the Iqama number in the notification message when present', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', firstName: 'Ahmed', lastName: 'Ali', iqamaNumber: '2345678901', iqamaExpiryDate: daysFromNow(5) },
    ]);
    prisma.user.findMany.mockResolvedValue([userWithEditPermission]);
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({});

    await service.checkExpiringIqamas('company-1');

    const createCall = prisma.notification.create.mock.calls[0][0];
    expect(createCall.data.message).toContain('2345678901');
  });
});
