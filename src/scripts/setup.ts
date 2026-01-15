#!/usr/bin/env ts-node
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function setup(): Promise<void> {
    console.log('='.repeat(50));
    console.log('🔄 CONFIGURACIÓN DEL SISTEMA');
    console.log('='.repeat(50));
    
    console.log('\n📋 PASO 1: Información de la Clínica\n');
    
    const clinicName = await askQuestion('Nombre de tu clínica/veterinaria: ');
    const clinicPhone = await askQuestion('Teléfono de contacto (ej: +5215512345678): ');
    const clinicAddress = await askQuestion('Dirección: ');
    
    console.log('\n📋 PASO 2: Credenciales de WhatsApp\n');
    console.log('Para obtener estas credenciales:');
    console.log('1. Ve a: https://developers.facebook.com/apps/');
    console.log('2. Crea una app de tipo "Business"');
    console.log('3. Agrega "WhatsApp" como producto');
    console.log('4. Configura tu número de teléfono\n');
    
    const accessToken = await askQuestion('Access Token: ');
    const phoneNumberId = await askQuestion('Phone Number ID: ');
    const businessAccountId = await askQuestion('Business Account ID: ');
  
    // Crear contenido del archivo .env
    const envContent = `# SERVER
        NODE_ENV=development
        PORT=3001
        HOST=0.0.0.0

        # DATABASE
        MONGODB_URI=mongodb://localhost:27017/whatsapp-reminder

        # WHATSAPP
        WHATSAPP_ACCESS_TOKEN=${accessToken}
        WHATSAPP_PHONE_NUMBER_ID=${phoneNumberId}
        WHATSAPP_BUSINESS_ACCOUNT_ID=${businessAccountId}
        WHATSAPP_API_VERSION=v18.0

        # APPLICATION
        CLINIC_NAME=${clinicName}
        CLINIC_PHONE=${clinicPhone}
        CLINIC_ADDRESS=${clinicAddress}

        # SECURITY
        JWT_SECRET=${crypto.randomBytes(32).toString('hex')}

        # WEBHOOK
        WEBHOOK_VERIFY_TOKEN=whatsapp-reminder
    `;
  
    // Guardar archivo .env
    const envPath = path.join(process.cwd(), '.env');
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Archivo .env creado en:', envPath);
  
    // Crear archivo .env.example
    const exampleContent = `# SERVER
        NODE_ENV=development
        PORT=3001
        HOST=0.0.0.0

        # DATABASE
        MONGODB_URI=mongodb://localhost:27017/whatsapp-reminder

        # WHATSAPP
        WHATSAPP_ACCESS_TOKEN=your_access_token_here
        WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
        WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here
        WHATSAPP_API_VERSION=v18.0

        # APPLICATION
        CLINIC_NAME=Mi Clínica Veterinaria
        CLINIC_PHONE=+5215512345678
        CLINIC_ADDRESS=Av. Principal 123, Ciudad

        # SECURITY
        JWT_SECRET=your_jwt_secret_here

        # WEBHOOK
        WEBHOOK_VERIFY_TOKEN=whatsapp-reminder
    `;
  
    const examplePath = path.join(process.cwd(), '.env.example');
    fs.writeFileSync(examplePath, exampleContent);
    
    console.log('✅ Archivo .env.example creado');
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ CONFIGURACIÓN COMPLETADA');
    console.log('='.repeat(50));
    
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('1. Instalar dependencias: npm install');
    console.log('2. Crear plantillas: npm run create-templates');
    console.log('3. Iniciar servidor: npm run dev');
    
    console.log('\n📋 TUS DATOS:');
    console.log(`🏥 Clínica: ${clinicName}`);
    console.log(`📱 WhatsApp ID: ${phoneNumberId}`);
    console.log(`📡 Servidor: http://localhost:3001`);
    
    rl.close();
}

// Ejecutar setup
if (require.main === module) {
    setup().catch((error: Error) => {
        console.error('❌ Error en setup:', error.message);
        process.exit(1);
    });
}