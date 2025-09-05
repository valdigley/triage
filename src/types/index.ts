export interface SessionType {
  id: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  total_spent?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Appointment {
  id: string;
  client_id?: string;
  session_type: string;
  session_details?: any;
  scheduled_date: string;
  total_amount: number;
  minimum_photos?: number;
  status?: string;
  payment_id?: string;
  payment_status?: string;
  terms_accepted?: boolean;
  created_at?: string;
  updated_at?: string;
  client?: Client;
}

export interface Payment {
  id: string;
  appointment_id?: string;
  mercadopago_id?: string;
  amount: number;
  status?: string;
  payment_type?: string;
  webhook_data?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Settings {
  id: string;
  price_commercial_hour?: number;
  price_after_hours?: number;
  minimum_photos?: number;
  delivery_days?: number;
  link_validity_days?: number;
  cleanup_days?: number;
  commercial_hours?: any;
  terms_conditions?: string;
  studio_phone?: string;
  studio_address?: string;
  studio_maps_url?: string;
  studio_name?: string;
  studio_logo_url?: string;
  watermark_enabled?: boolean;
  watermark_text?: string;
  watermark_opacity?: number;
  watermark_position?: string;
  watermark_size?: string;
  watermark_image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Gallery {
  id: string;
  name: string;
  client_name: string;
  description?: string;
  cover_photo_id?: string;
  created_date?: string;
  expiration_date?: string;
  password?: string;
  access_count?: number;
  download_count?: number;
  is_active?: boolean;
  settings?: any;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Photo {
  id: string;
  gallery_id?: string;
  url: string;
  thumbnail: string;
  filename: string;
  size: number;
  upload_date?: string;
  r2_key?: string;
  metadata?: any;
  created_at?: string;
}

export interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  instance_data: {
    evolution_api_url?: string;
    evolution_api_key?: string;
  };
  last_updated?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationTemplate {
  id: string;
  type: string;
  name: string;
  message_template: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationQueue {
  id: string;
  appointment_id?: string;
  template_type: string;
  recipient_phone: string;
  recipient_name: string;
  message: string;
  scheduled_for: string;
  sent_at?: string;
  status?: string;
  error_message?: string;
  created_at?: string;
}

export interface GalleryTriage {
  id: string;
  appointment_id?: string;
  name: string;
  gallery_token?: string;
  password?: string;
  status?: string;
  photos_uploaded?: number;
  photos_selected?: string[];
  selection_completed?: boolean;
  selection_submitted_at?: string;
  link_expires_at: string;
  watermark_settings?: any;
  created_at?: string;
  updated_at?: string;
}

export interface PhotoTriage {
  id: string;
  gallery_id?: string;
  filename: string;
  url: string;
  thumbnail: string;
  size: number;
  is_selected?: boolean;
  metadata?: any;
  upload_date?: string;
  created_at?: string;
}

export interface MercadoPagoSettings {
  id: string;
  access_token?: string;
  public_key?: string;
  webhook_url?: string;
  environment?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}