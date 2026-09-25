import { Module } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { InventoryItemsService } from './inventory-items.service';
import { InventoryStockService } from './inventory-stock.service';
import { InventoryMovementsService } from './inventory-movements.service';
import { WarehousesController } from './warehouses.controller';
import { InventoryItemsController } from './inventory-items.controller';
import { InventoryStockController } from './inventory-stock.controller';
import { InventoryMovementsController } from './inventory-movements.controller';

@Module({
  controllers: [WarehousesController, InventoryItemsController, InventoryStockController, InventoryMovementsController],
  providers: [WarehousesService, InventoryItemsService, InventoryStockService, InventoryMovementsService],
  exports: [WarehousesService, InventoryItemsService, InventoryStockService, InventoryMovementsService],
})
export class InventoryModule {}
