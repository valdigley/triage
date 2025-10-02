import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings } from '../types';
import { useTenant } from './useTenant';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tenant, loading: tenantLoading } = useTenant();

  useEffect(() => {
    if (tenantLoading) return;

    if (tenant) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [tenant, tenantLoading]);

  const fetchSettings = async () => {
    if (!tenant) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: newSettings, error: createError } = await supabase
          .from('settings')
          .insert([{
            tenant_id: tenant.id,
            studio_name: tenant.business_name || tenant.name,
            studio_phone: tenant.phone,
            price_commercial_hour: 150,
            price_after_hours: 200,
            minimum_photos: 5,
            delivery_days: 7,
            link_validity_days: 30,
            cleanup_days: 60,
            commercial_hours: {
              monday: { start: '09:00', end: '18:00' },
              tuesday: { start: '09:00', end: '18:00' },
              wednesday: { start: '09:00', end: '18:00' },
              thursday: { start: '09:00', end: '18:00' },
              friday: { start: '09:00', end: '18:00' },
              saturday: { start: '09:00', end: '13:00' },
              sunday: { start: '', end: '' }
            },
            terms_conditions: 'Termos e condições padrão',
            watermark_enabled: true,
            watermark_text: tenant.business_name || tenant.name,
            watermark_opacity: 0.5,
            watermark_position: 'bottom-right',
            watermark_size: 'medium'
          }])
          .select()
          .single();

        if (createError) throw createError;
        setSettings(newSettings);
      } else {
        setSettings(data);
      }
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