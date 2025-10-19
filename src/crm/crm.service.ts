import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class CrmService {
    private readonly logger = new Logger(CrmService.name);
    private readonly baseUrl = 'https://backend.compracar.cl/api/home';
    private readonly storeUrl = 'https://backend.compracar.cl/api/appraisal-store';

    private cache = {
        brands: [],
        mileage: [],
        fuels: [],
        tractions: [],
        transmissions: [],
    };

    async initCache() {
        try {
            const [brands, mileage] = await Promise.all([
                this.getBrands(),
                this.getMileage(),
            ]);

            this.cache.brands = brands;
            this.cache.mileage = mileage;

            this.logger.log(`Catálogos cargados: ${brands.length} marcas, ${mileage.length} rangos.`);
        } catch (error) {
            this.logger.error('Error inicializando caché del CRM:', error.message);
        }
    }

    async getBrands() {
        const { data } = await axios.get(`${this.baseUrl}/appraisal-brand`);
        return data.data || [];
    }

    async getModels(brandId: number) {
        const { data } = await axios.get(`${this.baseUrl}/appraisal-model?brand_id=${brandId}`);
        return data.data || [];
    }

    async getVersions(modelId: number, year: number) {
        const { data } = await axios.get(`${this.baseUrl}/appraisal-version?model_id=${modelId}&year=${year}`);
        return data.data || [];
    }

    async getFuels(modelId: number, year: number, versionId: number) {
        const { data } = await axios.get(`${this.baseUrl}/appraisal-fuel?model_id=${modelId}&year=${year}&version_id=${versionId}`);
        return data.data || [];
    }

    async getTractions(modelId: number, year: number, versionId: number) {
        const { data } = await axios.get(`${this.baseUrl}/appraisal-traction?model_id=${modelId}&year=${year}&version_id=${versionId}`);
        return data.data || [];
    }

    async getTransmissions(modelId: number, year: number, versionId: number, tractionId: number) {
        const { data } = await axios.get(`${this.baseUrl}/appraisal-transmission?model_id=${modelId}&year=${year}&version_id=${versionId}&traction_id=${tractionId}`);
        return data.data || [];
    }

    async getMileage() {
        const { data } = await axios.get(`${this.baseUrl}/appraisal-mileage`);
        return data.data || [];
    }

    async sendAppraisal(formData: FormData) {
        try {
            const { data } = await axios.post(this.storeUrl, formData, {
                headers: formData.getHeaders(),
            });

            this.logger.log(`Lead enviado al CRM → ID: ${data?.data?.id}`);
            return data;
        } catch (error) {
            this.logger.error(`Error enviando lead al CRM: ${error.message}`);
            throw error;
        }
    }

    getCachedBrands() {
        return this.cache.brands;
    }

    getCachedMileage() {
        return this.cache.mileage;
    }
}
