import { createClient } from 'npm:@supabase/supabase-js@2';
import { JWT } from 'npm:google-auth-library@9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CheckAvailabilityRequest {
  startDateTime: string; // ISO 8601 format
  endDateTime: string;   // ISO 8601 format
  tenantId?: string;     // Optional tenant ID
}

interface CalendarEvent {
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

async function getGoogleCalendarEvents(
  serviceAccountEmail: string,
  privateKey: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  try {
    // Create JWT client for service account authentication
    const client = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    // Get access token
    const token = await client.getAccessToken();

    if (!token.token) {
      throw new Error('Failed to get access token');
    }

    // Query Google Calendar API
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Calendar API error:', response.status, errorText);
      throw new Error(`Google Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('📅 Verificando disponibilidade no Google Calendar...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { startDateTime, endDateTime, tenantId: requestTenantId }: CheckAvailabilityRequest = await req.json();

    if (!startDateTime || !endDateTime) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'startDateTime and endDateTime are required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('🔍 Período solicitado:', startDateTime, 'até', endDateTime);

    let tenantId: string | null = requestTenantId || null;

    // Se não foi fornecido tenantId, NÃO tentar identificar automaticamente
    // Isso evita que o calendar de um tenant seja usado por outro
    if (!tenantId) {
      console.log('⚠️ Nenhum tenantId fornecido - retornando todas as datas como disponíveis');
      return new Response(
        JSON.stringify({
          success: true,
          available: true,
          message: 'Tenant não identificado - todas as datas disponíveis',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Tenant ID fornecido:', tenantId);

    // Get active Google Calendar settings for this tenant
    const { data: settings, error: settingsError } = await supabase
      .from('triagem_google_calendar_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      console.log('⚠️ Google Calendar não configurado para este tenant - retornando todas as datas como disponíveis');
      return new Response(
        JSON.stringify({
          success: true,
          available: true,
          message: 'Google Calendar não configurado - todas as datas disponíveis',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Configurações encontradas:', settings.calendar_id);

    // Extract private key from service account key JSON
    const privateKey = settings.service_account_key.private_key;

    if (!privateKey) {
      console.log('⚠️ Private key não encontrada - retornando todas as datas como disponíveis');
      return new Response(
        JSON.stringify({
          success: true,
          available: true,
          message: 'Configuração do Google Calendar inválida - todas as datas disponíveis',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch events from Google Calendar
    console.log('🔍 Buscando eventos no Google Calendar...');
    const events = await getGoogleCalendarEvents(
      settings.service_account_email,
      privateKey,
      settings.calendar_id,
      startDateTime,
      endDateTime
    );

    console.log(`📋 Eventos encontrados: ${events.length}`);

    // Check if there are any conflicting events
    const hasConflict = events.length > 0;

    if (hasConflict) {
      console.log('⚠️ Conflito detectado - horário não disponível');
      console.log('📋 Eventos conflitantes:', events.map(e => ({
        summary: e.summary,
        start: e.start.dateTime,
        end: e.end.dateTime,
      })));
    } else {
      console.log('✅ Horário disponível');
    }

    return new Response(
      JSON.stringify({
        success: true,
        available: !hasConflict,
        conflictingEvents: hasConflict ? events.map(event => ({
          summary: event.summary,
          start: event.start.dateTime,
          end: event.end.dateTime,
        })) : [],
        message: hasConflict
          ? 'Este horário já está ocupado no calendário'
          : 'Horário disponível',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Erro ao verificar disponibilidade:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        available: true, // Em caso de erro, permitir agendamento (fallback)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});