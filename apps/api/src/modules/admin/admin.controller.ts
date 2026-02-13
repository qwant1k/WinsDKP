import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('PORTAL_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async dashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  async getUsers(@Query() query: PaginationDto) {
    return this.adminService.getUsers(query);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new user' })
  async createUser(
    @CurrentUser() user: JwtPayload,
    @Body() body: { email: string; nickname: string; displayName?: string; globalRole?: string; password?: string },
  ) {
    return this.adminService.createUser(body, user.sub);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user (role, status, profile)' })
  async updateUser(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { globalRole?: string; isActive?: boolean; email?: string; displayName?: string; bm?: number; level?: number },
  ) {
    return this.adminService.updateUser(id, body, user.sub);
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Admin reset user password (forces change on next login)' })
  async resetUserPassword(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.authService.adminResetPassword(id, user.sub);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.deleteUser(id, user.sub);
  }

  @Get('clans')
  @ApiOperation({ summary: 'List all clans' })
  async getClans(@Query() query: PaginationDto) {
    return this.adminService.getClans(query);
  }

  @Post('clans')
  @ApiOperation({ summary: 'Create a new clan' })
  async createClan(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; tag: string; description?: string },
  ) {
    return this.adminService.createClan(body, user.sub);
  }

  @Get('dkp/wallets')
  @ApiOperation({ summary: 'List all DKP wallets' })
  async getDkpWallets(@Query() query: PaginationDto) {
    return this.adminService.getDkpWallets(query);
  }

  @Get('dkp/transactions')
  @ApiOperation({ summary: 'List all DKP transactions' })
  async getTransactions(@Query() query: PaginationDto & { userId?: string; type?: string }) {
    return this.adminService.getAllTransactions(query);
  }

  @Get('auctions')
  @ApiOperation({ summary: 'List all auctions' })
  async getAuctions(@Query() query: PaginationDto) {
    return this.adminService.getAllAuctions(query);
  }

  @Get('activities')
  @ApiOperation({ summary: 'List all activities' })
  async getActivities(@Query() query: PaginationDto) {
    return this.adminService.getAllActivities(query);
  }

  @Get('randomizer')
  @ApiOperation({ summary: 'List all randomizer sessions' })
  async getRandomizer(@Query() query: PaginationDto) {
    return this.adminService.getAllRandomizerSessions(query);
  }

  @Get('warehouse')
  @ApiOperation({ summary: 'List all warehouse items' })
  async getWarehouse(@Query() query: PaginationDto) {
    return this.adminService.getAllWarehouseItems(query);
  }

  @Get('news')
  @ApiOperation({ summary: 'List all news posts' })
  async getNews(@Query() query: PaginationDto) {
    return this.adminService.getNewsPosts(query);
  }

  @Get('feed')
  @ApiOperation({ summary: 'List all feed posts' })
  async getFeed(@Query() query: PaginationDto & { reported?: boolean }) {
    return this.adminService.getFeedPosts(query);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List all notifications' })
  async getNotifications(@Query() query: PaginationDto) {
    return this.adminService.getNotifications(query);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get all system settings' })
  async getSettings() {
    return this.adminService.getSystemSettings();
  }

  @Patch('settings/:key')
  @ApiOperation({ summary: 'Update a system setting' })
  async updateSetting(
    @Param('key') key: string,
    @CurrentUser() user: JwtPayload,
    @Body('value') value: unknown,
  ) {
    return this.adminService.updateSystemSetting(key, value, user.sub);
  }

  @Post('impersonate/:userId')
  @ApiOperation({ summary: 'Impersonate a user (portal_admin only)' })
  async impersonate(@Param('userId') userId: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.impersonate(userId, user.sub);
  }

  @Get('coefficients/:clanId')
  @ApiOperation({ summary: 'Get DKP coefficients for a clan' })
  async getCoefficients(@Param('clanId') clanId: string) {
    return this.adminService.getCoefficients(clanId);
  }

  @Patch('coefficients/:clanId/power')
  @ApiOperation({ summary: 'Update power coefficient ranges' })
  async updatePowerCoefficients(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body('ranges') ranges: Array<{ fromPower: number; toPower: number; coefficient: number }>,
  ) {
    return this.adminService.updatePowerCoefficients(clanId, ranges, user.sub);
  }

  @Patch('coefficients/:clanId/level')
  @ApiOperation({ summary: 'Update level coefficient ranges' })
  async updateLevelCoefficients(
    @Param('clanId') clanId: string,
    @CurrentUser() user: JwtPayload,
    @Body('ranges') ranges: Array<{ fromLevel: number; toLevel: number; coefficient: number }>,
  ) {
    return this.adminService.updateLevelCoefficients(clanId, ranges, user.sub);
  }
}
