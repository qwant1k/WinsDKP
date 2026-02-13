import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('PORTAL_ADMIN', 'CLAN_LEADER')
  @ApiOperation({ summary: 'Get audit logs (raw)' })
  async findAll(
    @Query() query: PaginationDto & { actorId?: string; entityType?: string; action?: string; from?: string; to?: string },
  ) {
    return this.auditService.findAll(query);
  }

  @Get('events')
  @Roles('PORTAL_ADMIN', 'CLAN_LEADER')
  @ApiOperation({ summary: 'Get human-readable audit event logs' })
  async getEventLogs(
    @Query() query: PaginationDto & { category?: string; entityType?: string; from?: string; to?: string },
  ) {
    return this.auditService.getEventLogs(query);
  }

  @Get('categories')
  @Roles('PORTAL_ADMIN', 'CLAN_LEADER')
  @ApiOperation({ summary: 'Get available audit categories and entity type labels' })
  async getCategories() {
    return {
      categories: this.auditService.getCategories(),
      entityTypes: this.auditService.getEntityTypeLabels(),
    };
  }

  @Get(':id')
  @Roles('PORTAL_ADMIN', 'CLAN_LEADER')
  @ApiOperation({ summary: 'Get audit log detail' })
  async findOne(@Param('id') id: string) {
    return this.auditService.findById(id);
  }
}
