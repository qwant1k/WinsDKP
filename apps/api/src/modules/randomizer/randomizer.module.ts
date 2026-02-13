import { Module } from '@nestjs/common';
import { RandomizerService } from './randomizer.service';
import { RandomizerController } from './randomizer.controller';

@Module({
  controllers: [RandomizerController],
  providers: [RandomizerService],
  exports: [RandomizerService],
})
export class RandomizerModule {}
