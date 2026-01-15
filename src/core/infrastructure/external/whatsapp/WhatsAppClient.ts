import axios, { AxiosInstance, AxiosError } from 'axios';

export interface WhatsAppMessage {
    to: string;
    type: 'text' | 'template';
    text?: {
        body: string;
        preview_url?: boolean;
    };
    template?: {
        name: string;
        language: {
            code: string;
        };
        components?: Array<{
            type: string;
            parameters: Array<{
                type: 'text';
                text: string;
            }>;
        }>;
    };
}

export interface WhatsAppResponse {
    messaging_product: string;
    contacts: Array<{
        input: string;
        wa_id: string;
    }>;
    messages: Array<{
        id: string;
    }>;
}

export interface WhatsAppErrorResponse {
    error: {
        message: string;
        type: string;
        code: number;
        error_data?: {
            details: string;
        };
        fbtrace_id: string;
    };
}

export interface ConnectionStatus {
    connected: boolean;
    phoneNumber?: string;
    error?: string;
}

class WhatsAppClient {
    private client: AxiosInstance;
    private phoneNumberId: string;
    private accessToken: string;
    private apiVersion: string;

    constructor() {
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
        this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        
        if (!this.phoneNumberId || !this.accessToken) {
            throw new Error('WhatsApp credentials not configured. Run: npm run setup');
        }

        this.client = axios.create({
            baseURL: `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('✅ WhatsApp Client inicializado');
    }

    /**
     * Enviar mensaje de texto
     */
    async sendText(to: string, message: string): Promise<WhatsAppResponse> {
        try {
            const response = await this.client.post<WhatsAppResponse>('/messages', {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: this.formatPhoneNumber(to),
                type: 'text',
                text: {
                    body: message,
                    preview_url: false
                }
            });

            console.log(`✅ Mensaje enviado a ${to}`);
            return response.data;

        } catch (error: unknown) {
            const axiosError = error as AxiosError<WhatsAppErrorResponse>;
            console.error('❌ Error enviando mensaje:', axiosError.response?.data?.error?.message || (error as Error).message);
            throw error;
        }
    }

    /**
     * Enviar plantilla de mensaje
     */
    async sendTemplate(
        to: string, 
        templateName: string, 
        parameters: string[] = []
    ): Promise<WhatsAppResponse> {
        try {
            // Crear objeto template básico
            const template: { 
                name: string; 
                language: { code: string }; 
                components?: Array<{
                    type: string;
                    parameters: Array<{ type: 'text'; text: string }>;
                }> 
            } = {
            name: templateName,
            language: { code: 'es' }
        };

        // Agregar parámetros si existen
        if (parameters.length > 0) {
            template.components = [{
                type: 'body',
                parameters: parameters.map(text => ({
                    type: 'text',
                    text
                }))
            }];
        }

        const response = await this.client.post<WhatsAppResponse>('/messages', {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: this.formatPhoneNumber(to),
            type: 'template',
            template
        });

        console.log(`✅ Plantilla "${templateName}" enviada a ${to}`);
        return response.data;

    } catch (error: unknown) {
        const axiosError = error as AxiosError<WhatsAppErrorResponse>;
        console.error('❌ Error enviando plantilla:', axiosError.response?.data?.error?.message || (error as Error).message);
        throw error;
    }
}

/**
 * Verificar conexión
 */
async checkConnection(): Promise<ConnectionStatus> {
    try {
        const response = await this.client.get<{ display_phone_number: string }>('/');
        
        return {
            connected: true,
            phoneNumber: response.data.display_phone_number
        };
    } catch (error: unknown) {
        const axiosError = error as AxiosError<WhatsAppErrorResponse>;
        return {
            connected: false,
            error: axiosError.response?.data?.error?.message || (error as Error).message
        };
    }
}

    /**
     * Formatear número de teléfono
     */
    private formatPhoneNumber(phone: string): string {
        // Eliminar caracteres no numéricos
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Si tiene 10 dígitos (México), agregar código de país
        if (cleanPhone.length === 10) {
            return `52${cleanPhone}`;
        }
        
        // Si ya tiene código de país, remover el +
        if (phone.startsWith('+')) {
            return phone.substring(1);
        }
        
        return cleanPhone;
    }
}

export default WhatsAppClient;