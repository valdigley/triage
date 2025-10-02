import { Appointment } from '../types';

export function generateICalendar(appointments: Appointment[]): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Triagem//Studio Calendar//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Agenda do Estúdio',
    'X-WR-CALDESC:Agendamentos de sessões fotográficas',
    'X-WR-TIMEZONE:America/Sao_Paulo'
  ];

  appointments.forEach(appointment => {
    if (!appointment.client) return;

    const startDate = new Date(appointment.scheduled_date);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hora depois
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const sessionTypeLabels: Record<string, string> = {
      'aniversario': 'Aniversário',
      'gestante': 'Gestante', 
      'formatura': 'Formatura',
      'comercial': 'Comercial',
      'pre_wedding': 'Pré-wedding',
      'tematico': 'Temático'
    };

    const sessionLabel = sessionTypeLabels[appointment.session_type] || appointment.session_type;
    
    // Status em português
    const statusLabels: Record<string, string> = {
      'pending': 'Pendente',
      'confirmed': 'Confirmado',
      'completed': 'Concluído',
      'cancelled': 'Cancelado'
    };

    const statusLabel = statusLabels[appointment.status] || appointment.status;
    
    // Payment status em português
    const paymentLabels: Record<string, string> = {
      'pending': 'Pendente',
      'approved': 'Aprovado',
      'rejected': 'Rejeitado',
      'cancelled': 'Cancelado'
    };

    const paymentLabel = paymentLabels[appointment.payment_status] || appointment.payment_status;

    const summary = `${sessionLabel} - ${appointment.client.name}`;
    const description = [
      `Cliente: ${appointment.client.name}`,
      `Telefone: ${appointment.client.phone}`,
      appointment.client.email ? `Email: ${appointment.client.email}` : '',
      `Tipo: ${sessionLabel}`,
      `Valor: R$ ${appointment.total_amount.toFixed(2).replace('.', ',')}`,
      `Status: ${statusLabel}`,
      `Pagamento: ${paymentLabel}`,
      `Fotos mínimas: ${appointment.minimum_photos}`,
      appointment.session_details && Object.keys(appointment.session_details).length > 0 
        ? `Detalhes: ${Object.entries(appointment.session_details).map(([key, value]) => `${key}: ${value}`).join(', ')}`
        : ''
    ].filter(Boolean).join('\\n');

    // Determinar cor do evento baseado no status
    let color = '';
    switch (appointment.status) {
      case 'confirmed':
        color = appointment.payment_status === 'approved' ? 'GREEN' : 'YELLOW';
        break;
      case 'pending':
        color = 'ORANGE';
        break;
      case 'completed':
        color = 'BLUE';
        break;
      case 'cancelled':
        color = 'RED';
        break;
      default:
        color = 'GRAY';
    }

    icalContent.push(
      'BEGIN:VEVENT',
      `UID:${appointment.id}@triagem.studio`,
      `DTSTAMP:${timestamp}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${appointment.session_details?.location || 'Estúdio'}`,
      `STATUS:${appointment.status.toUpperCase()}`,
      `CATEGORIES:SESSAO_FOTOGRAFICA,${appointment.session_type.toUpperCase()}`,
      `COLOR:${color}`,
      `PRIORITY:${appointment.status === 'confirmed' ? '1' : '5'}`,
      `CREATED:${new Date(appointment.created_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`,
      `LAST-MODIFIED:${new Date(appointment.updated_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`,
      'END:VEVENT'
    );
  });

  icalContent.push('END:VCALENDAR');
  
  return icalContent.join('\r\n');
}

export function downloadICalendar(appointments: Appointment[], filename: string = 'agenda-estudio.ics') {
  const icalContent = generateICalendar(appointments);
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getICalendarUrl(appointments: Appointment[]): string {
  const icalContent = generateICalendar(appointments);
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
}