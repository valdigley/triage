import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateEventRequest {
  appointmentId: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CreateEventRequest = await req.json();
    const { appointmentId, summary, description, startDateTime, endDateTime, attendees } = body;

    console.log("📅 Criando evento no Google Calendar...");
    console.log("Appointment ID:", appointmentId);
    console.log("Summary:", summary);
    console.log("Start:", startDateTime);
    console.log("End:", endDateTime);

    // Buscar configurações do Google Calendar
    const { data: settings, error: settingsError } = await supabase
      .from("google_calendar_settings")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      console.error("❌ Configurações do Google Calendar não encontradas:", settingsError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Google Calendar não está configurado",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Configurações encontradas");
    console.log("Calendar ID:", settings.calendar_id);
    console.log("Service Account Email:", settings.service_account_email);

    const serviceAccountKey = settings.service_account_key;

    // Validar chave da service account
    if (!serviceAccountKey.private_key || !serviceAccountKey.client_email) {
      console.error("❌ Chave da service account inválida");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Chave da service account inválida ou incompleta",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Gerar JWT para autenticação
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccountKey.client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    // Criar assinatura JWT
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const unsignedToken = `${headerB64}.${payloadB64}`;

    // Importar chave privada
    const privateKey = serviceAccountKey.private_key;
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKey
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\s/g, "");

    const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    // Assinar token
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      encoder.encode(unsignedToken)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const jwt = `${unsignedToken}.${signatureB64}`;

    // Trocar JWT por access token
    console.log("🔑 Obtendo access token...");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("❌ Erro ao obter access token:", errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Falha na autenticação com Google",
          details: errorText,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { access_token } = await tokenResponse.json();
    console.log("✅ Access token obtido");

    // Criar evento no calendário
    const event = {
      summary,
      description: description || "",
      start: {
        dateTime: startDateTime,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "America/Sao_Paulo",
      },
      attendees: attendees?.map(email => ({ email })) || [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 dia antes
          { method: "popup", minutes: 60 }, // 1 hora antes
        ],
      },
    };

    console.log("📤 Criando evento no Google Calendar...");
    const createEventResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(settings.calendar_id)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!createEventResponse.ok) {
      const errorText = await createEventResponse.text();
      console.error("❌ Erro ao criar evento:", errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Falha ao criar evento no Google Calendar",
          details: errorText,
        }),
        {
          status: createEventResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const createdEvent = await createEventResponse.json();
    console.log("✅ Evento criado com sucesso!");
    console.log("Event ID:", createdEvent.id);
    console.log("Event Link:", createdEvent.htmlLink);

    // Atualizar appointment com o ID do evento do Google
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        google_calendar_event_id: createdEvent.id,
        google_calendar_event_link: createdEvent.htmlLink,
      })
      .eq("id", appointmentId);

    if (updateError) {
      console.error("⚠️ Erro ao atualizar appointment (não crítico):", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Evento criado no Google Calendar",
        eventId: createdEvent.id,
        eventLink: createdEvent.htmlLink,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});