export async function scheduleNotifications(appointmentId: string, supabase: any) {
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

    // Format currency
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount);
    };

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
      gallery_link: '', // Will be filled when gallery is created
      price_per_photo: formatCurrency(settings.price_commercial_hour || 30)
    };

    // Schedule reminder 1 day before
    const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > new Date()) {
      const reminderMessage = await processTemplate(supabase, 'reminder_1_day_before', variables);
      await supabase
        .from('notification_queue')
        .insert({
          appointment_id: appointmentId,
          template_type: 'reminder_1_day_before',
          recipient_phone: clientPhone,
          recipient_name: clientName,
          message: reminderMessage,
          scheduled_for: oneDayBefore.toISOString()
        });
    }

    // Schedule reminder 2 hours before session
    const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 60 * 60 * 1000);
    if (twoHoursBefore > new Date()) {
      const sessionMessage = await processTemplate(supabase, 'reminder_day_of_session', variables);
      await supabase
        .from('notification_queue')
        .insert({
          appointment_id: appointmentId,
          template_type: 'reminder_day_of_session',
          recipient_phone: clientPhone,
          recipient_name: clientName,
          message: sessionMessage,
          scheduled_for: twoHoursBefore.toISOString()
        });
    }

    return true;
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return false;
  }
}

async function processTemplate(supabase: any, templateType: string, variables: Record<string, string>): Promise<string> {
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