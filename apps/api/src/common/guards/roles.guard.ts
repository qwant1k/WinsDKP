import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('User not authenticated');

    if (requiredRoles.includes('PORTAL_ADMIN') && user.globalRole === 'PORTAL_ADMIN') {
      return true;
    }

    if (user.globalRole === 'PORTAL_ADMIN') return true;

    const clanId = request.params?.clanId || request.body?.clanId || request.query?.clanId;

    if (clanId) {
      const membership = await this.prisma.clanMembership.findUnique({
        where: { userId_clanId: { userId: user.sub, clanId } },
      });

      if (!membership || !membership.isActive) {
        throw new ForbiddenException('Not a member of this clan');
      }

      const clanRoleMatch = requiredRoles.some((role) => {
        switch (role) {
          case 'CLAN_LEADER':
            return membership.role === 'CLAN_LEADER';
          case 'ELDER':
            return membership.role === 'CLAN_LEADER' || membership.role === 'ELDER';
          case 'MEMBER':
            return ['CLAN_LEADER', 'ELDER', 'MEMBER'].includes(membership.role);
          case 'NEWBIE':
            return ['CLAN_LEADER', 'ELDER', 'MEMBER', 'NEWBIE'].includes(membership.role);
          default:
            return false;
        }
      });

      if (clanRoleMatch) {
        request.clanMembership = membership;
        return true;
      }
    }

    const globalMatch = requiredRoles.includes(user.globalRole);
    if (globalMatch) return true;

    throw new ForbiddenException('Insufficient permissions');
  }
}
