import { Test } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { CustomFieldValidationService } from '../custom-fields/custom-field-validation.service';

/**
 * SCOPE: CustomersService had NO existing test file at all before
 * this — these tests cover ONLY the customFields wiring just added
 * (create/update), mirroring the same tests already written for
 * LeadsService and OpportunitiesService. Comprehensive coverage of
 * CustomersService's other behavior (uniqueness checks, ownership
 * validation, status transitions, etc.) remains a separate,
 * pre-existing gap this session did not close.
 */
describe('CustomersService — customFields wiring', () => {
  let service: CustomersService;
  let prisma: any;
  let customFieldValidation: CustomFieldValidationService;

  beforeEach(async () => {
    prisma = {
      customer: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      user: { findFirst: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: CustomFieldValidationService, useValue: { validateAndNormalize: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = moduleRef.get(CustomersService);
    customFieldValidation = moduleRef.get(CustomFieldValidationService);
  });

  describe('create', () => {
    it("validates customFields against entityType 'customer', not 'lead' or 'opportunity'", async () => {
      prisma.customer.create.mockResolvedValue({ id: 'cust-1', customFields: {} });
      const validateSpy = jest.spyOn(customFieldValidation, 'validateAndNormalize');

      await service.create('company-1', 'user-1', { customerType: 'company', companyName: 'Acme', customFields: { industry: 'retail' } } as any);

      expect(validateSpy).toHaveBeenCalledWith('company-1', 'customer', { industry: 'retail' });
    });

    it('saves the VALIDATED (not raw) customFields onto the created row', async () => {
      jest.spyOn(customFieldValidation, 'validateAndNormalize').mockResolvedValue({ industry: 'retail' });
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      await service.create('company-1', 'user-1', { customerType: 'company', companyName: 'Acme', customFields: { industry: 'RETAIL_RAW' } } as any);

      const createCall = prisma.customer.create.mock.calls[0][0];
      expect(createCall.data.customFields).toEqual({ industry: 'retail' });
    });

    it('lets a validation rejection propagate and block the create entirely', async () => {
      jest.spyOn(customFieldValidation, 'validateAndNormalize').mockRejectedValue(new Error('invalid custom field'));

      await expect(
        service.create('company-1', 'user-1', { customerType: 'company', companyName: 'Acme', customFields: { budget: 'not-a-number' } } as any),
      ).rejects.toThrow('invalid custom field');
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("passes the request's raw customFields AND the existing stored values as SEPARATE arguments", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', status: 'active', customFields: { industry: 'retail', size: 'large' } });
      prisma.customer.update.mockResolvedValue({ id: 'cust-1' });
      const validateSpy = jest.spyOn(customFieldValidation, 'validateAndNormalize').mockResolvedValue({ industry: 'wholesale', size: 'large' });

      await service.update('company-1', 'user-1', 'cust-1', { customFields: { industry: 'wholesale' } } as any);

      expect(validateSpy).toHaveBeenCalledWith('company-1', 'customer', { industry: 'wholesale' }, { industry: 'retail', size: 'large' });
    });

    it('does not touch customFields at all when the request omits it entirely', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', status: 'active', customFields: { industry: 'retail' } });
      prisma.customer.update.mockResolvedValue({ id: 'cust-1' });
      const validateSpy = jest.spyOn(customFieldValidation, 'validateAndNormalize');

      await service.update('company-1', 'user-1', 'cust-1', { companyName: 'New Name' } as any);

      expect(validateSpy).not.toHaveBeenCalled();
      const updateCall = prisma.customer.update.mock.calls[0][0];
      expect('customFields' in updateCall.data).toBe(false);
    });
  });
});
