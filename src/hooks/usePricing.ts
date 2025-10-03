import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface PricingPlan {
  id: string;
  plan_name: 'monthly' | 'yearly';
  price: number;
  is_active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  applies_to: string[] | null;
}

export interface CouponValidation {
  valid: boolean;
  error?: string;
  coupon_id?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  discount_amount?: number;
  original_price?: number;
  final_price?: number;
}

export function usePricing() {
  const [pricing, setPricing] = useState<Record<string, number>>({
    monthly: 79.90,
    yearly: 799.00
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const { data, error } = await supabase
        .from('triagem_pricing')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      if (data && data.length > 0) {
        const pricingMap: Record<string, number> = {};
        data.forEach((plan: PricingPlan) => {
          pricingMap[plan.plan_name] = plan.price;
        });
        setPricing(pricingMap);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateCoupon = async (
    code: string,
    planName: string,
    originalPrice: number
  ): Promise<CouponValidation> => {
    try {
      const { data, error } = await supabase.rpc('validate_and_apply_coupon', {
        p_code: code,
        p_plan_name: planName,
        p_original_price: originalPrice
      });

      if (error) throw error;

      return data as CouponValidation;
    } catch (error) {
      console.error('Error validating coupon:', error);
      return {
        valid: false,
        error: 'Erro ao validar cupom'
      };
    }
  };

  return {
    pricing,
    loading,
    validateCoupon,
    refetch: fetchPricing
  };
}
