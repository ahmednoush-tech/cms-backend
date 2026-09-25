import { Module } from '@nestjs/common';
import { ZatcaCryptoService } from './zatca-crypto.service';
import { ZatcaApiClient } from './zatca-api-client';
import { ZatcaCertificateService } from './zatca-certificate.service';
import { ZatcaUblInvoiceBuilder } from './zatca-ubl-invoice-builder';
import { ZatcaInvoiceSubmissionService } from './zatca-invoice-submission.service';
import { ZatcaCertificateController } from './zatca-certificate.controller';

@Module({
  controllers: [ZatcaCertificateController],
  providers: [ZatcaCryptoService, ZatcaApiClient, ZatcaCertificateService, ZatcaUblInvoiceBuilder, ZatcaInvoiceSubmissionService],
  exports: [ZatcaCryptoService, ZatcaCertificateService, ZatcaUblInvoiceBuilder, ZatcaInvoiceSubmissionService],
})
export class ZatcaPhase2Module {}
