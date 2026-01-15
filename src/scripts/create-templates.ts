#!/usr/bin/env ts-node
import * as dotenv from 'dotenv';
import axios, { AxiosError } from 'axios';

dotenv.config();

interface TemplateComponent {
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{
        type: string;
        text: string;
    }>;
    parameters?: Array<{
        type: string;
        text: string;
    }>;
}

interface Template {
    name: string;
    category: string;
    language: string;
    components: TemplateComponent[];
}

interface ApiError {
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

async function createTemplates(): Promise<void> {
    console.log('📝 CREANDO PLANTILLAS DE WHATSAPP\n');
    
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    
    if (!accessToken || !businessAccountId) {
        console.error('❌ Credenciales no configuradas. Ejecuta: npm run setup');
        process.exit(1);
    }
  
    const templates: Template[] = [
        {
            name: 'recordatorio_vacuna',
            category: 'UTILITY',
            language: 'es',
            components: [
                {
                    type: 'BODY',
                    text: `Hola {{1}},

                    Le recordamos que {{2}} tiene programada la vacuna "{{3}}" para el {{4}}.

                    📅 Fecha: {{4}}
                    🕒 Hora: {{5}}
                    📍 Lugar: {{6}}

                    Por favor confirme su asistencia.`
                }
            ]
        },
        {
            name: 'confirmacion_cita',
            category: 'UTILITY', 
            language: 'es',
            components: [
                {
                    type: 'BODY',
                    text: `✅ Confirmación de Cita

                    Hola {{1}},

                    Su cita ha sido {{2}} exitosamente.

                    📅 Fecha: {{3}}
                    🕒 Hora: {{4}}
                    📍 Lugar: {{5}}

                    Gracias por confiar en nosotros. 🐾`
                }
            ]
        }
    ];
  
    console.log('Creando 2 plantillas esenciales...\n');
    
    let createdCount = 0;
    let errorCount = 0;
  
    for (const template of templates) {
        try {
            const response = await axios.post(
                `https://graph.facebook.com/v18.0/${businessAccountId}/message_templates`,
                template,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        
            console.log(`✅ Plantilla "${template.name}" creada`);
            console.log(`   Categoría: ${template.category}`);
            console.log(`   ID: ${response.data.id}\n`);
            createdCount++;
        
        } catch (error: unknown) {
            const axiosError = error as AxiosError<ApiError>;
        
            if (axiosError.response?.data?.error?.code === 100) {
                console.log(`⚠️  Plantilla "${template.name}" ya existe\n`);
            } else {
                console.error(`❌ Error creando plantilla "${template.name}":`);
                console.error(`   ${axiosError.response?.data?.error?.message || (error as Error).message}\n`);
                errorCount++;
            }
        }
        
        // Esperar entre solicitudes
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  
    console.log('='.repeat(50));
    console.log('📊 RESULTADOS:');
    console.log(`✅ Creadas: ${createdCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log('='.repeat(50));
  
    if (errorCount === 0) {
        console.log('\n🎉 ¡Plantillas creadas exitosamente!');
        console.log('\n⚠️  IMPORTANTE:');
        console.log('Las plantillas deben ser aprobadas por WhatsApp.');
        console.log('Esto puede tomar de 24 a 72 horas.');
        console.log('\nPuedes ver el estado en:');
        console.log('https://developers.facebook.com/apps/');
    }
}

// Ejecutar
if (require.main === module) {
    createTemplates().catch((error: Error) => {
        console.error('❌ Error fatal:', error.message);
        process.exit(1);
    });
}