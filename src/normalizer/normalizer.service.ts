import { Injectable, Logger } from '@nestjs/common';
import { CrmService } from '../crm/crm.service';
import * as stringSimilarity from 'string-similarity';

@Injectable()
export class NormalizerService {
    private readonly logger = new Logger(NormalizerService.name);

    constructor(private readonly crmService: CrmService) { }

    // Nivel mínimo de similitud (0–100)
    private threshold = 0.25;

    // ======================================================
    // 🔹 UTILIDAD GENERAL
    // ======================================================
    private fuzzyMatch(
        input: string,
        list: any[],
        key: string,
        context: string,
    ): any | null {
        if (!input || !list || list.length === 0) return null;

        const names = list.map((item) => item[key]?.toString().toUpperCase());
        console.log("input", input, "names", names)
        const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(
            input.toUpperCase(),
            names,
        );

        const bestScore = bestMatch.rating;
        const matched = list[bestMatchIndex];

        if (bestScore >= this.threshold) {
            this.logger.log(
                `[${context}] "${input}" → ${matched[key]} (score: ${(bestScore * 100).toFixed(1)}%)`,
            );
            return matched;
        }

        this.logger.warn(
            `[${context}] No match for "${input}" (mejor coincidencia: ${matched[key]} con ${(bestScore * 100).toFixed(1)}%)`,
        );
        return null;
    }

    // ======================================================
    // 🔹 MARCA
    // ======================================================
    normalizeBrand(input: string): number | null {
        const brands = this.crmService.getCachedBrands();
        const match = this.fuzzyMatch(input, brands, 'name', 'Marca');
        return match ? match.id : null;
    }

    // ======================================================
    // 🔹 MODELO
    // ======================================================
    async normalizeModel(input: string, brandId: number): Promise<number | null> {
        try {
            const models = await this.crmService.getModels(brandId);

            // Si no hay modelos disponibles
            if (!models || models.length === 0) {
                this.logger.warn(`[Modelo] No se encontraron modelos para marca ${brandId}`);
                return null;
            }

            // Si el input viene vacío
            if (!input) {
                this.logger.log(`[Modelo] Input vacío, usando primer modelo disponible: ${models[0].name}`);
                return models[0].id;
            }

            // Intentar match por similitud
            const match = this.fuzzyMatch(input, models, 'name', 'Modelo');

            // Si no hubo match, usar primer modelo
            if (!match) {
                this.logger.warn(`[Modelo] No match para "${input}", usando fallback: ${models[0].name}`);
                return models[0].id;
            }

            return match.id;
        } catch (error) {
            this.logger.error(`[Modelo] Error al obtener modelos de marca ${brandId}: ${error.message}`);
            return null;
        }
    }

    // ======================================================
    // 🔹 VERSIÓN
    // ======================================================
    async normalizeVersion(
        input: string,
        modelId: number,
        year: number,
    ): Promise<number | null> {
        try {
            const versions = await this.crmService.getVersions(modelId, year);

            // Si no hay versiones en absoluto
            if (!versions || versions.length === 0) {
                this.logger.warn(`[Versión] No se encontraron versiones para modelo ${modelId} (${year})`);
                return null;
            }

            // Si no hay input (campo vacío)
            if (!input) {
                // Buscar una versión "SIN VERSION", si no existe, tomar la primera disponible
                const fallback =
                    versions.find(v => v.name.toUpperCase().includes('SIN VERSION')) ||
                    versions[0];

                this.logger.log(`[Versión] Input vacío, usando fallback: ${fallback.name}`);
                return fallback.id;
            }

            // Intentar coincidencia normal
            const match = this.fuzzyMatch(input, versions, 'name', 'Versión');

            // Si no hay coincidencia
            if (!match) {
                // Buscar "SIN VERSION" o primera disponible
                const fallbackVersion =
                    versions.find(v => v.name.toUpperCase().includes('SIN VERSION')) ||
                    versions[0];

                this.logger.warn(
                    `[Versión] No match para "${input}", usando fallback: ${fallbackVersion.name}`,
                );
                return fallbackVersion.id;
            }

            // Si hubo coincidencia exitosa
            return match.id;
        } catch (error) {
            this.logger.error(`[Versión] Error con modelo ${modelId} año ${year}: ${error.message}`);
            return null;
        }
    }

    // ======================================================
    // 🔹 COMBUSTIBLE
    // ======================================================
    async normalizeFuel(
        input: string,
        modelId: number,
        year: number,
        versionId: number,
    ): Promise<number | null> {
        try {
            const fuels = await this.crmService.getFuels(modelId, year, versionId);
            const match = this.fuzzyMatch(input, fuels, 'name', 'Combustible');
            return match ? match.id : null;
        } catch (error) {
            this.logger.error(`[Combustible] Error obteniendo combustibles: ${error.message}`);
            return null;
        }
    }

    // ======================================================
    // 🔹 TRACCIÓN
    // ======================================================
    async normalizeTraction(
        input: string,
        modelId: number,
        year: number,
        versionId: number,
    ): Promise<number | null> {
        try {
            const tractions = await this.crmService.getTractions(modelId, year, versionId);
            const match = this.fuzzyMatch(input, tractions, 'name', 'Tracción');
            return match ? match.id : null;
        } catch (error) {
            this.logger.error(`[Tracción] Error obteniendo tracciones: ${error.message}`);
            return null;
        }
    }

    // ======================================================
    // 🔹 TRANSMISIÓN
    // ======================================================
    async normalizeTransmission(
        input: string,
        modelId: number,
        year: number,
        versionId: number,
        tractionId: number,
    ): Promise<number | null> {
        try {
            const transmissions = await this.crmService.getTransmissions(
                modelId,
                year,
                versionId,
                tractionId,
            );

            if (!transmissions || transmissions.length === 0) {
                this.logger.warn(`[Transmisión] No se encontraron transmisiones para modelo ${modelId}`);
                return null;
            }

            // 🧩 Normalización semántica antes del fuzzyMatch
            let normalizedInput = input?.toUpperCase().trim();

            const replacements: Record<string, string> = {
                MECANICO: 'MANUAL',
                MECÁNICO: 'MANUAL',
                ESTÁNDAR: 'MANUAL',
                STANDARD: 'MANUAL',
                AUTOMATICO: 'AUTOMÁTICA',
                AUTOMÁTICO: 'AUTOMÁTICA',
            };

            if (normalizedInput && replacements[normalizedInput]) {
                normalizedInput = replacements[normalizedInput];
                this.logger.log(`[Transmisión] Normalizado "${input}" → "${normalizedInput}"`);
            }

            // Ejecutar coincidencia difusa
            const match = this.fuzzyMatch(normalizedInput, transmissions, 'name', 'Transmisión');

            // Si no hay match, usar fallback (primera o "AUTOMÁTICA")
            if (!match) {
                const fallback =
                    transmissions.find(t => t.name.toUpperCase().includes('AUTOMÁTICA')) ||
                    transmissions[0];
                this.logger.warn(
                    `[Transmisión] No match para "${normalizedInput}", usando fallback: ${fallback.name}`,
                );
                return fallback.id;
            }

            return match.id;
        } catch (error) {
            this.logger.error(`[Transmisión] Error obteniendo transmisiones: ${error.message}`);
            return null;
        }
    }

    // ======================================================
    // 🔹 KILOMETRAJE
    // ======================================================
    normalizeMileage(input: string): number | null {
        const mileage = this.crmService.getCachedMileage();
        const match = this.fuzzyMatch(input, mileage, 'name', 'Kilometraje');
        return match ? match.id : null;
    }

    // ======================================================
    // 🔹 Normalización completa (opcional)
    // ======================================================
    async normalizeFullLead(raw: {
        brand: string;
        model: string;
        version?: string;
        fuel?: string;
        traction?: string;
        transmission?: string;
        mileage?: string;
        year?: number;
    }) {
        const result: Record<string, number | null> = {
            brandId: null,
            modelId: null,
            versionId: null,
            fuelId: null,
            tractionId: null,
            transmissionId: null,
            mileageId: null,
        };

        result.brandId = this.normalizeBrand(raw.brand);
        if (result.brandId)
            result.modelId = await this.normalizeModel(raw.model, result.brandId);

        if (result.modelId && raw.year && raw.version)
            result.versionId = await this.normalizeVersion(raw.version, result.modelId, raw.year);

        if (result.versionId && raw.fuel)
            result.fuelId = await this.normalizeFuel(raw.fuel, result.modelId, raw.year, result.versionId);

        if (result.versionId && raw.traction)
            result.tractionId = await this.normalizeTraction(raw.traction, result.modelId, raw.year, result.versionId);

        if (result.versionId && raw.transmission && result.tractionId)
            result.transmissionId = await this.normalizeTransmission(
                raw.transmission,
                result.modelId,
                raw.year,
                result.versionId,
                result.tractionId,
            );

        if (raw.mileage) result.mileageId = this.normalizeMileage(raw.mileage);

        // this.logger.log(`Normalización completa: ${JSON.stringify(result, null, 2)}`);
        return result;
    }
}
