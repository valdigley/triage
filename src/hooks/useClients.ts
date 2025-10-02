import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Client } from '../types';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);

      // Buscar todos os clientes
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar todos os pagamentos aprovados agrupados por cliente
      const { data: allPayments } = await supabase
        .from('payments')
        .select('client_id, amount, status')
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
    try {
      setLoading(true);

      // Buscar todos os clientes
      let query = supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar todos os pagamentos aprovados agrupados por cliente
      const { data: allPayments } = await supabase
        .from('payments')
        .select('client_id, amount, status')
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