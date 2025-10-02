import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Tenant, Subscription, SubscriptionPayment } from '../../types';
import { Shield, Search, CheckCircle, XCircle, Clock, AlertCircle, DollarSign, Calendar } from 'lucide-react';

export function AdminTenantsView() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription | null>>({});
  const [payments, setPayments] = useState<Record<string, SubscriptionPayment[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);

      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      if (tenantsData) {
        const subsPromises = tenantsData.map(tenant =>
          supabase
            .from('subscriptions')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        );

        const subsResults = await Promise.all(subsPromises);
        const subsMap: Record<string, Subscription | null> = {};
        subsResults.forEach((result, index) => {
          subsMap[tenantsData[index].id] = result.data;
        });
        setSubscriptions(subsMap);

        const paymentsPromises = tenantsData.map(tenant =>
          supabase
            .from('subscription_payments')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
        );

        const paymentsResults = await Promise.all(paymentsPromises);
        const paymentsMap: Record<string, SubscriptionPayment[]> = {};
        paymentsResults.forEach((result, index) => {
          paymentsMap[tenantsData[index].id] = result.data || [];
        });
        setPayments(paymentsMap);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTenantStatus = async (tenantId: string, newStatus: 'trial' | 'active' | 'suspended' | 'canceled') => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ status: newStatus })
        .eq('id', tenantId);

      if (error) throw error;

      setTenants(prev =>
        prev.map(t => t.id === tenantId ? { ...t, status: newStatus } : t)
      );
    } catch (error) {
      console.error('Error updating tenant status:', error);
      alert('Erro ao atualizar status do tenant');
    }
  };

  const getStatusBadge = (tenant: Tenant) => {
    const trialEndsAt = new Date(tenant.trial_ends_at);
    const now = new Date();
    const daysLeft = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    switch (tenant.status) {
      case 'trial':
        if (daysLeft > 0) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              <Clock className="w-3 h-3 mr-1" />
              Trial ({daysLeft}d restantes)
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
              <AlertCircle className="w-3 h-3 mr-1" />
              Trial Expirado
            </span>
          );
        }
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Ativo
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Suspenso
          </span>
        );
      case 'canceled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelado
          </span>
        );
    }
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && tenant.status === filterStatus;
  });

  const stats = {
    total: tenants.length,
    trial: tenants.filter(t => t.status === 'trial').length,
    active: tenants.filter(t => t.status === 'active').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
    totalRevenue: Object.values(payments)
      .flat()
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + Number(p.amount), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              Gestão de Tenants
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Painel administrativo master
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Trial</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.trial}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Ativos</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Suspensos</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.suspended}</p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Receita</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                R$ {stats.totalRevenue.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">Todos</option>
            <option value="trial">Trial</option>
            <option value="active">Ativos</option>
            <option value="suspended">Suspensos</option>
            <option value="canceled">Cancelados</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Tenant
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Contato
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Assinatura
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Cadastro
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((tenant) => {
                const subscription = subscriptions[tenant.id];
                const tenantPayments = payments[tenant.id] || [];

                return (
                  <tr
                    key={tenant.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {tenant.name}
                        </p>
                        {tenant.business_name && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {tenant.business_name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <p className="text-gray-800 dark:text-white">{tenant.email}</p>
                        {tenant.phone && (
                          <p className="text-gray-500 dark:text-gray-400">{tenant.phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(tenant)}</td>
                    <td className="py-4 px-4">
                      {subscription ? (
                        <div className="text-sm">
                          <p className="font-medium text-gray-800 dark:text-white">
                            {subscription.plan_name === 'monthly' ? 'Mensal' : 'Anual'}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400">
                            R$ {Number(subscription.amount).toFixed(2)}
                          </p>
                          {subscription.expires_at && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Exp: {new Date(subscription.expires_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Sem assinatura</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        {tenant.status !== 'active' && (
                          <button
                            onClick={() => updateTenantStatus(tenant.id, 'active')}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
                          >
                            Ativar
                          </button>
                        )}
                        {tenant.status !== 'suspended' && (
                          <button
                            onClick={() => updateTenantStatus(tenant.id, 'suspended')}
                            className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                          >
                            Suspender
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTenants.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Nenhum tenant encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
