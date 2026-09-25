import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InventoryMovementsService } from './inventory-movements.service';
import { ReceiptDto, IssueDto, TransferDto, AdjustmentDto } from './dto/inventory-movement.dto';

@ApiTags('Operations / Inventory Movements')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/inventory-movements')
export class InventoryMovementsController {
  constructor(private inventoryMovementsService: InventoryMovementsService) {}

  @Get('item/:itemId')
  @Permissions('Operations:inventory_stock:view')
  findAllForItem(@CurrentUser('companyId') companyId: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.inventoryMovementsService.findAllForItem(companyId, itemId);
  }

  @Post('receipt')
  @Permissions('Operations:inventory_movements:create')
  receipt(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string, @Body() dto: ReceiptDto) {
    return this.inventoryMovementsService.receipt(companyId, userId, dto);
  }

  @Post('issue')
  @Permissions('Operations:inventory_movements:create')
  issue(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string, @Body() dto: IssueDto) {
    return this.inventoryMovementsService.issue(companyId, userId, dto);
  }

  @Post('transfer')
  @Permissions('Operations:inventory_movements:create')
  transfer(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string, @Body() dto: TransferDto) {
    return this.inventoryMovementsService.transfer(companyId, userId, dto);
  }

  @Post('adjustment')
  @Permissions('Operations:inventory_movements:create')
  adjustment(@CurrentUser('companyId') companyId: string, @CurrentUser('sub') userId: string, @Body() dto: AdjustmentDto) {
    return this.inventoryMovementsService.adjustment(companyId, userId, dto);
  }
}
