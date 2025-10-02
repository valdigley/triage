import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MercadoPagoSettings } from '../types';
import { useTenant } from './useTenant';

export function useMercadoPago() {
  const [settings, setSettings] = useState<MercadoPagoSettings | null>(null);
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
        .from('mercadopago_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setSettings(data || null);
    } catch (err) {
      console.error('Erro ao buscar configurações MercadoPago:', err);
      setError(err instanceof Error ? err.message : 'Falha ao buscar configurações');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<MercadoPagoSettings>) => {
    if (!tenant) return false;

    try {
      if (settings) {
        // Update existing settings
        const { error } = await supabase
          .from('mercadopago_settings')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', settings.id);

        if (error) throw error;

        setSettings(prev => prev ? { ...prev, ...updates } : null);
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from('mercadopago_settings')
          .insert([{
            ...updates,
            tenant_id: tenant.id,
            is_active: true
          }])
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
      }

      return true;
    } catch (err) {
      console.error('Erro ao atualizar configurações MercadoPago:', err);
      setError(err instanceof Error ? err.message : 'Falha ao atualizar configurações');
      return false;
    }
  };

  const getActiveSettings = (): MercadoPagoSettings | null => {
    return settings && settings.is_active ? settings : null;
  };

  const testConnection = async (): Promise<{ success: boolean; message: string }> => {
    const activeSettings = getActiveSettings();
    
    if (!activeSettings || !activeSettings.access_token) {
      return {
        success: false,
        message: 'Configure o Access Token primeiro'
      };
    }

    try {
      setLoading(true);
      
      // Since Edge Functions are not available, we'll validate the token format
      // and provide feedback based on the token structure
      const token = activeSettings.access_token;
      const environment = activeSettings.environment;
      
      // Validate token format
      if (environment === 'sandbox') {
        if (!token.startsWith('TEST-')) {
          return {
            success: false,
            message: 'Token de Sandbox deve começar com "TEST-". Verifique se está usando o token correto para o ambiente Sandbox.'
          };
        }
      } else {
        if (!token.startsWith('APP_USR-')) {
          return {
            success: false,
            message: 'Token de Produção deve começar com "APP_USR-". Verifique se está usando o token correto para o ambiente de Produção.'
          };
        }
      }
      
      // Check token length (MercadoPago tokens have specific lengths)
      if (token.length < 50) {
        return {
          success: false,
          message: 'Token parece estar incompleto. Tokens do MercadoPago têm pelo menos 50 caracteres.'
        };
      }
      
      // If format validation passes, assume it's valid
      return {
        success: true,
        message: `✅ Token validado com sucesso! Ambiente: ${environment}. O token será testado durante o primeiro pagamento real.`
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro na validação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
    error,
    updateSettings,
    getActiveSettings,
    testConnection,
    refetch: fetchSettings
  };
}