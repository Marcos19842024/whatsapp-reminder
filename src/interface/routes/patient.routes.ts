import express from 'express';
import WhatsAppClient from '../../core/infrastructure/external/whatsapp/WhatsAppClient';
import Patient, { IInteraction } from '../../core/infrastructure/persistence/mongoose/models/Patient.model';

const router = express.Router();

// Inicializar cliente de WhatsApp (solo cuando sea necesario)
let whatsappClient: WhatsAppClient;

// Middleware para inicializar WhatsAppClient
const initWhatsApp = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        if (!whatsappClient) {
            whatsappClient = new WhatsAppClient();
        }
        next();
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: 'Error inicializando WhatsApp: ' + (error as Error).message
        });
    }
};

// Crear nuevo paciente
router.post('/', async (req, res) => {
    try {
        const { fullName, phone, petName, petType, email, petBreed, petAge, petWeight } = req.body;
        
        // Validar datos básicos
        if (!fullName || !phone || !petName || !petType) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: fullName, phone, petName, petType'
            });
        }
    
        // Crear paciente
        const patient = new Patient({
            fullName,
            phone,
            email,
            petName,
            petType,
            petBreed,
            petAge,
            petWeight
        });
    
        await patient.save();
    
        // Enviar mensaje de bienvenida
        try {
            if (!whatsappClient) {
                whatsappClient = new WhatsAppClient();
            }
            
            await whatsappClient.sendText(
                phone,
                `¡Hola ${fullName}! 👋\n\nGracias por registrar a ${petName} en nuestro sistema.\n\nRecibirás recordatorios de vacunas y ofertas especiales.\n\n🏥 ${process.env.CLINIC_NAME || 'Nuestra Clínica'}`
            );
        } catch (whatsappError: unknown) {
            const error = whatsappError as Error;
            console.warn('⚠️ No se pudo enviar mensaje de bienvenida:', error.message);
        }

        return res.status(201).json({
            success: true,
            message: 'Paciente creado exitosamente',
            data: {
                id: patient._id,
                fullName: patient.fullName,
                phone: patient.phone,
                petName: patient.petName
            }
        });
    
    } catch (error: any) {
        console.error('❌ Error creando paciente:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe un paciente con este número de teléfono'
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Error al crear paciente: ' + (error as Error).message
        });
    }
});

// Programar vacuna
router.post('/:id/vaccine', async (req, res) => {
  try {
        const { id } = req.params;
        const { name, date, time, location, notes, lotNumber } = req.body;
        
        // Validar datos
        if (!name || !date || !time || !location) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: name, date, time, location'
            });
        }
    
        const patient = await Patient.findById(id);
    
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Paciente no encontrado'
            });
        }
        
        // Programar vacuna
        patient.nextVaccine = {
            name,
            date: new Date(date),
            time,
            location,
            notes,
            lotNumber,
            administered: false
        };
    
        await patient.save();
        
        return res.json({
            success: true,
            message: 'Vacuna programada exitosamente',
            data: {
                vaccine: patient.nextVaccine,
                patientName: patient.fullName,
                petName: patient.petName
            }
        });
        
    } catch (error: any) {
        console.error('❌ Error programando vacuna:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al programar vacuna: ' + (error as Error).message
        });
    }
});

// Enviar recordatorio manual
router.post('/:id/reminder', initWhatsApp, async (req, res) => {
    try {
        const { id } = req.params;
        
        const patient = await Patient.findById(id);
        
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Paciente no encontrado'
            });
        }
        
        if (!patient.nextVaccine) {
            return res.status(400).json({
                success: false,
                error: 'El paciente no tiene vacuna programada'
            });
        }
    
        // Verificar consentimiento (con valor por defecto si no existe)
        const consent = patient.consent || { reminders: true };
        if (!consent.reminders) {
            return res.status(400).json({
                success: false,
                error: 'El paciente no ha dado consentimiento para recordatorios'
            });
        }
        
        // Enviar recordatorio
        const vaccineDate = new Date(patient.nextVaccine.date);
        const formattedDate = vaccineDate.toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    
        const response = await whatsappClient.sendTemplate(
        patient.phone,
        'recordatorio_vacuna',
            [
                patient.fullName,
                patient.petName,
                patient.nextVaccine.name,
                formattedDate,
                patient.nextVaccine.time,
                patient.nextVaccine.location,
                process.env.CLINIC_NAME || 'Nuestra Clínica'
            ]
        );
    
        // Crear interacción completa con timestamp
        const newInteraction: IInteraction = {
            type: 'REMINDER_SENT',
            timestamp: new Date(),
            message: `Recordatorio de vacuna: ${patient.nextVaccine.name}`,
            status: 'SENT',
            messageId: response.messages[0]?.id
        };
    
        // Registrar interacción
        const interactions = patient.interactions || [];
        interactions.push(newInteraction);
        
        patient.interactions = interactions;
        patient.lastInteraction = new Date();
        await patient.save();
        
        return res.json({
            success: true,
            message: 'Recordatorio enviado exitosamente',
            data: {
                messageId: response.messages[0]?.id,
                patientName: patient.fullName,
                vaccineName: patient.nextVaccine.name
            }
        });
        
    } catch (error: any) {
        console.error('❌ Error enviando recordatorio:', error);
        
        const axiosError = error as any;
        return res.status(500).json({
            success: false,
            error: axiosError.response?.data?.error?.message || (error as Error).message
        });
    }
});

// Listar pacientes
router.get('/', async (req, res) => {
    try {
        const patients = await Patient.find()
        .select('fullName phone petName petType nextVaccine lastInteraction createdAt')
        .sort({ createdAt: -1 })
        .limit(100);
        
        return res.json({
            success: true,
            count: patients.length,
            data: patients
        });
        
    } catch (error: unknown) {
        console.error('❌ Error obteniendo pacientes:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al obtener pacientes: ' + (error as Error).message
        });
    }
});

// Obtener paciente específico
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const patient = await Patient.findById(id);
        
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Paciente no encontrado'
            });
        }
        
        return res.json({
            success: true,
            data: patient
        });
        
    } catch (error: unknown) {
        console.error('❌ Error obteniendo paciente:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al obtener paciente: ' + (error as Error).message
        });
    }
});

// Actualizar consentimiento
router.put('/:id/consent', async (req, res) => {
    try {
        const { id } = req.params;
        const { marketing, reminders, privacy } = req.body;
        
        const patient = await Patient.findById(id);
        
        if (!patient) {
            return res.status(404).json({
                success: false,
                error: 'Paciente no encontrado'
            });
        }
        
        // Actualizar consentimiento
        const currentConsent = patient.consent || {
            marketing: false,
            reminders: true,
            privacy: true,
            givenAt: new Date(),
            updatedAt: new Date()
        };
        
        patient.consent = {
            marketing: marketing !== undefined ? marketing : currentConsent.marketing,
            reminders: reminders !== undefined ? reminders : currentConsent.reminders,
            privacy: privacy !== undefined ? privacy : currentConsent.privacy,
            givenAt: currentConsent.givenAt,
            updatedAt: new Date()
        };
        
        await patient.save();
        
        return res.json({
            success: true,
            message: 'Consentimiento actualizado',
            data: {
                consent: patient.consent
            }
        });
        
    } catch (error: unknown) {
        console.error('❌ Error actualizando consentimiento:', error);
        return res.status(500).json({
            success: false,
            error: 'Error al actualizar consentimiento: ' + (error as Error).message
        });
    }
});

export default router;