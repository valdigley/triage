import React, { useState } from 'react';
import { useTenant } from '../../hooks/useTenant';
import { Check, CreditCard, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function SubscriptionView() {
  const { tenant, subscription, daysUntilExpiration, hasActiveSubscription } = useTenant();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    qrCode?: string;
    qrCodeBase64?: string;
    subscriptionId?: string;
  } | null>(null);

  const plans = [
    {
      id: 'monthly',
      name: 'Plano Mensal',
      price: 79.90,
      period: 'mês',
      features: [
        'Galeria de fotos ilimitadas',
        'Sistema de pagamentos integrado',
        'WhatsApp automático',
        'Agendamentos online',
        'Suporte por email'
      ]
    },
    {
      id: 'yearly',
      name: 'Plano Anual',
      price: 799.00,
      period: 'ano',
      savings: 'Economize 2 meses!',
      features: [
        'Galeria de fotos ilimitadas',
        'Sistema de pagamentos integrado',
        'WhatsApp automático',
        'Agendamentos online',
        'Suporte prioritário',
        '2 meses grátis'
      ]
    }
  ];

  const handleCreatePayment = async () => {
    if (!tenant) return;

    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-subscription-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenantId: tenant.id,
            planName: selectedPlan
          })
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar pagamento');
      }

      setPaymentData({
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        subscriptionId: data.subscriptionId
      });

    } catch (error) {
      console.error('Error creating payment:', error);
      alert(error instanceof Error ? error.message : 'Erro ao criar pagamento');
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (paymentData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
              <Clock className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Aguardando Pagamento
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Escaneie o QR Code abaixo para pagar via PIX
            </p>
          </div>

          {paymentData.qrCodeBase64 && (
            <div className="flex justify-center mb-6">
              <img
                src={`data:image/png;base64,${paymentData.qrCodeBase64}`}
                alt="QR Code PIX"
                className="w-64 h-64 border-4 border-gray-200 dark:border-gray-700 rounded-lg"
              />
            </div>
          )}

          {paymentData.qrCode && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ou copie o código PIX:
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={paymentData.qrCode}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-gray-50 dark:bg-gray-700 dark:text-white text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentData.qrCode!);
                    alert('Código copiado!');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Importante:</strong> Após realizar o pagamento, sua assinatura será ativada automaticamente em alguns instantes.
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setPaymentData(null);
                window.location.reload();
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Gerenciar Assinatura
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Escolha o melhor plano para o seu negócio
        </p>
      </div>

      {tenant.status === 'trial' && daysUntilExpiration !== null && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200">
            <strong>Trial Ativo:</strong> Você tem {daysUntilExpiration} {daysUntilExpiration === 1 ? 'dia' : 'dias'} restantes no período de testes.
          </p>
        </div>
      )}

      {subscription && hasActiveSubscription && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" />
            <div>
              <p className="text-green-800 dark:text-green-200 font-medium">
                Assinatura Ativa - {subscription.plan_name === 'monthly' ? 'Plano Mensal' : 'Plano Anual'}
              </p>
              {subscription.expires_at && (
                <p className="text-sm text-green-700 dark:text-green-300">
                  Válido até: {new Date(subscription.expires_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden transition-transform hover:scale-105 ${
              selectedPlan === plan.id ? 'ring-4 ring-blue-500' : ''
            }`}
          >
            {plan.savings && (
              <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1 text-xs font-bold">
                {plan.savings}
              </div>
            )}

            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {plan.name}
              </h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  R$ {plan.price.toFixed(2)}
                </span>
                <span className="text-gray-600 dark:text-gray-400">/{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedPlan(plan.id as 'monthly' | 'yearly')}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  selectedPlan === plan.id
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {selectedPlan === plan.id ? 'Plano Selecionado' : 'Selecionar Plano'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <button
          onClick={handleCreatePayment}
          disabled={loading}
          className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              Gerando pagamento...
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Pagar com PIX
            </>
          )}
        </button>

        <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
          Pagamento seguro via MercadoPago
        </p>
      </div>
    </div>
  );
}
