import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { FacebookService } from './facebook.service';

@Controller('facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  // 🔹 1. Verificación inicial del Webhook (GET)
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'botize_verify_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(challenge);
    } else {
      console.warn('❌ Error de verificación del webhook');
      return res.sendStatus(403);
    }
  }

  // 🔹 2. Recepción de datos (POST)
  @Post('webhook')
  async receiveLead(@Body() body: any) {
    console.log('📩 Lead recibido desde Meta:', JSON.stringify(body, null, 2));
    return this.facebookService.processLead(body);
  }
}
