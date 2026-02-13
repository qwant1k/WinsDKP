import { Controller, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (admin)' })
  async findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Get('me/timeline')
  @ApiOperation({ summary: 'Get current user timeline' })
  async myTimeline(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.usersService.getTimeline(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() data: { displayName?: string; bm?: number; level?: number; contacts?: object; locale?: string; notifyPrefs?: object },
  ) {
    return this.usersService.updateProfile(user.sub, data);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get user timeline' })
  async getTimeline(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.usersService.getTimeline(id, query);
  }
}
