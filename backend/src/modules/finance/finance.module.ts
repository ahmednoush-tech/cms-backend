import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { JournalEntriesService } from './journal-entries.service';
import { JournalEntriesController } from './journal-entries.controller';
import { FinanceSettingsService } from './finance-settings.service';
import { FinanceSettingsController } from './finance-settings.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { BillPaymentsService } from './bill-payments.service';
import { BillPaymentsController } from './bill-payments.controller';
import { FinancialReportsService } from './financial-reports.service';
import { FinancialReportsController } from './financial-reports.controller';
import { PeriodLockService } from './period-lock.service';
import { PeriodsService } from './periods.service';
import { PeriodsController } from './periods.controller';
import { InvoiceNotesService } from './invoice-notes.service';
import { InvoiceNotesController } from './invoice-notes.controller';
import { CustomerPaymentsService } from './customer-payments.service';
import { CustomerPaymentsController } from './customer-payments.controller';
import { InventoryItemsService } from './inventory-items.service';
import { InventoryItemsController } from './inventory-items.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrderReceiptsService } from './purchase-order-receipts.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ZatcaPhase2Module } from '../zatca-phase2/zatca-phase2.module';
import { PurchaseOrderItemsController } from './purchase-order-items.controller';
import { BankReconciliationsService } from './bank-reconciliations.service';
import { BankReconciliationsController } from './bank-reconciliations.controller';
import { CurrenciesService } from './currencies.service';
import { CurrenciesController } from './currencies.controller';
import { RecurringInvoiceTemplatesService } from './recurring-invoice-templates.service';
import { RecurringInvoiceTemplatesController } from './recurring-invoice-templates.controller';

@Module({
  imports: [InventoryModule, ZatcaPhase2Module],
  controllers: [
    AccountsController,
    JournalEntriesController,
    FinanceSettingsController,
    InvoicesController,
    PaymentsController,
    VendorsController,
    BillsController,
    BillPaymentsController,
    FinancialReportsController,
    PeriodsController,
    InvoiceNotesController,
    CustomerPaymentsController,
    InventoryItemsController,
    PurchaseOrdersController,
    PurchaseOrderItemsController,
    BankReconciliationsController,
    CurrenciesController,
    RecurringInvoiceTemplatesController,
  ],
  providers: [
    AccountsService,
    JournalEntriesService,
    FinanceSettingsService,
    InvoicesService,
    PaymentsService,
    VendorsService,
    BillsService,
    BillPaymentsService,
    FinancialReportsService,
    PeriodLockService,
    PeriodsService,
    InvoiceNotesService,
    CustomerPaymentsService,
    InventoryItemsService,
    PurchaseOrdersService,
    PurchaseOrderReceiptsService,
    BankReconciliationsService,
    CurrenciesService,
    RecurringInvoiceTemplatesService,
  ],
  exports: [
    AccountsService,
    JournalEntriesService,
    FinanceSettingsService,
    InvoicesService,
    PaymentsService,
    VendorsService,
    BillsService,
    BillPaymentsService,
    FinancialReportsService,
    PeriodLockService,
    PeriodsService,
    InvoiceNotesService,
    CustomerPaymentsService,
    InventoryItemsService,
    PurchaseOrdersService,
    BankReconciliationsService,
    CurrenciesService,
    RecurringInvoiceTemplatesService,
  ],
})
export class FinanceModule {}
