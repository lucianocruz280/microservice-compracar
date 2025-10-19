import { Body, Controller, Post } from '@nestjs/common';
import { FacebookService } from './facebook.service';

@Controller('facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  /**
   * Endpoint que recibe el payload de Meta (Facebook Lead Ads).
   * Ejemplo: https://tudominio.com/facebook/webhook
   */
  @Post('webhook')
  async receiveLead(@Body() body: any) {
    return this.facebookService.processLead(body);
  }
}
