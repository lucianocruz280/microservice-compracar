import { Test, TestingModule } from '@nestjs/testing';
import { NormalizerController } from './normalizer.controller';

describe('NormalizerController', () => {
  let controller: NormalizerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NormalizerController],
    }).compile();

    controller = module.get<NormalizerController>(NormalizerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
