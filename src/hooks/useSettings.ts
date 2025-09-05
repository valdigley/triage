import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings } from '../types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (err) {
      console.error('Erro ao buscar configurações:', err);
      setError(err instanceof Error ? err.message : 'Falha ao buscar configurações');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<Settings>) => {
    try {
      if (!settings) return false;

      const { error } = await supabase
        .from('settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', settings.id);

      if (error) throw error;
      
      setSettings(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (err) {
      console.error('Erro ao atualizar configurações:', err);
      setError(err instanceof Error ? err.message : 'Falha ao atualizar configurações');
      return false;
    }
  };

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings
  };
}