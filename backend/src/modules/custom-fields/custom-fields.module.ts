import { Module } from '@nestjs/common';
import { CustomFieldDefinitionsService } from './custom-field-definitions.service';
import { CustomFieldValidationService } from './custom-field-validation.service';
import { CustomFieldDefinitionsController } from './custom-field-definitions.controller';

@Module({
  controllers: [CustomFieldDefinitionsController],
  providers: [CustomFieldDefinitionsService, CustomFieldValidationService],
  exports: [CustomFieldValidationService],
})
export class CustomFieldsModule {}
