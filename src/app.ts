import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import patientRoutes from './interface/routes/patient.routes';

// Configuración
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-reminder';

// Crear aplicación Express
const app = express();
const httpServer = createServer(app);

// Configurar WebSocket
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas básicas
app.get('/', (req, res) => {
  res.json({
    message: 'WhatApp Reminder System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      patients: '/api/patients',
      health: '/health',
      whatsapp_test: '/api/whatsapp/test'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Ruta de prueba de WhatsApp
app.get('/api/whatsapp/test', async (req, res) => {
  try {
    // Importación dinámica para evitar problemas de inicialización
    const WhatsAppClient = (await import('./core/infrastructure/external/whatsapp/WhatsAppClient')).default;
    const client = new WhatsAppClient();
    const status = await client.checkConnection();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Rutas de pacientes
app.use('/api/patients', patientRoutes);

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Configurar WebSocket
io.on('connection', (socket) => {
  console.log('🔌 Cliente WebSocket conectado:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Cliente WebSocket desconectado:', socket.id);
  });
});

// Función para conectar a MongoDB
async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', (error as Error).message);
    process.exit(1);
  }
}

// Función para verificar configuración
function validateEnvironment(): void {
  const requiredEnvVars = [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_BUSINESS_ACCOUNT_ID'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Variables de entorno faltantes:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n🔧 Solución:');
    console.error('   1. Ejecuta: npm run setup');
    console.error('   2. O copia .env.example a .env y completa los valores');
    process.exit(1);
  }

  console.log('✅ Variables de entorno verificadas');
}

// Iniciar servidor
async function startServer(): Promise<void> {
  try {
    // Verificar configuración
    validateEnvironment();
    
    // Conectar a base de datos
    await connectToDatabase();
    
    // Iniciar servidor HTTP
    httpServer.listen(PORT, HOST, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 whatsapp-reminder System');
      console.log('='.repeat(50));
      console.log(`📡 Servidor corriendo en:`);
      console.log(`   🔗 http://${HOST}:${PORT}`);
      console.log(`   🌐 http://localhost:${PORT}`);
      console.log('='.repeat(50));
      console.log('\n📝 Endpoints disponibles:');
      console.log('   👥 /api/patients        - Gestión de pacientes');
      console.log('   🩺 /health             - Estado del sistema');
      console.log('   📱 /api/whatsapp/test  - Probar WhatsApp');
      console.log('\n🚀 Próximos pasos:');
      console.log('1. Crear plantillas: npm run create-templates');
      console.log('2. Probar con POST /api/patients');
      console.log('3. Programar vacuna con POST /api/patients/{id}/vaccine');
      console.log('4. Enviar recordatorio con POST /api/patients/{id}/reminder');
    });
    
  } catch (error) {
    console.error('❌ Error iniciando servidor:', (error as Error).message);
    process.exit(1);
  }
}

// Manejar señales de terminación
process.on('SIGINT', async () => {
  console.log('\n🛑 Recibida señal SIGINT, cerrando servidor...');
  await mongoose.disconnect();
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recibida señal SIGTERM, cerrando servidor...');
  await mongoose.disconnect();
  httpServer.close();
  process.exit(0);
});

// Iniciar la aplicación
startServer();

export { app, io };