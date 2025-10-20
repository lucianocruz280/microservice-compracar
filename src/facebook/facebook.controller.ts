import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { FacebookService } from './facebook.service';

@Controller('facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  private readonly VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'botize_verify_token';

  private readonly PAGE_TOKEN_MAP: Record<string, string> = {
    '1297848323600757': process.env.SUBTERRA_PAGE_TOKEN, // Automotriz Subterra
    '113562660048196': process.env.COMPRACAR_PAGE_TOKEN, // Compracar
  };

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

  // ✅ Recepción de leads
  @Post('webhook')
  async receiveLead(@Body() body: any) {
    try {
      if (!body?.entry?.length || !body.entry[0].changes?.length) {
        throw new Error('Payload de webhook no tiene formato válido.');
      }

      const pageId = body.entry[0].id;
      const leadgen = body.entry[0].changes[0].value;

      if (!leadgen?.leadgen_id) {
        throw new Error('No se recibió leadgen_id válido.');
      }

      const accessToken = this.PAGE_TOKEN_MAP[pageId];

      if (!accessToken) {
        throw new Error(`No hay token configurado para page_id: ${pageId}`);
      }

      // 📡 Obtener los datos del lead desde Facebook Graph API
      const { data } = await axios.get(`https://graph.facebook.com/v24.0/${leadgen.leadgen_id}`, {
        params: { access_token: accessToken },
      });

      if (!data?.field_data?.length) {
        throw new Error('No se recibió field_data desde el Graph API.');
      }

      // 📦 Mapear field_data al payload del servicio
      const mappedPayload: Record<string, any> = {};

      for (const field of data.field_data) {
        const key = field.name;
        const value = field.values?.[0] ?? '';
        mappedPayload[key] = value;
      }

      // 🛠️ Reenviar al servicio interno
      const result = await this.facebookService.processLead(mappedPayload);

      return { success: true, result };
    } catch (error) {
      console.error('❌ Error procesando webhook:', error?.response?.data || error.message);
      throw new HttpException(
        {
          success: false,
          error: error?.response?.data || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
