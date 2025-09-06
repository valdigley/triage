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
      setError(null);
      const { data, error } = await supabase
        .from('session_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSessionTypes(data || []);
    } catch (err) {
      console.error('Erro ao buscar tipos de sessão:', err);
      setError(err instanceof Error ? err.message : 'Falha ao buscar tipos de sessão');
      // Em caso de erro, usar dados padrão para não quebrar a aplicação
      setSessionTypes([
        {
          id: 'default-1',
          name: 'aniversario',
          label: 'Aniversário',
          description: 'Celebração de aniversário',
          icon: '🎂',
          is_active: true,
          sort_order: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'default-2',
          name: 'gestante',
          label: 'Gestante',
          description: 'Ensaio gestante',
          icon: '🤱',
          is_active: true,
          sort_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'default-3',
          name: 'formatura',
          label: 'Formatura',
          description: 'Sessão de formatura',
          icon: '🎓',
          is_active: true,
          sort_order: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const createSessionType = async (sessionType: Omit<SessionTypeData, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('session_types')
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
        .from('session_types')
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
        .from('session_types')
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