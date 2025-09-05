import { supabase } from '../lib/supabase';
import { formatCurrency } from './pricing';

export async function scheduleNotifications(appointmentId: string) {
  try {
    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      throw new Error('Appointment not found');
    }

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('delivery_days, studio_address, studio_maps_url, price_commercial_hour')
      .single();

    if (!settings) {
      throw new Error('Settings not found');
    }

    // Get session type details
    const { data: sessionType } = await supabase
      .from('session_types')
      .select('*')
      .eq('name', appointment.session_type)
      .single();

    const appointmentDate = new Date(appointment.scheduled_date);
    const clientName = appointment.client?.name || 'Cliente';
    const clientPhone = appointment.client?.phone || '';

    // Common variables for all templates
    const variables = {
      client_name: clientName,
      amount: formatCurrency(appointment.total_amount),
      session_type: sessionType?.label || appointment.session_type,
      appointment_date: appointmentDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      appointment_time: appointmentDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      studio_address: settings.studio_address || '',
      studio_maps_url: settings.studio_maps_url || '',
      delivery_days: (settings.delivery_days || 7).toString(),
      gallery_link: '' // Will be filled when gallery is created
    };

    // Schedule reminder 1 day before
    const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
    await supabase
      .from('notification_queue')
      .insert({
        appointment_id: appointmentId,
        template_type: 'reminder_1_day_before',
        recipient_phone: clientPhone,
        recipient_name: clientName,
        message: await processTemplate('reminder_1_day_before', variables),
        scheduled_for: oneDayBefore.toISOString()
      });

    // Schedule reminder 2 hours before session
    const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 60 * 60 * 1000);
    await supabase
      .from('notification_queue')
      .insert({
        appointment_id: appointmentId,
        template_type: 'reminder_day_of_session',
        recipient_phone: clientPhone,
        recipient_name: clientName,
        message: await processTemplate('reminder_day_of_session', variables),
        scheduled_for: twoHoursBefore.toISOString()
      });

    return true;
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return false;
  }
}

export async function scheduleGalleryNotifications(galleryId: string, galleryToken: string) {
  try {
    // Get gallery with appointment details from galleries_triage
    const { data: gallery, error: galleryError } = await supabase
      .from('galleries_triage')
      .select(`
        *,
        appointment:appointments(
          *,
          client:clients(*)
        )
      `)
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      throw new Error('Gallery not found');
    }

    const appointment = gallery.appointment;
    if (!appointment) {
      throw new Error('Appointment not found for gallery');
    }

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (!settings) {
      throw new Error('Settings not found');
    }

    // Get session type details
    const { data: sessionType } = await supabase
      .from('session_types')
      .select('*')
      .eq('name', appointment.session_type)
      .single();

    const clientName = appointment.client?.name || 'Cliente';
    const clientPhone = appointment.client?.phone || '';
    const galleryLink = `${window.location.origin}/gallery/${galleryToken}`;

    // Format currency
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount);
    };

    const appointmentDate = new Date(appointment.scheduled_date);

    const variables = {
      client_name: clientName,
      gallery_link: galleryLink,
      delivery_days: settings.delivery_days.toString(),
      amount: formatCurrency(appointment.total_amount),
      session_type: sessionType?.label || appointment.session_type,
      appointment_date: appointmentDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      appointment_time: appointmentDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      studio_address: settings.studio_address || '',
      studio_maps_url: settings.studio_maps_url || '',
      price_per_photo: formatCurrency(settings.price_commercial_hour || 30),
      minimum_photos: (appointment.minimum_photos || 5).toString()
    };

    // Schedule gallery ready notification (immediate)
    await supabase
      .from('notification_queue')
      .insert({
        appointment_id: appointment.id,
        template_type: 'gallery_ready',
        recipient_phone: clientPhone,
        recipient_name: clientName,
        message: await processTemplate('gallery_ready', variables),
        scheduled_for: new Date().toISOString()
      });

    // Schedule selection reminder (6 days after gallery creation)
    const selectionReminder = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    await supabase
      .from('notification_queue')
      .insert({
        appointment_id: appointment.id,
        template_type: 'selection_reminder',
        recipient_phone: clientPhone,
        recipient_name: clientName,
        message: await processTemplate('selection_reminder', variables),
        scheduled_for: selectionReminder.toISOString()
      });

    return true;
  } catch (error) {
    console.error('Error scheduling gallery notifications:', error);
    return false;
  }
}

export async function scheduleSelectionConfirmation(appointmentId: string) {
  try {
    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      throw new Error('Appointment not found');
    }

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (!settings) {
      throw new Error('Settings not found');
    }

    // Get session type details
    const { data: sessionType } = await supabase
      .from('session_types')
      .select('*')
      .eq('name', appointment.session_type)
      .single();

    const clientName = appointment.client?.name || 'Cliente';
    const clientPhone = appointment.client?.phone || '';

    // Format currency
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount);
    };

    const appointmentDate = new Date(appointment.scheduled_date);

    const variables = {
      client_name: clientName,
      delivery_days: settings.delivery_days.toString(),
      amount: formatCurrency(appointment.total_amount),
      session_type: sessionType?.label || appointment.session_type,
      appointment_date: appointmentDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      appointment_time: appointmentDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      studio_address: settings.studio_address || '',
      studio_maps_url: settings.studio_maps_url || '',
      price_per_photo: formatCurrency(settings.price_commercial_hour || 30),
      minimum_photos: (appointment.minimum_photos || 5).toString()
    };

    // Schedule selection received notification (immediate)
    await supabase
      .from('notification_queue')
      .insert({
        appointment_id: appointmentId,
        template_type: 'selection_received',
        recipient_phone: clientPhone,
        recipient_name: clientName,
        message: await processTemplate('selection_received', variables),
        scheduled_for: new Date().toISOString()
      });

    // Schedule delivery reminder (delivery_days - 1 from now)
    const deliveryReminder = new Date(Date.now() + (settings.delivery_days - 1) * 24 * 60 * 60 * 1000);
    await supabase
      .from('notification_queue')
      .insert({
        appointment_id: appointmentId,
        template_type: 'delivery_reminder',
        recipient_phone: clientPhone,
        recipient_name: clientName,
        message: await processTemplate('delivery_reminder', variables),
        scheduled_for: deliveryReminder.toISOString()
      });

    return true;
  } catch (error) {
    console.error('Error scheduling selection confirmation:', error);
    return false;
  }
}

async function processTemplate(templateType: string, variables: Record<string, string>): Promise<string> {
  try {
    const { data: template } = await supabase
      .from('notification_templates')
      .select('message_template')
      .eq('type', templateType)
      .eq('is_active', true)
      .single();

    if (!template) {
      throw new Error(`Template ${templateType} not found`);
    }

    let message = template.message_template;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return message;
  } catch (error) {
    console.error('Error processing template:', error);
    return `Erro ao processar template ${templateType}`;
  }
}