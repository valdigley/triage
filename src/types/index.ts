export interface Settings {
  id: string;
  studio_name: string;
  studio_logo_url?: string;
  studio_phone?: string;
  studio_address?: string;
  studio_maps_url?: string;
  app_url?: string;
  evolution_api_instance?: string;
  price_commercial_hour: number;
  price_after_hours: number;
  minimum_photos: number;
  delivery_days: number;
  link_validity_days: number;
  cleanup_days: number;
  commercial_hours: CommercialHours;
  terms_conditions: string;
  watermark_enabled: boolean;
  watermark_text: string;
  watermark_opacity: number;
  watermark_position: string;
  watermark_size: string;
  watermark_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionTypeData {
  id: string;
  name: string;
  label: string;
  description?: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MercadoPagoSettings {
  id: string;
  access_token?: string;
  public_key?: string;
  webhook_url?: string;
  environment: 'sandbox' | 'production';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommercialHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  start: string;
  end: string;
  enabled: boolean;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export type SessionType = 'aniversario' | 'gestante' | 'formatura' | 'comercial' | 'pre_wedding' | 'tematico';

export interface SessionDetails {
  // Aniversário
  birthday_date?: string;
  
  // Gestante
  due_date?: string;
  baby_name?: string;
  
  // Formatura
  course?: string;
  sash_color?: string;
  
  // Comercial
  product_service?: string;
  purpose?: string;
  
  // Pré-wedding
  wedding_date?: string;
  desired_style?: string;
  
  // Temático
  theme?: string;
  occasion?: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Appointment {
  id: string;
  client_id: string;
  session_type: SessionType;
  session_details: SessionDetails;
  scheduled_date: string;
  total_amount: number;
  minimum_photos: number;
  status: AppointmentStatus;
  payment_id?: string;
  payment_status: PaymentStatus;
  terms_accepted: boolean;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export type GalleryStatus = 'active' | 'completed' | 'expired';
export type PhotoGalleryStatus = 'pending' | 'started' | 'completed';

export interface Gallery {
  id: string;
  appointment_id: string;
  name: string;
  gallery_token: string;
  password?: string;
  status: PhotoGalleryStatus;
  photos_uploaded: number;
  photos_selected: string[];
  selection_completed: boolean;
  selection_submitted_at?: string;
  link_expires_at: string;
  watermark_settings: {
    enabled: boolean;
    text: string;
    opacity: number;
    position: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  gallery_id: string;
  filename: string;
  url: string;
  thumbnail: string;
  size: number;
  is_selected?: boolean;
  metadata: any;
  upload_date?: string;
  created_at: string;
}

export type PaymentType = 'initial' | 'extra_photos';

export interface Payment {
  id: string;
  appointment_id: string;
  mercadopago_id?: string;
  amount: number;
  status: PaymentStatus;
  payment_type: PaymentType;
  webhook_data?: any;
  created_at: string;
  updated_at: string;
}

export interface BookingFormData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  sessionType: SessionType;
  scheduledDate: string;
  sessionDetails: SessionDetails;
  termsAccepted: boolean;
}

export interface NotificationTemplate {
  id: string;
  type: string;
  name: string;
  message_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationQueue {
  id: string;
  appointment_id: string;
  template_type: string;
  recipient_phone: string;
  recipient_name: string;
  message: string;
  scheduled_for: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
  created_at: string;
}