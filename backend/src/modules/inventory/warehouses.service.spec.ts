import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WarehousesService', () => {
  let service: WarehousesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { warehouse: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [WarehousesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(WarehousesService);
  });

  it('scopes findAll to the caller company', async () => {
    prisma.warehouse.findMany.mockResolvedValue([]);
    await service.findAll('company-1');
    expect(prisma.warehouse.findMany.mock.calls[0][0].where.companyId).toBe('company-1');
  });

  it('404s when the warehouse does not exist in this company', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);
    await expect(service.findOne('company-1', 'wh-1')).rejects.toThrow(NotFoundException);
  });

  it('update() 404s before attempting to update a warehouse from another company', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);
    await expect(service.update('company-1', 'wh-1', { name: 'New Name' })).rejects.toThrow(NotFoundException);
    expect(prisma.warehouse.update).not.toHaveBeenCalled();
  });
});
