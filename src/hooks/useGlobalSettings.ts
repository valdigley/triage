import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface GlobalSettings {
  id: string;
  evolution_api_url: string;
  evolution_api_key: string;
  instance_name: string;
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
        .from('global_settings')
        .select('*')
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
        // Atualizar configuração existente
        const { error } = await supabase
          .from('global_settings')
          .update({
            evolution_api_url: apiUrl,
            evolution_api_key: apiKey,
            instance_name: instanceName,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Criar nova configuração
        const { error } = await supabase
          .from('global_settings')
          .insert({
            evolution_api_url: apiUrl,
            evolution_api_key: apiKey,
            instance_name: instanceName
          });

        if (error) throw error;
      }

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
