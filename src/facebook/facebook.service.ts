import { Injectable, Logger } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import { NormalizerService } from '../normalizer/normalizer.service';
import * as FormData from 'form-data';

@Injectable()
export class FacebookService {
    private readonly logger = new Logger(FacebookService.name);

    constructor(
        private readonly crmService: CrmService,
        private readonly normalizer: NormalizerService,
    ) { }

    /**
     * Procesa un lead proveniente del formulario de Facebook.
     */
    async processLead(payload: any) {
        try {
            this.logger.log(`Lead recibido desde Meta: ${JSON.stringify(payload)}`);

            // ======================================================
            // 1️⃣ Extracción y sanitización de campos
            // ======================================================
            const lead = {
                brand: payload.brand || payload.marca || '',
                model: payload.model || payload.modelo || '',
                version: payload.version || '',
                fuel: payload.fuel || payload.combustible || '',
                traction: payload.traction || payload.traccion || '',
                transmission: payload.transmission || payload.transmision || '',
                mileage: payload.mileage || payload.kilometraje || '',
                year: parseInt(payload.year || payload.año || '0'),
                amount: payload.amount || payload.valor || payload.price || 0,
                message: payload.message || 'Sin mensaje',
                hasAirConditioning:
                    payload.hasAirConditioning ||
                    payload.airConditioning ||
                    payload.tiene_aire ||
                    false,
                name: payload.name || payload.nombre || '',
                phone: payload.phone || payload.telefono || '',
                email: payload.email || '',
                images: payload.images || [],
            };

            // ======================================================
            // 2️⃣ Normalización automática (fuzzy)
            // ======================================================
            const normalized = await this.normalizer.normalizeFullLead({
                brand: lead.brand,
                model: lead.model,
                version: lead.version,
                fuel: lead.fuel,
                traction: lead.traction,
                transmission: lead.transmission,
                mileage: lead.mileage,
                year: lead.year,
            });

            if (!normalized.brandId || !normalized.modelId) {
                throw new Error('No se pudo normalizar marca o modelo.');
            }

            // ======================================================
            // 3️⃣ Construcción del payload final (FormData)
            // ======================================================
            const formData = new FormData();

            formData.append('brandId', normalized.brandId);
            formData.append('modelId', normalized.modelId);
            if (normalized.versionId) formData.append('versionId', normalized.versionId);
            if (normalized.fuelId) formData.append('fuelId', normalized.fuelId);
            if (normalized.tractionId) formData.append('tractionId', normalized.tractionId);
            if (normalized.transmissionId)
                formData.append('transmissionId', normalized.transmissionId);
            if (normalized.mileageId) formData.append('mileageId', normalized.mileageId);

            formData.append('year', lead.year);
            formData.append('amount', lead.amount);
            formData.append('message', lead.message);
            formData.append('hasAirConditioning', lead.hasAirConditioning ? 1 : 0);
            formData.append('price', 0);
            formData.append('name', lead.name);
            formData.append('phone', lead.phone);
            formData.append('email', lead.email);
            formData.append('isFacebookLeads', 1);

            // Agregar imágenes si existen
            if (Array.isArray(lead.images) && lead.images.length > 0) {
                lead.images.forEach((file, i) => {
                    formData.append(`images[${i}]`, file);
                });
            }
            const rawStreams = (formData as any)._streams;

            const debugForm: Record<string, any> = {};
            if (Array.isArray(rawStreams)) {
                for (let i = 0; i < rawStreams.length; i++) {
                    const line = rawStreams[i];
                    if (typeof line === 'string') {
                        const match = line.match(/name="([^"]+)"\r\n\r\n(.+)/s);
                        if (match) {
                            const [, key, value] = match;

                            // Si no quieres mostrar datos sensibles:
                            if (['phone', 'email', 'name'].includes(key)) {
                                debugForm[key] = '[OCULTO]';
                            } else {
                                debugForm[key] = value.trim();
                            }
                        }
                    }
                }
            }

            this.logger.log(`📤 [Producción] Payload enviado al CRM:\n${JSON.stringify(debugForm, null, 2)}`);
            // ======================================================
            // 4️⃣ Envío al CRM (Laravel)
            // ======================================================
            const response = await this.crmService.sendAppraisal(formData);

            this.logger.log(`Lead reenviado con éxito. ID: ${response.data?.id}`);
            return response;
        } catch (error) {
            this.logger.error(`Error procesando lead: ${error.message}`, error.stack);
            throw new Error('Error al procesar el lead. Revisa los logs para más detalles.');
        }
    }
}
