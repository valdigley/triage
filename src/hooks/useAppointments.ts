import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Appointment, BookingFormData } from '../types';
import { isDateTimeAvailable } from '../utils/pricing';
import { useNotifications } from './useNotifications';
import { useTenant } from './useTenant';

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { scheduleAllAppointmentNotifications } = useNotifications();
  const { tenant, loading: tenantLoading } = useTenant();

  useEffect(() => {
    if (tenantLoading) return;

    if (tenant) {
      fetchAppointments();
    } else {
      setLoading(false);
    }
  }, [tenant, tenantLoading]);

  const fetchAppointments = async () => {
    if (!tenant) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('tenant_id', tenant.id)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setError(error instanceof Error ? error.message : 'Falha ao buscar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const createGoogleCalendarEvent = async (
    appointment: any,
    formData: BookingFormData
  ): Promise<void> => {
    try {
      // Calcular horário de término (padrão: 2 horas após o início)
      const startDate = new Date(appointment.scheduled_date);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-calendar-event`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointmentId: appointment.id,
            summary: `Sessão de Fotos - ${formData.clientName}`,
            description: `Tipo: ${formData.sessionType}\nDetalhes: ${formData.sessionDetails}\nCliente: ${formData.clientName}\nTelefone: ${formData.clientPhone}\nEmail: ${formData.clientEmail}`,
            startDateTime: startDate.toISOString(),
            endDateTime: endDate.toISOString(),
            attendees: formData.clientEmail ? [formData.clientEmail] : [],
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Evento criado no Google Calendar:', result.eventLink);
      } else {
        const error = await response.json();
        console.error('❌ Erro ao criar evento:', error);
      }
    } catch (error) {
      console.error('❌ Erro ao chamar API de criação de evento:', error);
      throw error;
    }
  };

  const checkGoogleCalendarAvailability = async (
    startDateTime: string,
    endDateTime: string
  ): Promise<{ available: boolean; message: string; conflictingEvents?: any[] }> => {
    try {
      console.log('🔍 Verificando disponibilidade no Google Calendar...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-calendar-availability`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDateTime,
            endDateTime,
          }),
        }
      );

      if (!response.ok) {
        console.error('❌ Erro ao verificar disponibilidade:', response.status);
        return {
          available: true, // Fallback: permitir em caso de erro
          message: 'Não foi possível verificar o calendário Google. Prosseguindo...',
        };
      }

      const result = await response.json();

      if (result.success) {
        console.log(result.available ? '✅ Horário disponível' : '⚠️ Horário ocupado');
        return {
          available: result.available,
          message: result.message,
          conflictingEvents: result.conflictingEvents,
        };
      }

      // Se não teve sucesso mas retornou available=true (fallback)
      return {
        available: result.available ?? true,
        message: result.error || 'Erro ao verificar disponibilidade',
      };
    } catch (error) {
      console.error('❌ Erro ao chamar API de disponibilidade:', error);
      return {
        available: true, // Fallback: permitir em caso de erro
        message: 'Erro ao verificar calendário. Prosseguindo com agendamento.',
      };
    }
  };

  const createAppointment = async (formData: BookingFormData, totalAmount: number) => {
    if (!tenant) throw new Error('Tenant não encontrado');

    try {
      // Get settings for minimum_photos
      const { data: settings } = await supabase
        .from('settings')
        .select('minimum_photos')
        .eq('tenant_id', tenant.id)
        .single();

      const minimumPhotos = settings?.minimum_photos || 5;

      // First, create or get client
      let existingClient = null;

      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('phone', formData.clientPhone)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        existingClient = data;
      } catch (error: any) {
        if (error.code !== 'PGRST116') {
          throw error;
        }
        // PGRST116 means no client found, which is expected
        existingClient = null;
      }

      let clientId: string;

      if (existingClient) {
        clientId = existingClient.id;
        // Update client info if needed
        await supabase
          .from('clients')
          .update({
            name: formData.clientName,
            email: formData.clientEmail,
            updated_at: new Date().toISOString()
          })
          .eq('id', clientId);
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([{
            tenant_id: tenant.id,
            name: formData.clientName,
            email: formData.clientEmail,
            phone: formData.clientPhone
          }])
          .select()
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      }

      // Create appointment
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert([{
          tenant_id: tenant.id,
          client_id: clientId,
          session_type: formData.sessionType,
          session_details: formData.sessionDetails,
          scheduled_date: formData.scheduledDate,
          total_amount: totalAmount,
          minimum_photos: minimumPhotos,
          terms_accepted: formData.termsAccepted
        }])
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Schedule appointment notifications
      try {
        console.log('📅 Agendando notificações para o appointment:', appointment.id);
        const notificationSuccess = await scheduleAllAppointmentNotifications(appointment);
        if (!notificationSuccess) {
          console.warn('⚠️ Algumas notificações podem não ter sido agendadas');
        }
      } catch (error) {
        console.error('❌ Erro ao agendar notificações (não crítico):', error);
      }

      // Create event in Google Calendar
      try {
        console.log('📅 Criando evento no Google Calendar...');
        await createGoogleCalendarEvent(appointment, formData);
      } catch (error) {
        console.error('❌ Erro ao criar evento no Google Calendar (não crítico):', error);
      }

      await fetchAppointments();
      return appointment;
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      setError(error instanceof Error ? error.message : 'Falha ao criar agendamento');
      throw error;
    }
  };

  const checkAvailability = async (date: string): Promise<boolean> => {
    try {
      // First check if date is in the future
      const appointmentDate = new Date(date);
      const now = new Date();
      if (appointmentDate <= now) {
        return false;
      }

      // Get all existing appointments to check for conflicts
      const { data, error } = await supabase
        .from('appointments')
        .select('scheduled_date')
        .in('status', ['pending', 'confirmed']);

      if (error) throw error;

      // Get settings for commercial hours
      const { data: settings } = await supabase
        .from('settings')
        .select('commercial_hours')
        .limit(1)
        .maybeSingle();

      if (!settings) return false;

      // Use the utility function to check availability
      return isDateTimeAvailable(date, data, settings.commercial_hours);
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      return false; // Assume not available if can't check
    }
  };

  const updateAppointmentStatus = async (id: string, status: Appointment['status']) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      // Se o status foi alterado para 'confirmed', uma galeria será criada automaticamente pelo trigger
      if (status === 'confirmed') {
        console.log('Appointment confirmado - galeria será criada automaticamente');
        
        // Tentar agendar notificações se ainda não foram agendadas
        try {
          const { data: appointment } = await supabase
            .from('appointments')
            .select(`
              *,
              client:clients(*)
            `)
            .eq('id', id)
            .single();
            
          if (appointment) {
            await scheduleAllAppointmentNotifications(appointment);
          }
        } catch (notificationError) {
          console.warn('⚠️ Erro ao agendar notificações na confirmação:', notificationError);
        }
      }
      
      await fetchAppointments();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar status do agendamento:', error);
      return false;
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchAppointments();
      return true;
    } catch (error) {
      console.error('Erro ao remover agendamento:', error);
      return false;
    }
  };
  return {
    appointments,
    loading,
    error,
    createAppointment,
    checkAvailability,
    checkGoogleCalendarAvailability,
    updateAppointmentStatus,
    deleteAppointment,
    refetch: fetchAppointments
  };
}