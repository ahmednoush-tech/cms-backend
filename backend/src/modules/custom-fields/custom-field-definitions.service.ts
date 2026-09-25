import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomFieldDefinitionDto } from './dto/create-custom-field-definition.dto';
import { UpdateCustomFieldDefinitionDto } from './dto/update-custom-field-definition.dto';

@Injectable()
export class CustomFieldDefinitionsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, actorUserId: string, dto: CreateCustomFieldDefinitionDto) {
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { companyId, entityType: dto.entityType, fieldKey: dto.fieldKey },
    });
    if (existing) {
      throw new ConflictException(`A custom field with key "${dto.fieldKey}" already exists for ${dto.entityType}s.`);
    }

    return this.prisma.customFieldDefinition.create({
      data: {
        companyId,
        entityType: dto.entityType,
        fieldKey: dto.fieldKey,
        label: dto.label,
        fieldType: dto.fieldType,
        selectOptions: dto.fieldType === 'select' ? dto.selectOptions : undefined,
        isRequired: dto.isRequired ?? false,
        displayOrder: dto.displayOrder ?? 0,
        createdBy: actorUserId,
      },
    });
  }

  /** Returns ALL definitions (active and inactive) — the admin UI needs to see and potentially reactivate an inactive one. */
  async findAll(companyId: string, entityType: 'lead' | 'opportunity' | 'customer') {
    return this.prisma.customFieldDefinition.findMany({
      where: { companyId, entityType },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const definition = await this.prisma.customFieldDefinition.findFirst({ where: { id, companyId } });
    if (!definition) throw new NotFoundException('Custom field definition not found.');
    return definition;
  }

  async update(companyId: string, id: string, dto: UpdateCustomFieldDefinitionDto) {
    await this.findOne(companyId, id);
    return this.prisma.customFieldDefinition.update({ where: { id }, data: dto });
  }

  /**
   * Deactivates rather than deletes — existing Leads may already
   * have a value stored under this field's key. Hard-deleting the
   * definition would orphan that data, so this only flips
   * isActive to false. CustomFieldValidationService then stops
   * accepting new values for it, but old stored values are left
   * exactly as they were.
   */
  async deactivate(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.customFieldDefinition.update({ where: { id }, data: { isActive: false } });
  }
}
