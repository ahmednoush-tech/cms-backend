import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { CustomFieldValidationService } from './custom-field-validation.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CustomFieldValidationService', () => {
  let service: CustomFieldValidationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { customFieldDefinition: { findMany: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [CustomFieldValidationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CustomFieldValidationService);
  });

  it('returns an empty object when there are no active definitions and no input', async () => {
    prisma.customFieldDefinition.findMany.mockResolvedValue([]);
    const result = await service.validateAndNormalize('company-1', 'lead', undefined);
    expect(result).toEqual({});
  });

  it('only queries ACTIVE definitions for the given company and entity type', async () => {
    prisma.customFieldDefinition.findMany.mockResolvedValue([]);
    await service.validateAndNormalize('company-1', 'lead', {});
    const call = prisma.customFieldDefinition.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ companyId: 'company-1', entityType: 'lead', isActive: true });
  });

  it('rejects a key that does not match any active definition', async () => {
    prisma.customFieldDefinition.findMany.mockResolvedValue([]);
    await expect(service.validateAndNormalize('company-1', 'lead', { madeUpField: 'x' })).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects a missing value for a required field', async () => {
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      { fieldKey: 'budget', label: 'Budget', fieldType: 'number', isRequired: true, selectOptions: null },
    ]);
    await expect(service.validateAndNormalize('company-1', 'lead', {})).rejects.toThrow(/is required/);
  });

  it('silently omits an optional field that was not provided', async () => {
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      { fieldKey: 'notes', label: 'Notes', fieldType: 'text', isRequired: false, selectOptions: null },
    ]);
    const result = await service.validateAndNormalize('company-1', 'lead', {});
    expect(result).toEqual({});
  });

  it('treats an empty string the same as "not provided" for an optional field', async () => {
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      { fieldKey: 'notes', label: 'Notes', fieldType: 'text', isRequired: false, selectOptions: null },
    ]);
    const result = await service.validateAndNormalize('company-1', 'lead', { notes: '' });
    expect(result).toEqual({});
  });

  describe('text fields', () => {
    it('accepts a string value', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'referral', label: 'Referral', fieldType: 'text', isRequired: false, selectOptions: null },
      ]);
      const result = await service.validateAndNormalize('company-1', 'lead', { referral: 'Friend' });
      expect(result).toEqual({ referral: 'Friend' });
    });

    it('rejects a non-string value', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'referral', label: 'Referral', fieldType: 'text', isRequired: false, selectOptions: null },
      ]);
      await expect(service.validateAndNormalize('company-1', 'lead', { referral: 12345 })).rejects.toThrow(/must be text/);
    });
  });

  describe('number fields', () => {
    it('accepts a numeric string and converts it to a real number', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'budget', label: 'Budget', fieldType: 'number', isRequired: false, selectOptions: null },
      ]);
      const result = await service.validateAndNormalize('company-1', 'lead', { budget: '5000' });
      expect(result).toEqual({ budget: 5000 });
      expect(typeof result.budget).toBe('number');
    });

    it('rejects a non-numeric string', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'budget', label: 'Budget', fieldType: 'number', isRequired: false, selectOptions: null },
      ]);
      await expect(service.validateAndNormalize('company-1', 'lead', { budget: 'not-a-number' })).rejects.toThrow(/must be a number/);
    });
  });

  describe('date fields', () => {
    it('accepts a valid ISO date string', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'renewalDate', label: 'Renewal Date', fieldType: 'date', isRequired: false, selectOptions: null },
      ]);
      const result = await service.validateAndNormalize('company-1', 'lead', { renewalDate: '2026-12-01' });
      expect(result).toEqual({ renewalDate: '2026-12-01' });
    });

    it('rejects an unparseable date string', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'renewalDate', label: 'Renewal Date', fieldType: 'date', isRequired: false, selectOptions: null },
      ]);
      await expect(service.validateAndNormalize('company-1', 'lead', { renewalDate: 'not-a-date' })).rejects.toThrow(/valid date/);
    });
  });

  describe('select fields', () => {
    it('accepts a value that matches one of the defined options', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'networkType', label: 'Network Type', fieldType: 'select', isRequired: false, selectOptions: ['residential', 'commercial'] },
      ]);
      const result = await service.validateAndNormalize('company-1', 'lead', { networkType: 'commercial' });
      expect(result).toEqual({ networkType: 'commercial' });
    });

    it('rejects a value that is not one of the defined options', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'networkType', label: 'Network Type', fieldType: 'select', isRequired: false, selectOptions: ['residential', 'commercial'] },
      ]);
      await expect(service.validateAndNormalize('company-1', 'lead', { networkType: 'industrial' })).rejects.toThrow(/must be one of/);
    });
  });

  it('validates multiple fields together, returning only the ones actually provided', async () => {
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      { fieldKey: 'budget', label: 'Budget', fieldType: 'number', isRequired: false, selectOptions: null },
      { fieldKey: 'referral', label: 'Referral', fieldType: 'text', isRequired: false, selectOptions: null },
      { fieldKey: 'renewalDate', label: 'Renewal Date', fieldType: 'date', isRequired: false, selectOptions: null },
    ]);
    const result = await service.validateAndNormalize('company-1', 'lead', { budget: 5000 });
    expect(result).toEqual({ budget: 5000 });
  });

  describe('the update-time "legacy required field" fix — existingCustomFields is provided', () => {
    it('CREATE (existingCustomFields undefined): still strictly requires every required field, exactly as before', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'source', label: 'Source', fieldType: 'text', isRequired: true, selectOptions: null },
      ]);
      await expect(service.validateAndNormalize('company-1', 'lead', { other: 'x' } as any)).rejects.toThrow(/is required/);
    });

    it('UPDATE: a required field already missing on the record, and NOT part of this request, no longer blocks an unrelated field update', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'source', label: 'Source', fieldType: 'text', isRequired: true, selectOptions: null },
        { fieldKey: 'budget', label: 'Budget', fieldType: 'number', isRequired: false, selectOptions: null },
      ]);

      // existing record has no 'source' value at all (a legacy record from before this field became required);
      // this request only touches 'budget'.
      const result = await service.validateAndNormalize('company-1', 'lead', { budget: 9000 }, {});

      expect(result).toEqual({ budget: 9000 });
    });

    it('UPDATE: explicitly clearing a required field is still rejected, even though it is "just an update"', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'source', label: 'Source', fieldType: 'text', isRequired: true, selectOptions: null },
      ]);

      await expect(
        service.validateAndNormalize('company-1', 'lead', { source: '' }, { source: 'referral' }),
      ).rejects.toThrow(/is required/);
    });

    it('UPDATE: a required field that already has a valid value, and is left untouched, passes through unchanged', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'source', label: 'Source', fieldType: 'text', isRequired: true, selectOptions: null },
      ]);

      const result = await service.validateAndNormalize('company-1', 'lead', {}, { source: 'referral' });

      expect(result).toEqual({ source: 'referral' });
    });

    it('UPDATE: setting a required field for the FIRST time (filling in the legacy gap) is validated normally', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'source', label: 'Source', fieldType: 'text', isRequired: true, selectOptions: null },
      ]);

      const result = await service.validateAndNormalize('company-1', 'lead', { source: 'referral' }, {});

      expect(result).toEqual({ source: 'referral' });
    });

    it('UPDATE: an optional field already missing, and untouched, still correctly stays absent from the result', async () => {
      prisma.customFieldDefinition.findMany.mockResolvedValue([
        { fieldKey: 'notes', label: 'Notes', fieldType: 'text', isRequired: false, selectOptions: null },
        { fieldKey: 'budget', label: 'Budget', fieldType: 'number', isRequired: false, selectOptions: null },
      ]);

      const result = await service.validateAndNormalize('company-1', 'lead', { budget: 100 }, {});

      expect(result).toEqual({ budget: 100 });
      expect('notes' in result).toBe(false);
    });
  });
});
