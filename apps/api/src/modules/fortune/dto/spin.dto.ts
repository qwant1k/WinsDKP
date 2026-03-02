import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SpinDto {
  @ApiProperty({
    description: 'Fortune Wheel bet amount in DKP',
    enum: [5, 10, 15, 20],
    example: 10,
  })
  @IsIn([5, 10, 15, 20])
  bet!: 5 | 10 | 15 | 20;
}
