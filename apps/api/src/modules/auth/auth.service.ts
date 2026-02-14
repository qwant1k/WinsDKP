import { Injectable, UnauthorizedException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ip?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await this.hashPassword(dto.password);
    const emailToken = crypto.randomUUID();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        emailToken,
        profile: {
          create: {
            nickname: dto.nickname,
            displayName: dto.displayName || dto.nickname,
          },
        },
        dkpWallet: {
          create: { balance: 0, onHold: 0, totalEarned: 0 },
        },
      },
      include: { profile: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'user.registered',
        entityType: 'user',
        entityId: user.id,
        ip,
        userAgent,
      },
    });

    this.logger.log(`User registered: ${user.email}`);
    return { message: 'Registration successful. Please verify your email.', userId: user.id };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true, clanMemberships: { where: { isActive: true } } },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.verifyPassword(dto.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    const activeMembership = user.clanMemberships[0];

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      globalRole: user.globalRole,
      clanId: activeMembership?.clanId,
      clanRole: activeMembership?.role,
    });

    const refreshExpiry = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiry) || 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        userAgent,
        ip,
        expiresAt,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'user.login',
        entityType: 'user',
        entityId: user.id,
        ip,
        userAgent,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        globalRole: user.globalRole,
        profile: user.profile,
        clanMembership: activeMembership || null,
      },
      mustChangePassword: user.mustChangePassword,
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    const session = await this.prisma.session.findFirst({
      where: { refreshToken, revokedAt: null },
      include: {
        user: {
          include: {
            profile: true,
            clanMemberships: { where: { isActive: true } },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.session.updateMany({
          where: { userId: session.userId },
          data: { revokedAt: new Date() },
        });
        this.logger.warn(`Refresh token reuse detected for user ${session.userId}`);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const user = session.user;
    const activeMembership = user.clanMemberships[0];

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      globalRole: user.globalRole,
      clanId: activeMembership?.clanId,
      clanRole: activeMembership?.role,
    });

    const refreshExpiry = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiry) || 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        userAgent: session.userAgent,
        ip: session.ip,
        expiresAt,
      },
    });

    return tokens;
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.session.updateMany({
      where: { userId, refreshToken },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'All sessions revoked' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({ where: { emailToken: token } });
    if (!user) throw new BadRequestException('Invalid verification token');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailToken: null },
    });

    return { message: 'Email verified successfully' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'Если email существует, код отправлен.' };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const resetTokenExp = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: code, resetTokenExp },
    });

    await this.sendEmail(
      email,
      'Ymir Hub — Код для сброса пароля',
      `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
        <h2 style="color:#c9a227">Сброс пароля</h2>
        <p>Ваш код подтверждения:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;background:#1a1a2e;color:#c9a227;border-radius:8px">${code}</div>
        <p style="color:#888;font-size:12px">Код действителен 15 минут. Если вы не запрашивали сброс — проигнорируйте это письмо.</p>
      </div>`,
    );

    return { message: 'Если email существует, код отправлен.' };
  }

  async verifyResetCode(email: string, code: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, resetToken: code, resetTokenExp: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Неверный или просроченный код');
    return { valid: true };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, resetToken: code, resetTokenExp: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Неверный или просроченный код');

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExp: null, mustChangePassword: false },
    });

    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Пароль успешно изменён' };
  }

  private async sendEmail(to: string, subject: string, html: string) {
    try {
      const smtpHost = this.config.get<string>('SMTP_HOST', 'mailpit');
      const smtpPort = Number(this.config.get<number>('SMTP_PORT', 1025));
      const smtpUser = this.config.get<string>('SMTP_USER', '');
      const smtpPass = this.config.get<string>('SMTP_PASS', '');
      const smtpSecure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        ...(smtpUser ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
      });

      await transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM', 'noreply@ymir.local'),
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.warn(`Failed to send email to ${to}: ${err}`);
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new BadRequestException('User not found');

    const isValid = await this.verifyPassword(oldPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { message: 'Password changed successfully' };
  }

  async forceChangePassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (!user.mustChangePassword) throw new BadRequestException('Password change not required');

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { message: 'Password changed successfully' };
  }

  async adminResetPassword(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });

    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'admin.user.password_reset',
        entityType: 'user',
        entityId: userId,
      },
    });

    return { message: 'User must change password on next login' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        dkpWallet: true,
        clanMemberships: {
          where: { isActive: true },
          include: { clan: true },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return {
      id: user.id,
      email: user.email,
      globalRole: user.globalRole,
      emailVerified: user.emailVerified,
      profile: user.profile,
      dkpWallet: user.dkpWallet,
      clanMembership: user.clanMemberships[0] || null,
    };
  }

  private async generateTokens(payload: Record<string, unknown>) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(32).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (!storedHash.includes(':')) {
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      return hash === storedHash;
    }
    const [salt, hash] = storedHash.split(':');
    const computed = crypto.scryptSync(password, salt!, 64).toString('hex');
    return computed === hash;
  }
}
