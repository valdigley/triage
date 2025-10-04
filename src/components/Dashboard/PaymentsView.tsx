import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, TrendingUp, Calendar, Clock, Send, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { useTenant } from '../../hooks/useTenant';
import { Payment, Appointment } from '../../types';
import { formatCurrency } from '../../utils/pricing';

export function PaymentsView() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingPaymentRequest, setSendingPaymentRequest] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('all');
  const { sendMessage } = useWhatsApp();
  const { tenant, loading: tenantLoading } = useTenant();

  useEffect(() => {
    if (tenantLoading) return;

    if (tenant) {
      fetchPayments();
    } else {
      setLoading(false);
    }
  }, [tenant, tenantLoading]);

  const fetchPayments = async () => {
    if (!tenant) return;

    try {
      const { data, error } = await supabase
        .from('triagem_payments')
        .select(`
          *,
          appointment:triagem_appointments(
            *,
            client:triagem_clients(*)
          ),
          client:client_id(
            id,
            name,
            email,
            phone
          ),
          gallery:gallery_id(
            id,
            name
          )
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentClient = (payment: Payment) => {
    return payment.appointment?.client || payment.client;
  };

  const handleSendPaymentRequest = async (payment: Payment) => {
    const client = getPaymentClient(payment);

    if (!client) {
      alert('Dados do cliente não encontrados');
      return;
    }

    setSendingPaymentRequest(payment.id);
    try {
      // Create new PIX payment via MercadoPago
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          paymentId: payment.id,
          appointmentId: payment.appointment_id,
          amount: payment.amount,
          clientName: client.name,
          clientEmail: client.email,
          clientPhone: client.phone,
          paymentType: payment.payment_type
        })
      });

      const result = await response.json();

      if (result.success) {
        // Send PIX code via WhatsApp
        const paymentTypeLabel = payment.payment_type === 'initial' ? 'Sessão Fotográfica' : 'Fotos Extras';
        const formattedAmount = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(payment.amount);

        // Primeira mensagem - apenas a chave PIX
        const firstMessage = result.qr_code || 'Código PIX não disponível';

        // Segunda mensagem - informações e instruções
        const secondMessage = `💳 *PIX para Pagamento - ${paymentTypeLabel}*\n\n` +
                             `Olá ${client.name}!\n\n` +
                             `💰 *Valor:* ${formattedAmount}\n\n` +
                             `⏰ *Válido até:* ${new Date(result.expires_at).toLocaleString('pt-BR')}\n\n` +
                             `💡 *Como pagar:*\n` +
                             `• Copie o código PIX da mensagem anterior\n` +
                             `• Abra seu app bancário\n` +
                             `• Cole o código na opção PIX\n` +
                             `• Receba confirmação automática\n\n` +
                             `✅ *Após o pagamento:*\n` +
                             `• Você receberá confirmação via WhatsApp\n` +
                             `• ${payment.payment_type === 'initial' ? 'Seu agendamento será confirmado automaticamente' : 'Suas fotos extras serão processadas'}\n\n` +
                             `Em caso de dúvidas, entre em contato conosco.\n\n` +
                             `_Mensagem automática do sistema_`;

        // Enviar primeira mensagem (chave PIX)
        const firstMessageSuccess = await sendMessage(client.phone, firstMessage);

        // Aguardar 2 segundos antes de enviar a segunda mensagem
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Enviar segunda mensagem (informações)
        const secondMessageSuccess = await sendMessage(client.phone, secondMessage);
        
        const whatsappSuccess = firstMessageSuccess && secondMessageSuccess;
        
        if (whatsappSuccess) {
          alert('✅ PIX gerado e enviado via WhatsApp em 2 mensagens!');
        } else {
          // Show PIX code for manual sending if WhatsApp fails
          const shouldCopy = confirm(`PIX gerado, mas falha no WhatsApp.\n\nDeseja copiar o código PIX para enviar manualmente?\n\n${result.qr_code || 'Código não disponível'}`);
          if (shouldCopy) {
            navigator.clipboard.writeText(result.qr_code || '');
            alert('Código PIX copiado para a área de transferência!');
          }
        }
      } else {
        throw new Error(result.error || 'Erro ao gerar PIX');
      }

    } catch (error) {
      console.error('Erro ao gerar PIX:', error);
      alert(`Erro ao gerar PIX: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSendingPaymentRequest(null);
    }
  };

  const handleMarkAsPaid = async (payment: Payment) => {
    if (!confirm('Confirmar que este pagamento foi recebido?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('triagem_payments')
        .update({ status: 'approved' })
        .eq('id', payment.id);

      if (error) throw error;

      // Atualizar também o agendamento se houver
      if (payment.appointment_id) {
        await supabase
          .from('triagem_appointments')
          .update({ payment_status: 'paid' })
          .eq('id', payment.appointment_id);
      }

      alert('✅ Pagamento marcado como pago!');
      fetchPayments();
    } catch (error) {
      console.error('Erro ao marcar pagamento:', error);
      alert('Erro ao marcar pagamento como pago');
    }
  };

  const handleMarkAsUnpaid = async (payment: Payment) => {
    if (!confirm('Marcar este pagamento como não pago?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('triagem_payments')
        .update({ status: 'cancelled' })
        .eq('id', payment.id);

      if (error) throw error;

      // Atualizar também o agendamento se houver
      if (payment.appointment_id) {
        await supabase
          .from('triagem_appointments')
          .update({ payment_status: 'pending' })
          .eq('id', payment.appointment_id);
      }

      alert('❌ Pagamento marcado como não pago');
      fetchPayments();
    } catch (error) {
      console.error('Erro ao marcar pagamento:', error);
      alert('Erro ao marcar pagamento como não pago');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Aprovado', className: 'bg-green-100 text-green-800' },
      rejected: { label: 'Rejeitado', className: 'bg-red-100 text-red-800' },
      cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getPaymentTypeBadge = (type: string) => {
    const typeConfig = {
      initial: { label: 'Inicial', className: 'bg-blue-100 text-blue-800' },
      extra_photos: { label: 'Fotos Extras', className: 'bg-purple-100 text-purple-800' },
      public_gallery: { label: 'Galeria Pública', className: 'bg-green-100 text-green-800' }
    };

    const config = typeConfig[type as keyof typeof typeConfig] || { label: type, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const totalRevenue = payments
    .filter(payment => payment.status === 'approved')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const pendingAmount = payments
    .filter(payment => payment.status === 'pending')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const thisMonthRevenue = payments
    .filter(payment => {
      const paymentDate = new Date(payment.created_at);
      const now = new Date();
      return payment.status === 'approved' &&
        paymentDate.getMonth() === now.getMonth() &&
        paymentDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, payment) => sum + payment.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pagamentos</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Faturamento Total</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Este Mês</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(thisMonthRevenue)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pendentes</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(pendingAmount)}</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>


      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  MP ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {getPaymentClient(payment)?.name || 'Cliente não identificado'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getPaymentTypeBadge(payment.payment_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(payment.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {payment.mercadopago_id || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.status === 'pending' && getPaymentClient(payment) && (
                      <div className="flex items-center space-x-2">
                        {payment.mercadopago_id ? (
                          // Tem Mercado Pago - Mostrar botão de gerar PIX
                          <button
                            onClick={() => handleSendPaymentRequest(payment)}
                            disabled={sendingPaymentRequest === payment.id}
                            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                            title="Gerar e enviar PIX via WhatsApp"
                          >
                            {sendingPaymentRequest === payment.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <DollarSign className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          // Pagamento Manual - Mostrar botões de marcar pago/não pago
                          <>
                            <button
                              onClick={() => handleMarkAsPaid(payment)}
                              className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                              title="Marcar como Pago"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleMarkAsUnpaid(payment)}
                              className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                              title="Marcar como Não Pago"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {payments.map((payment) => (
          <div key={payment.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {getPaymentClient(payment)?.name || 'Cliente não identificado'}
                </h3>
                <div className="mb-2">
                  {getPaymentTypeBadge(payment.payment_type)}
                </div>
              </div>
              <div className="ml-3 text-right">
                <div className="text-lg font-bold text-green-600 mb-1">
                  {formatCurrency(payment.amount)}
                </div>
                {getStatusBadge(payment.status)}
              </div>
            </div>

            {/* Payment Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Data</label>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {new Date(payment.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Horário</label>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {new Date(payment.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </p>
              </div>
            </div>

            {/* MercadoPago ID */}
            {payment.mercadopago_id && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <label className="text-xs font-medium text-blue-600 dark:text-blue-400">ID MercadoPago</label>
                <p className="text-sm font-mono text-blue-800 dark:text-blue-300 truncate">
                  {payment.mercadopago_id}
                </p>
              </div>
            )}

            {/* Payment Actions */}
            {payment.status === 'pending' && getPaymentClient(payment) && (
              <div className="mb-3">
                {payment.mercadopago_id ? (
                  // Tem Mercado Pago - Mostrar botão de gerar PIX
                  <button
                    onClick={() => handleSendPaymentRequest(payment)}
                    disabled={sendingPaymentRequest === payment.id}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {sendingPaymentRequest === payment.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <DollarSign className="h-4 w-4" />
                        <span>Gerar e Enviar PIX</span>
                      </>
                    )}
                  </button>
                ) : (
                  // Pagamento Manual - Mostrar botões de marcar pago/não pago
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleMarkAsPaid(payment)}
                      className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Pago</span>
                    </button>
                    <button
                      onClick={() => handleMarkAsUnpaid(payment)}
                      className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Não Pago</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Additional Info */}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {payment.mercadopago_id ? 'Pagamento processado via MercadoPago' : 'Pagamento manual (PIX)'}
            </div>
          </div>
        ))}
      </div>

      {payments.length === 0 && (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Nenhum pagamento encontrado</p>
        </div>
      )}
    </div>
  );
}