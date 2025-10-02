import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client } from '../types';
import { useTenant } from './useTenant';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tenant, loading: tenantLoading } = useTenant();

  useEffect(() => {
    if (tenantLoading) return;

    if (tenant) {
      fetchClients();
    } else {
      setLoading(false);
    }
  }, [tenant, tenantLoading]);

  const fetchClients = async () => {
    if (!tenant) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: allPayments } = await supabase
        .from('payments')
        .select('client_id, amount, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'approved');

      // Calcular total gasto real para cada cliente
      const clientsWithRealTotal = (data || []).map(client => {
        const clientPayments = allPayments?.filter(p => p.client_id === client.id) || [];
        const totalSpent = clientPayments.reduce((sum, p) => sum + p.amount, 0);

        return {
          ...client,
          total_spent: totalSpent
        };
      });

      setClients(clientsWithRealTotal);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      setError(err instanceof Error ? err.message : 'Falha ao buscar clientes');
    } finally {
      setLoading(false);
    }
  };

  const searchClients = async (searchTerm: string) => {
    if (!tenant) return;

    try {
      setLoading(true);

      let query = supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const { data: allPayments } = await supabase
        .from('payments')
        .select('client_id, amount, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'approved');

      // Calcular total gasto real para cada cliente
      const clientsWithRealTotal = (data || []).map(client => {
        const clientPayments = allPayments?.filter(p => p.client_id === client.id) || [];
        const totalSpent = clientPayments.reduce((sum, p) => sum + p.amount, 0);

        return {
          ...client,
          total_spent: totalSpent
        };
      });

      setClients(clientsWithRealTotal);
    } catch (err) {
      console.error('Erro ao pesquisar clientes:', err);
      setError(err instanceof Error ? err.message : 'Falha ao pesquisar clientes');
    } finally {
      setLoading(false);
    }
  };

  const getClientDetails = async (clientId: string) => {
    try {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: false });

      if (clientError) throw clientError;
      if (appointmentsError) throw appointmentsError;

      return {
        client,
        appointments: appointments || []
      };
    } catch (err) {
      console.error('Erro ao buscar detalhes do cliente:', err);
      setError(err instanceof Error ? err.message : 'Falha ao obter detalhes do cliente');
      return null;
    }
  };

  return {
    clients,
    loading,
    error,
    searchClients,
    getClientDetails,
    refetch: fetchClients
  };
}