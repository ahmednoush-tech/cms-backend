import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomFieldDefinitionsService } from './custom-field-definitions.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CustomFieldDefinitionsService', () => {
  let service: CustomFieldDefinitionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      customFieldDefinition: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CustomFieldDefinitionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CustomFieldDefinitionsService);
  });

  describe('create', () => {
    it('rejects a duplicate fieldKey for the same company and entity type', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create('company-1', 'user-1', { entityType: 'lead', fieldKey: 'budget', label: 'Budget', fieldType: 'number' }),
      ).rejects.toThrow(ConflictException);
    });

    it('stores selectOptions only when fieldType is select', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue(null);
      prisma.customFieldDefinition.create.mockResolvedValue({ id: 'def-1' });

      await service.create('company-1', 'user-1', { entityType: 'lead', fieldKey: 'network', label: 'Network', fieldType: 'text' });

      const call = prisma.customFieldDefinition.create.mock.calls[0][0];
      expect(call.data.selectOptions).toBeUndefined();
    });

    it('stores selectOptions when fieldType is select', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue(null);
      prisma.customFieldDefinition.create.mockResolvedValue({ id: 'def-1' });

      await service.create('company-1', 'user-1', {
        entityType: 'lead',
        fieldKey: 'network',
        label: 'Network',
        fieldType: 'select',
        selectOptions: ['residential', 'commercial'],
      });

      const call = prisma.customFieldDefinition.create.mock.calls[0][0];
      expect(call.data.selectOptions).toEqual(['residential', 'commercial']);
    });

    it('defaults isRequired to false and displayOrder to 0', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue(null);
      prisma.customFieldDefinition.create.mockResolvedValue({ id: 'def-1' });

      await service.create('company-1', 'user-1', { entityType: 'lead', fieldKey: 'notes', label: 'Notes', fieldType: 'text' });

      const call = prisma.customFieldDefinition.create.mock.calls[0][0];
      expect(call.data.isRequired).toBe(false);
      expect(call.data.displayOrder).toBe(0);
    });
  });

  describe('findAll', () => {
    it('returns both active and inactive definitions, not just active ones', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([]);
      await service.findAll('company-1', 'lead');
      const call = prisma.customFieldDefinition.findMany.mock.calls[0][0];
      expect('isActive' in call.where).toBe(false);
    });
  });

  describe('findOne', () => {
    it('404s when the definition does not belong to the caller company', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'def-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('404s when updating a definition that does not exist', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue(null);
      await expect(service.update('company-1', 'def-1', { label: 'New Label' })).rejects.toThrow(NotFoundException);
    });

    it('passes through only the allowed fields (label, selectOptions, isRequired, isActive, displayOrder)', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'def-1' });
      prisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1', label: 'New Label' });

      await service.update('company-1', 'def-1', { label: 'New Label', isRequired: true });

      const call = prisma.customFieldDefinition.update.mock.calls[0][0];
      expect(call.data).toEqual({ label: 'New Label', isRequired: true });
    });
  });

  describe('deactivate', () => {
    it('404s when deactivating a definition that does not exist', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue(null);
      await expect(service.deactivate('company-1', 'def-1')).rejects.toThrow(NotFoundException);
    });

    it('sets isActive to false rather than deleting the row', async () => {
      prisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'def-1' });
      prisma.customFieldDefinition.update.mockResolvedValue({ id: 'def-1', isActive: false });

      await service.deactivate('company-1', 'def-1');

      expect(prisma.customFieldDefinition.update).toHaveBeenCalledWith({ where: { id: 'def-1' }, data: { isActive: false } });
    });
  });
});
