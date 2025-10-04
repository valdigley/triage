import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface GlobalSettings {
  id: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('triagem_global_evolution_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações');
      console.error('Erro ao buscar configurações globais:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (apiUrl: string, apiKey: string, instanceName: string): Promise<boolean> => {
    try {
      if (settings) {
        // Desativar configuração antiga
        await supabase
          .from('triagem_global_evolution_settings')
          .update({ is_active: false })
          .eq('id', settings.id);
      }

      // Criar nova configuração ativa
      const { error } = await supabase
        .from('triagem_global_evolution_settings')
        .insert({
          api_url: apiUrl,
          api_key: apiKey,
          instance_name: instanceName,
          is_active: true
        });

      if (error) throw error;

      await fetchSettings();
      return true;
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    saveSettings,
    refetch: fetchSettings
  };
}
