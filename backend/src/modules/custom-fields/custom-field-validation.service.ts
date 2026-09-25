import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Validates and normalizes customFields against this company's
 * ACTIVE field definitions for the given entity type. Called from
 * LeadsService, OpportunitiesService, and CustomersService before
 * every create/update.
 *
 * Unknown keys are REJECTED, not silently dropped — a typo or a
 * stale key from a deactivated field should surface as a clear
 * error, not disappear quietly.
 *
 * A field that is omitted (or sent as null/empty string) and is
 * NOT required is simply left out of the normalized result — this
 * system never stores an explicit null for an unanswered optional
 * custom field.
 *
 * REQUIRED-FIELD ENFORCEMENT (the merge now happens INSIDE this
 * service, not by the caller, specifically so this distinction is
 * possible):
 *   - On CREATE (existingCustomFields is undefined): every
 *     required field must be present. No exceptions — there is no
 *     "existing" data to grandfather in.
 *   - On UPDATE (existingCustomFields is the record's current
 *     value): a required field already missing on the existing
 *     record, and NOT part of THIS request's incomingCustomFields,
 *     is left alone — updating one custom field must never be
 *     blocked by a DIFFERENT, unrelated field that happened to
 *     become required after the record was created. But a required
 *     field the caller IS explicitly touching in this request
 *     (including explicitly clearing it) is still fully enforced —
 *     you cannot blank out a required field.
 */
@Injectable()
export class CustomFieldValidationService {
  constructor(private prisma: PrismaService) {}

  async validateAndNormalize(
    companyId: string,
    entityType: 'lead' | 'opportunity' | 'customer',
    incomingCustomFields: Record<string, unknown> | undefined,
    existingCustomFields?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: { companyId, entityType, isActive: true },
    });

    const incoming = incomingCustomFields ?? {};
    const definedKeys = new Set(definitions.map((d) => d.fieldKey));
    for (const key of Object.keys(incoming)) {
      if (!definedKeys.has(key)) {
        throw new UnprocessableEntityException(`Unknown custom field "${key}" — it may have been removed or never existed.`);
      }
    }

    const isCreate = existingCustomFields === undefined;
    const merged = { ...(existingCustomFields ?? {}), ...incoming };
    const result: Record<string, unknown> = {};

    for (const def of definitions) {
      const value = merged[def.fieldKey];
      const isEmpty = value === undefined || value === null || value === '';
      const isTouchedNow = Object.prototype.hasOwnProperty.call(incoming, def.fieldKey);

      if (isEmpty) {
        if (def.isRequired && (isCreate || isTouchedNow)) {
          throw new UnprocessableEntityException(`Custom field "${def.label}" is required.`);
        }
        continue;
      }

      result[def.fieldKey] = this.validateOneValue(def.label, def.fieldType, def.selectOptions, value);
    }

    return result;
  }

  private validateOneValue(label: string, fieldType: string, selectOptions: unknown, value: unknown): string | number {
    switch (fieldType) {
      case 'text': {
        if (typeof value !== 'string') throw new UnprocessableEntityException(`Custom field "${label}" must be text.`);
        return value;
      }
      case 'number': {
        const num = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(num)) throw new UnprocessableEntityException(`Custom field "${label}" must be a number.`);
        return num;
      }
      case 'date': {
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          throw new UnprocessableEntityException(`Custom field "${label}" must be a valid date.`);
        }
        return value;
      }
      case 'select': {
        const options = Array.isArray(selectOptions) ? (selectOptions as string[]) : [];
        if (typeof value !== 'string' || !options.includes(value)) {
          throw new UnprocessableEntityException(`Custom field "${label}" must be one of: ${options.join(', ')}.`);
        }
        return value;
      }
      default:
        throw new UnprocessableEntityException(`Custom field "${label}" has an unrecognized type.`);
    }
  }
}
