import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { COMPANY_WIDE_SCOPE_ID, COMPANY_WIDE_SCOPE_TYPE } from '../constants/scope.constants';

// V1 deliberately supports exactly one concrete scope type. The
// scope_type/scope_id columns are generic (any string + UUID), but
// actually ENFORCING a scope means some service has to know how to
// filter its own data by it — 'department' is the concrete,
// requested case (see EmployeesService), not a placeholder for a
// generic engine that doesn't exist yet. Adding another scope type
// later means adding it here AND teaching the relevant service(s)
// to filter by it — it does not happen automatically.
const SUPPORTED_SCOPE_TYPES = ['department'];

@Injectable()
export class ScopeValidationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validates a caller-supplied scope before it's trusted anywhere
   * — both that the scope TYPE is one this system actually
   * enforces (see SUPPORTED_SCOPE_TYPES) and that scopeId is a
   * real record of that type belonging to THIS company (never
   * trust a client-supplied ID as automatically same-tenant).
   * Returns the resolved {scopeType, scopeId}, defaulting to the
   * unscoped sentinel when the caller didn't ask for a scope.
   */
  async resolveScope(
    companyId: string,
    scopeType: string | undefined,
    scopeId: string | undefined,
  ): Promise<{ scopeType: string; scopeId: string }> {
    if (!scopeType && !scopeId) {
      return { scopeType: COMPANY_WIDE_SCOPE_TYPE, scopeId: COMPANY_WIDE_SCOPE_ID };
    }
    if (!scopeType || !scopeId) {
      throw new BadRequestException('scopeType and scopeId must be provided together.');
    }
    if (!SUPPORTED_SCOPE_TYPES.includes(scopeType)) {
      throw new BadRequestException(`Unsupported scope type: ${scopeType}.`);
    }
    if (scopeType === 'department') {
      const department = await this.prisma.department.findFirst({ where: { id: scopeId, companyId } });
      if (!department) throw new NotFoundException('Department not found.');
    }
    return { scopeType, scopeId };
  }
}
