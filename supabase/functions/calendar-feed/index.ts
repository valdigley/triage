const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function generateICalendar(appointments: any[]): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Triagem Studio//Calendar Feed//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Agenda do Estúdio - Triagem',
    'X-WR-CALDESC:Agendamentos de sessões fotográficas atualizados automaticamente',
    'X-WR-TIMEZONE:America/Sao_Paulo',
    'X-PUBLISHED-TTL:PT1H', // Refresh every hour
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H'
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

    // Determinar status do evento baseado no status do appointment
    let eventStatus = 'TENTATIVE';
    switch (appointment.status) {
      case 'confirmed':
        eventStatus = appointment.payment_status === 'approved' ? 'CONFIRMED' : 'TENTATIVE';
        break;
      case 'completed':
        eventStatus = 'CONFIRMED';
        break;
      case 'cancelled':
        eventStatus = 'CANCELLED';
        break;
      default:
        eventStatus = 'TENTATIVE';
    }

    // Determinar prioridade
    let priority = '5'; // Normal
    if (appointment.status === 'confirmed' && appointment.payment_status === 'approved') {
      priority = '1'; // High
    } else if (appointment.status === 'pending') {
      priority = '9'; // Low
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
      `STATUS:${eventStatus}`,
      `CATEGORIES:SESSAO_FOTOGRAFICA,${appointment.session_type.toUpperCase()}`,
      `PRIORITY:${priority}`,
      `CREATED:${new Date(appointment.created_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`,
      `LAST-MODIFIED:${new Date(appointment.updated_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`,
      'END:VEVENT'
    );
  });

  icalContent.push('END:VCALENDAR');
  
  return icalContent.join('\r\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get Supabase client
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all appointments with client data
    const { data: appointments, error } = await supabase
      .from('triagem_appointments')
      .select(`
        *,
        client:clients(*)
      `)
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }

    // Generate iCal content
    const icalContent = generateICalendar(appointments || []);

    // Return iCal file with proper headers
    return new Response(icalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="agenda-estudio.ics"',
        'Cache-Control': 'no-cache, must-revalidate',
        'Expires': '0',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Error generating calendar feed:', error);
    return new Response(
      'Error generating calendar feed',
      {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders,
        },
      }
    );
  }
});