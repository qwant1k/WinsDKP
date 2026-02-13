import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'player@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase, one lowercase letter and one number',
  })
  password!: string;

  @ApiProperty({ example: 'DragonSlayer', minLength: 3, maxLength: 32 })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Nickname can only contain letters, numbers, underscores and hyphens' })
  nickname!: string;

  @ApiPropertyOptional({ example: 'Dragon Slayer' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;
}
