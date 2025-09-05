import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
  instance_data: {
    evolution_api_url?: string;
    evolution_api_key?: string;
  };
  created_at: string;
  updated_at: string;
}

export function useWhatsApp() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setInstances(data || []);
    } catch (err) {
      console.error('Error fetching WhatsApp instances:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const refetch = () => {
    fetchInstances();
  };

  return {
    instances,
    loading,
    error,
    refetch
  };
}