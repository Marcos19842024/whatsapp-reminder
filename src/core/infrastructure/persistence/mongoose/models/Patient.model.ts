import mongoose, { Document, Schema } from 'mongoose';

// Interfaces para TypeScript
interface IVaccine {
    name: string;
    date: Date;
    time: string;
    location: string;
    notes?: string;
    lotNumber?: string;
    nextDoseDate?: Date;
    administered: boolean;
}

interface IInteraction {
    type: 'REMINDER_SENT' | 'CONFIRMATION' | 'RESCHEDULE' | 'INQUIRY' | 'OFFER';
    timestamp?: Date;  // Cambiar a opcional
    message?: string;
    response?: string;
    messageId?: string;
    status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';  // También hacer opcional
    metadata?: any;
}

// Y en el esquema, mantener el valor por defecto:
const interactionSchema = new Schema<IInteraction>({
    type: {
        type: String,
        enum: ['REMINDER_SENT', 'CONFIRMATION', 'RESCHEDULE', 'INQUIRY', 'OFFER'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now  // Valor por defecto en el esquema
    },
    message: String,
    response: String,
    messageId: String,
    status: {
        type: String,
        enum: ['SENT', 'DELIVERED', 'READ', 'FAILED'],
        default: 'SENT'  // Valor por defecto
    },
    metadata: Schema.Types.Mixed
}, { _id: false });

interface IConsent {
    marketing: boolean;
    reminders: boolean;
    privacy: boolean;
    givenAt: Date;
    updatedAt: Date;
}

interface IPreferences {
    language: string;
    contactTime: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY';
}

interface IPatient extends Document {
    fullName: string;
    phone: string;
    email?: string;
    petName: string;
    petType: 'DOG' | 'CAT' | 'BIRD' | 'RODENT' | 'REPTILE' | 'OTHER';
    petBreed?: string;
    petAge?: number;
    petWeight?: number;
    nextVaccine?: IVaccine;
    vaccineHistory: IVaccine[];
    consent: IConsent;
    lastInteraction?: Date;
    interactions: IInteraction[];
    preferences: IPreferences;
    createdAt: Date;
    updatedAt: Date;
  
    // Métodos
    needsReminder?(daysBefore: number): boolean;
    canReceiveOffers?(): boolean;
}

// Definir esquema para vacuna
const vaccineSchema = new Schema<IVaccine>({
    name: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    notes: String,
    lotNumber: String,
    nextDoseDate: Date,
    administered: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Definir esquema para consentimiento
const consentSchema = new Schema<IConsent>({
    marketing: {
        type: Boolean,
        default: false
    },
    reminders: {
        type: Boolean,
        default: true
    },
    privacy: {
        type: Boolean,
        default: true
    },
    givenAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

// Definir esquema para preferencias
const preferencesSchema = new Schema<IPreferences>({
    language: {
        type: String,
        default: 'es'
    },
    contactTime: {
        type: String,
        enum: ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'],
        default: 'ANY'
    }
}, { _id: false });

// Definir esquema principal del paciente
const patientSchema = new Schema<IPatient>({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    petName: {
        type: String,
        required: true,
        trim: true
    },
    petType: {
        type: String,
        enum: ['DOG', 'CAT', 'BIRD', 'RODENT', 'REPTILE', 'OTHER'],
        default: 'DOG'
    },
    petBreed: String,
    petAge: Number,
    petWeight: Number,
  
    // Próxima vacuna
    nextVaccine: vaccineSchema,
    
    // Historial de vacunas
    vaccineHistory: {
        type: [vaccineSchema],
        default: []
    },
  
    // Consentimientos
    consent: {
        type: consentSchema,
        default: () => ({
            marketing: false,
            reminders: true,
            privacy: true,
            givenAt: new Date(),
            updatedAt: new Date()
        })
    },
  
    // Interacciones
    lastInteraction: Date,
    interactions: {
        type: [interactionSchema],
        default: []
    },
  
    // Preferencias
    preferences: {
        type: preferencesSchema,
        default: () => ({
            language: 'es',
            contactTime: 'ANY'
        })
    }
}, {
    timestamps: true
});

// Índices
patientSchema.index({ phone: 1 }, { unique: true });
patientSchema.index({ 'nextVaccine.date': 1 });
patientSchema.index({ lastInteraction: 1 });

// Método para verificar si necesita recordatorio
patientSchema.methods.needsReminder = function(daysBefore: number = 3): boolean {
    if (!this.nextVaccine || !this.consent.reminders) {
        return false;
    }

    const today = new Date();
    const vaccineDate = new Date(this.nextVaccine.date);
    const diffDays = Math.ceil((vaccineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return diffDays <= daysBefore && diffDays >= 0;
};

// Método para verificar si puede recibir ofertas
patientSchema.methods.canReceiveOffers = function(): boolean {
    if (!this.consent.marketing) {
        return false;
    }

    // Verificar ventana de 24 horas
    if (!this.lastInteraction) {
        return false;
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.lastInteraction >= twentyFourHoursAgo;
};

const Patient = mongoose.model<IPatient>('Patient', patientSchema);

export default Patient;
export type { IPatient, IVaccine, IInteraction, IConsent, IPreferences };