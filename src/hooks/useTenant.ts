import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Tenant, Subscription } from '../types';

export function useTenant() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => {
    fetchTenant();
  }, []);

  const fetchTenant = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Check if master admin
      if (user.email === 'valdigley2007@gmail.com') {
        setIsMasterAdmin(true);
      }

      // Get tenant for current user
      const { data: tenantUsers } = await supabase
        .from('triagem_tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!tenantUsers) {
        setLoading(false);
        return;
      }

      // Fetch tenant details
      const { data: tenantData, error: tenantError } = await supabase
        .from('triagem_tenants')
        .select('*')
        .eq('id', tenantUsers.tenant_id)
        .single();

      if (tenantError) throw tenantError;
      setTenant(tenantData);

      // Fetch active subscription
      const { data: subData } = await supabase
        .from('triagem_subscriptions')
        .select('*')
        .eq('tenant_id', tenantUsers.tenant_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSubscription(subData);
    } catch (err) {
      console.error('Error fetching tenant:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tenant');
    } finally {
      setLoading(false);
    }
  };

  const hasActiveSubscription = (): boolean => {
    if (isMasterAdmin) return true;
    if (!tenant) return false;

    // Check if trial is still valid
    if (tenant.status === 'trial') {
      const trialEndsAt = new Date(tenant.trial_ends_at);
      return trialEndsAt > new Date();
    }

    // Check if has active paid subscription
    if (tenant.status === 'active' && subscription) {
      const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
      return !expiresAt || expiresAt > new Date();
    }

    return false;
  };

  const getDaysUntilExpiration = (): number | null => {
    if (isMasterAdmin) return null;
    if (!tenant) return null;

    if (tenant.status === 'trial') {
      const trialEndsAt = new Date(tenant.trial_ends_at);
      const now = new Date();
      const diff = trialEndsAt.getTime() - now.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    if (subscription && subscription.expires_at) {
      const expiresAt = new Date(subscription.expires_at);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return null;
  };

  return {
    tenant,
    subscription,
    loading,
    error,
    isMasterAdmin,
    hasActiveSubscription: hasActiveSubscription(),
    daysUntilExpiration: getDaysUntilExpiration(),
    refetch: fetchTenant
  };
}
