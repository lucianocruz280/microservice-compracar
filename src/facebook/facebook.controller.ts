import { Controller, Post, Body, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { FacebookService } from './facebook.service';

@Controller('facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  private readonly VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'botize_verify_token';
  private readonly PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

  // ✅ Verificación del webhook
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === this.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  // ✅ Recepción de leads reales
  @Post('webhook')
  async receiveLead(@Body() body: any) {
    try {
      console.log('📩 Lead recibido:', JSON.stringify(body, null, 2));

      const leadgen = body?.entry?.[0]?.changes?.[0]?.value;
      if (!leadgen?.leadgen_id) {
        throw new Error('No se recibió leadgen_id válido');
      }

      // 1️⃣ Pedimos los datos reales del lead al Graph API
      const { data } = await axios.get(
        `https://graph.facebook.com/v24.0/${leadgen.leadgen_id}`,
        {
          params: { access_token: this.PAGE_ACCESS_TOKEN },
        },
      );

      console.log('✅ Datos del lead desde Graph API:', data);

      // 2️⃣ Mapeamos los field_data de Facebook al formato que espera tu processLead()
      const mappedPayload: Record<string, any> = {};

      for (const field of data.field_data) {
        const key = field.name;
        const value = field.values?.[0] ?? '';
        mappedPayload[key] = value;
      }

      // 3️⃣ Reenvía los datos al servicio ya existente
      const result = await this.facebookService.processLead(mappedPayload);

      return { success: true, result };
    } catch (error) {
      console.error('❌ Error procesando webhook:', error.message);
      return { success: false, error: error.message };
    }
  }
}
