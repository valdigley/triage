import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SessionTypeData } from '../types';

export function useSessionTypes() {
  const [sessionTypes, setSessionTypes] = useState<SessionTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionTypes();
  }, []);

  const fetchSessionTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('triagem_session_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSessionTypes(data || []);
    } catch (err) {
      console.error('Erro ao buscar tipos de sessão:', err);
      setError(err instanceof Error ? err.message : 'Falha ao buscar tipos de sessão');
    } finally {
      setLoading(false);
    }
  };

  const createSessionType = async (sessionType: Omit<SessionTypeData, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('triagem_session_types')
        .insert([sessionType])
        .select()
        .single();

      if (error) throw error;
      
      await fetchSessionTypes();
      return data;
    } catch (err) {
      console.error('Erro ao criar tipo de sessão:', err);
      setError(err instanceof Error ? err.message : 'Falha ao criar tipo de sessão');
      throw err;
    }
  };

  const updateSessionType = async (id: string, updates: Partial<SessionTypeData>) => {
    try {
      const { error } = await supabase
        .from('triagem_session_types')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      await fetchSessionTypes();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar tipo de sessão:', err);
      setError(err instanceof Error ? err.message : 'Falha ao atualizar tipo de sessão');
      return false;
    }
  };

  const deleteSessionType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('triagem_session_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchSessionTypes();
      return true;
    } catch (err) {
      console.error('Erro ao excluir tipo de sessão:', err);
      setError(err instanceof Error ? err.message : 'Falha ao excluir tipo de sessão');
      return false;
    }
  };

  const toggleSessionTypeStatus = async (id: string, isActive: boolean) => {
    return await updateSessionType(id, { is_active: isActive });
  };

  const getActiveSessionTypes = () => {
    return sessionTypes.filter(type => type.is_active);
  };

  return {
    sessionTypes,
    loading,
    error,
    createSessionType,
    updateSessionType,
    deleteSessionType,
    toggleSessionTypeStatus,
    getActiveSessionTypes,
    refetch: fetchSessionTypes
  };
}