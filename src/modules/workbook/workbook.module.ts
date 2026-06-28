import { Module } from '@nestjs/common';
import { WorkbookService } from './application/workbook.service';
import { WorkbookResolver } from './interface/workbook.resolver';

@Module({
  providers: [WorkbookService, WorkbookResolver],
})
export class WorkbookModule {}
