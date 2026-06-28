import { Module } from '@nestjs/common';
import { ProjectService } from './application/project.service';
import { ProjectResolver } from './interface/project.resolver';

@Module({
  providers: [ProjectService, ProjectResolver],
})
export class ProjectModule {}
