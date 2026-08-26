import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('security-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super')
export class SecurityEventsController {
  constructor(private readonly securityEvents: SecurityEventsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.securityEvents.findAll(status);
  }
}
