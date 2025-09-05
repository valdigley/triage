const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function sendWhatsAppMessage(
  instanceName: string,
  apiUrl: string,
  apiKey: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    console.log('📞 Preparando envio WhatsApp...');
    console.log('🏷️ Instância:', instanceName);
    console.log('🌐 API URL:', apiUrl);
    
    // Clean phone number
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    console.log('📱 Telefone limpo:', cleanPhone);
    console.log('📝 Tamanho da mensagem:', message.length, 'caracteres');

    const requestBody = {
      number: cleanPhone,
      text: message
    };

    const fullUrl = `${apiUrl}/message/sendText/${instanceName}`;
    console.log('🚀 URL completa da requisição:', fullUrl);
    const fullUrl = `${apiUrl}/message/sendText/${instanceName}`;
    console.log('🚀 URL completa da requisição:', fullUrl);
    console.log('🚀 Fazendo requisição para Evolution API...');

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Status da resposta:', response.status);
    
    if (response.ok) {
      let responseData;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error('❌ Erro ao fazer parse do JSON da resposta:', jsonError);
        const responseText = await response.text();
        console.log('📄 Resposta como texto:', responseText);
        return true; // Consider it successful if we got a 200 status
      }
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error('❌ Erro ao fazer parse do JSON da resposta:', jsonError);
        const responseText = await response.text();
        console.log('📄 Resposta como texto:', responseText);
        return true; // Consider it successful if we got a 200 status
      }
      console.log('✅ Resposta da API:', responseData);
      return true;
    } else {
      let errorData;
      try {
        errorData = await response.json();
      } catch (jsonError) {
        console.error('❌ Erro ao fazer parse do JSON do erro:', jsonError);
        const errorText = await response.text();
        console.error('📄 Erro como texto:', errorText);
        return false;
      }
      try {
        errorData = await response.json();
      } catch (jsonError) {
        console.error('❌ Erro ao fazer parse do JSON do erro:', jsonError);
        const errorText = await response.text();
        console.error('📄 Erro como texto:', errorText);
        return false;
      }
      console.error('❌ Erro da Evolution API:', errorData);
      return false;
    }

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', error);
    console.error('❌ Detalhes do erro:', error.message);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalhes do erro:', error.message);
    console.error('❌ Stack trace:', error.stack);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('🚀 Edge Function: send-selection-confirmation iniciada');
    
    const requestBody = await req.json();
    const { action, clientName, clientPhone, selectedCount, minimumPhotos, extraPhotos, totalAmount, paymentLink, formattedAmount, hasExtras, evolution_api_url, evolution_api_key, instance_name } = requestBody;
    
    // Handle connection test
    if (action === 'test-connection') {
      console.log('🧪 Testando conexão com Evolution API...');
      
      if (!evolution_api_url || !evolution_api_key || !instance_name) {
        return new Response(
                `Obrigado por escolher nossos serviços! 📸✨\n\n` +
                `Em caso de dúvidas, entre em contato conosco.\n\n` +
                `_Mensagem automática do sistema_`;
        )
          } else {
      // Mensagem padrão para seleção sem fotos extras
      console.log('📝 Montando mensagem padrão de seleção...');
      
      message = `✅ *Seleção Confirmada!*\n\n` +
                `Olá ${clientName}!\n\n` +
                `Recebemos sua seleção de fotos com sucesso! 🎉\n\n` +
                `📊 *Resumo da sua seleção:*\n` +
                `📸 *Fotos selecionadas:* ${selectedCount}\n` +
                `✅ *Fotos incluídas:* ${minimumPhotos}\n\n` +
                `⏰ *Próximos passos:*\n` +
                `• Suas fotos serão editadas profissionalmente\n` +
                `• Prazo de entrega: até ${deliveryDays} dias úteis\n` +
                `• Você receberá o link para download das fotos finais\n` +
                `• As fotos finais não terão marca d'água\n\n` +
                `🎨 *Processo de edição:*\n` +
                `• Correção de cores e iluminação\n` +
                `• Ajustes de contraste e nitidez\n` +
                `• Retoques básicos quando necessário\n\n` +
                `Obrigado por escolher nossos serviços! 📸✨\n\n` +
                `Em caso de dúvidas, entre em contato conosco.\n\n` +
                `_Mensagem automática do sistema_`;
    }
    }
    
    console.log('✅ Mensagem preparada');

    console.log('📱 Enviando mensagem WhatsApp...');
    console.log('📞 Para:', clientPhone);
    // Send WhatsApp message
    let whatsappSuccess = false;
    try {
      whatsappSuccess = await sendWhatsAppMessage(
        activeInstance.instance_name,
        apiUrl,
        apiKey,
        clientPhone,
        message
      );
    } catch (whatsappError) {
      console.error('❌ Erro ao enviar WhatsApp:', whatsappError);
      // WhatsApp failure doesn't affect the main process
      whatsappSuccess = false;
    }

    console.log(whatsappSuccess ? '✅ Mensagem enviada com sucesso!' : '❌ Falha ao enviar mensagem (processo continua)');
    return new Response(
      JSON.stringify({
        success: true, // Main process always succeeds
        whatsapp_sent: whatsappSuccess,
        message: whatsappSuccess ? 'Seleção confirmada e WhatsApp enviado' : 'Seleção confirmada (WhatsApp indisponível)',
        has_extra_photos: extraPhotos && extraPhotos > 0,
        payment_link: paymentLink
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('Error in send-selection-confirmation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});