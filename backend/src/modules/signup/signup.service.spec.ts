import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SignupService } from './signup.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

describe('SignupService', () => {
  let service: SignupService;
  let prisma: any;

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      company: { create: jest.fn() },
      account: { create: jest.fn() },
      financeSettings: { create: jest.fn() },
      role: { create: jest.fn() },
      permission: { findMany: jest.fn() },
      rolePermission: { createMany: jest.fn() },
      userRole: { create: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    const moduleRef = await Test.createTestingModule({
      providers: [SignupService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(SignupService);
  });

  const validDto = { companyName: 'New Co', adminName: 'Ahmed', adminEmail: 'ahmed@newco.com', adminPassword: 'SuperSecret1' };

  it('rejects signup when the admin email is already in use — globally, not per-company', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(service.signup(validDto)).rejects.toThrow(ConflictException);
    expect(prisma.company.create).not.toHaveBeenCalled();
  });

  it('hashes the admin password before ever creating the user record', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.company.create.mockResolvedValue({ id: 'company-1', name: 'New Co' });
    prisma.account.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `acc-${data.code}`, code: data.code }));
    prisma.role.create.mockResolvedValue({ id: 'role-1' });
    prisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }, { id: 'perm-2' }]);
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: validDto.adminEmail });

    await service.signup(validDto);

    expect(bcrypt.hash).toHaveBeenCalledWith(validDto.adminPassword, 12);
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toBe('hashed-password');
  });

  it('creates a starter chart of accounts covering every account Finance Settings needs', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.company.create.mockResolvedValue({ id: 'company-1', name: 'New Co' });
    prisma.account.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `acc-${data.code}`, code: data.code }));
    prisma.role.create.mockResolvedValue({ id: 'role-1' });
    prisma.permission.findMany.mockResolvedValue([]);
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: validDto.adminEmail });

    await service.signup(validDto);

    expect(prisma.account.create).toHaveBeenCalledTimes(9);

    const settingsCall = prisma.financeSettings.create.mock.calls[0][0].data;
    expect(settingsCall.defaultCashAccountId).toBe('acc-1000');
    expect(settingsCall.defaultReceivableAccountId).toBe('acc-1100');
    expect(settingsCall.defaultPayableAccountId).toBe('acc-2000');
    expect(settingsCall.defaultTaxPayableAccountId).toBe('acc-2100');
    expect(settingsCall.defaultRevenueAccountId).toBe('acc-4000');
    expect(settingsCall.defaultExpenseAccountId).toBe('acc-5100');
  });

  it('assigns EVERY current permission to the new Administrator role — never a partial set', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.company.create.mockResolvedValue({ id: 'company-1', name: 'New Co' });
    prisma.account.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `acc-${data.code}`, code: data.code }));
    prisma.role.create.mockResolvedValue({ id: 'role-1' });
    const allPermissions = [{ id: 'perm-1' }, { id: 'perm-2' }, { id: 'perm-3' }];
    prisma.permission.findMany.mockResolvedValue(allPermissions);
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: validDto.adminEmail });

    await service.signup(validDto);

    const createManyCall = prisma.rolePermission.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(3);
    expect(createManyCall.data.every((rp: any) => rp.roleId === 'role-1')).toBe(true);
  });

  it('links the new user to the new Administrator role via UserRole', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.company.create.mockResolvedValue({ id: 'company-1', name: 'New Co' });
    prisma.account.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `acc-${data.code}`, code: data.code }));
    prisma.role.create.mockResolvedValue({ id: 'role-1' });
    prisma.permission.findMany.mockResolvedValue([]);
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: validDto.adminEmail });

    await service.signup(validDto);

    expect(prisma.userRole.create).toHaveBeenCalledWith({ data: { userId: 'user-1', roleId: 'role-1' } });
  });

  it('never returns the password hash in its result', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.company.create.mockResolvedValue({ id: 'company-1', name: 'New Co' });
    prisma.account.create.mockImplementation(({ data }: any) => Promise.resolve({ id: `acc-${data.code}`, code: data.code }));
    prisma.role.create.mockResolvedValue({ id: 'role-1' });
    prisma.permission.findMany.mockResolvedValue([]);
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: validDto.adminEmail });

    const result = await service.signup(validDto);

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toEqual({ companyId: 'company-1', companyName: 'New Co', userId: 'user-1', email: validDto.adminEmail });
  });
});
