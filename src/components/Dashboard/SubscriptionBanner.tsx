import React from 'react';
import { useTenant } from '../../hooks/useTenant';
import { AlertCircle, Clock, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function SubscriptionBanner() {
  const { tenant, isMasterAdmin, daysUntilExpiration, hasActiveSubscription } = useTenant();

  if (isMasterAdmin || !tenant) return null;
  if (hasActiveSubscription && (daysUntilExpiration === null || daysUntilExpiration > 7)) return null;

  const isExpired = daysUntilExpiration !== null && daysUntilExpiration <= 0;
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration > 0 && daysUntilExpiration <= 7;

  if (isExpired) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              {tenant.status === 'trial' ? 'Período de Trial Expirado' : 'Assinatura Expirada'}
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Seu acesso ao sistema está suspenso. Renove sua assinatura para continuar usando.
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/#/subscription'}
            className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
          >
            <CreditCard className="h-4 w-4" />
            <span>Renovar Agora</span>
          </button>
        </div>
      </div>
    );
  }

  if (isExpiringSoon) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 mb-6">
        <div className="flex items-center">
          <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {tenant.status === 'trial'
                ? `Trial expira em ${daysUntilExpiration} ${daysUntilExpiration === 1 ? 'dia' : 'dias'}`
                : `Assinatura expira em ${daysUntilExpiration} ${daysUntilExpiration === 1 ? 'dia' : 'dias'}`
              }
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Não perca o acesso! Renove sua assinatura antes do vencimento.
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/#/subscription'}
            className="ml-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
          >
            <CreditCard className="h-4 w-4" />
            <span>Renovar</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
