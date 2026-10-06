// Formas de los datos tal y como vienen de la base de datos.

export type Rol = "admin" | "profesional";
export type EstadoCita = "pendiente" | "confirmada" | "cancelada" | "no_presentada" | "completada";
export type OrigenCita = "panel" | "web" | "asistente" | "importacion";

export interface Clinica {
  id: string;
  nombre: string;
  slug: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  zona_horaria: string;
  activa: boolean;
  es_demo: boolean;
  whatsapp_phone_number_id: string | null;
  whatsapp_numero_visible: string | null;
  tono_asistente: string;
  instrucciones_extra_asistente: string | null;
  url_politica_privacidad: string | null;
  intervalo_huecos_min: number;
  antelacion_minima_reserva_min: number;
  horas_minimas_cancelacion: number;
  created_at: string;
}

export interface Profesional {
  id: string;
  clinica_id: string;
  nombre: string;
  color: string;
  activa: boolean;
  orden: number;
}

export interface Cabina {
  id: string;
  clinica_id: string;
  nombre: string;
  activa: boolean;
}

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

export interface Tratamiento {
  id: string;
  clinica_id: string;
  nombre: string;
  descripcion: string | null;
  duracion_min: number;
  precio: number | null;
  precio_desde: boolean;
  preparacion: string | null;
  cuidados_posteriores: string | null;
  sesiones_recomendadas: number | null;
  contraindicaciones: string | null;
  preguntas_frecuentes: PreguntaFrecuente[];
  activo: boolean;
  reservable_online: boolean;
  orden: number;
}

export interface Tramo {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface Cierre {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
}

export interface Ausencia {
  id: string;
  profesional_id: string;
  inicio: string;
  fin: string;
  motivo: string | null;
}

export interface Clienta {
  id: string;
  clinica_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  notas_asistente: string | null;
  consentimiento_privacidad_at: string | null;
  consentimiento_via: string | null;
  origen: string;
  contacto_principal_id: string | null;
  anonimizada_at: string | null;
  created_at: string;
}

export interface Cita {
  id: string;
  clinica_id: string;
  clienta_id: string;
  tratamiento_id: string;
  profesional_id: string;
  cabina_id: string | null;
  inicio: string;
  fin: string;
  estado: EstadoCita;
  origen: OrigenCita;
  notas: string | null;
  cancelada_por: string | null;
  created_at: string;
}

export const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  no_presentada: "No presentada",
  completada: "Completada",
};

export const NOMBRE_ORIGEN: Record<OrigenCita, string> = {
  panel: "Panel",
  web: "Web",
  asistente: "Asistente",
  importacion: "Importación",
};
