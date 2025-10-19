import { Module, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FacebookController } from './facebook/facebook.controller';
import { FacebookService } from './facebook/facebook.service';
import { FacebookModule } from './facebook/facebook.module';
import { CrmController } from './crm/crm.controller';
import { CrmService } from './crm/crm.service';
import { NormalizerController } from './normalizer/normalizer.controller';
import { NormalizerService } from './normalizer/normalizer.service';
import { CrmModule } from './crm/crm.module';
import { NormalizerModule } from './normalizer/normalizer.module';
import { LoggerService } from './logger/logger.service';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [FacebookModule, CrmModule, NormalizerModule, LoggerModule],
  controllers: [AppController, FacebookController, CrmController, NormalizerController],
  providers: [AppService, FacebookService, CrmService, NormalizerService, LoggerService],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly crmService: CrmService) { }

  async onModuleInit() {
    console.log('🧠 Cargando catálogos iniciales desde backend.compracar.cl...');
    await this.crmService.initCache();
    console.log('✅ Catálogos cargados correctamente.');
  }
}
