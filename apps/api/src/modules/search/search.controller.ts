import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across all entities' })
  async search(
    @Query('q') query: string,
    @Query('limit') limit: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.search(query, user.clanId, limit ? parseInt(limit, 10) : 20);
  }
}
