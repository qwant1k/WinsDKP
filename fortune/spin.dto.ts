import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SpinDto {
  @ApiProperty({
    description: 'Ставка в DKP',
    enum: [5, 10, 15, 20],
    example: 10,
  })
  @IsIn([5, 10, 15, 20])
  bet: 5 | 10 | 15 | 20;
}

