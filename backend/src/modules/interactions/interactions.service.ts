import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';

@Injectable()
export class InteractionsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, actorUserId: string, dto: CreateInteractionDto) {
    if (!dto.customerId && !dto.leadId && !dto.opportunityId) {
      throw new UnprocessableEntityException('An interaction must be linked to at least one of: a customer, a lead, or an opportunity.');
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, companyId, deletedAt: null } });
      if (!customer) throw new NotFoundException('Customer not found.');
    }
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { id: dto.leadId, companyId, deletedAt: null } });
      if (!lead) throw new NotFoundException('Lead not found.');
    }
    if (dto.opportunityId) {
      const opportunity = await this.prisma.opportunity.findFirst({ where: { id: dto.opportunityId, companyId, deletedAt: null } });
      if (!opportunity) throw new NotFoundException('Opportunity not found.');
    }

    return this.prisma.interaction.create({
      data: {
        companyId,
        customerId: dto.customerId,
        leadId: dto.leadId,
        opportunityId: dto.opportunityId,
        type: dto.type,
        subject: dto.subject,
        notes: dto.notes,
        interactionDate: new Date(dto.interactionDate),
        outcome: dto.outcome,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
        createdBy: actorUserId,
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const interaction = await this.prisma.interaction.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { createdByUser: { select: { id: true, email: true } } },
    });
    if (!interaction) throw new NotFoundException('Interaction not found.');
    return interaction;
  }

  async findAllForCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, companyId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Customer not found.');
    return this.prisma.interaction.findMany({
      where: { companyId, customerId, deletedAt: null },
      include: { createdByUser: { select: { id: true, email: true } } },
      orderBy: { interactionDate: 'desc' },
    });
  }

  async findAllForLead(companyId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, companyId, deletedAt: null } });
    if (!lead) throw new NotFoundException('Lead not found.');
    return this.prisma.interaction.findMany({
      where: { companyId, leadId, deletedAt: null },
      include: { createdByUser: { select: { id: true, email: true } } },
      orderBy: { interactionDate: 'desc' },
    });
  }

  async findAllForOpportunity(companyId: string, opportunityId: string) {
    const opportunity = await this.prisma.opportunity.findFirst({ where: { id: opportunityId, companyId, deletedAt: null } });
    if (!opportunity) throw new NotFoundException('Opportunity not found.');
    return this.prisma.interaction.findMany({
      where: { companyId, opportunityId, deletedAt: null },
      include: { createdByUser: { select: { id: true, email: true } } },
      orderBy: { interactionDate: 'desc' },
    });
  }

  async update(companyId: string, id: string, dto: UpdateInteractionDto) {
    await this.findOne(companyId, id);
    return this.prisma.interaction.update({
      where: { id },
      data: {
        type: dto.type,
        subject: dto.subject,
        notes: dto.notes,
        interactionDate: dto.interactionDate ? new Date(dto.interactionDate) : undefined,
        outcome: dto.outcome,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
      },
    });
  }

  async softDelete(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.interaction.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
