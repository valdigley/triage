import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Camera, Mail, Lock, User, Phone, Building, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    cpfCnpj: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error('As senhas não coincidem');
      }

      if (formData.password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres');
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            phone: formData.phone
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      // Create tenant with trial
      const { data: tenant, error: tenantError } = await supabase
        .from('triagem_tenants')
        .insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          business_name: formData.businessName || null,
          cpf_cnpj: formData.cpfCnpj || null,
          owner_user_id: authData.user.id,
          status: 'trial',
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }])
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Note: tenant_user is created automatically by database trigger

      // Create default settings for tenant
      const { error: settingsError } = await supabase
        .from('triagem_settings')
        .insert([{
          tenant_id: tenant.id,
          studio_name: formData.businessName || formData.name,
          studio_phone: formData.phone,
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
          watermark_text: formData.businessName || formData.name,
          watermark_opacity: 0.5,
          watermark_position: 'bottom-right',
          watermark_size: 'medium'
        }]);

      if (settingsError) throw settingsError;

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Cadastro Concluído!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Sua conta foi criada com sucesso!
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
              🎉 Trial Grátis de 7 Dias Ativado!
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Você tem acesso completo ao sistema por 7 dias. Após este período, escolha um plano para continuar usando.
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecionando para o sistema...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Camera className="h-12 w-12 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Criar Conta
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          7 dias grátis para testar o sistema completo
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nome Completo *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="João Silva"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="seu@email.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Telefone *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nome do Estúdio/Empresa
          </label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Foto Studio"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            CPF ou CNPJ
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={formData.cpfCnpj}
              onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="000.000.000-00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Senha *
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Confirmar Senha *
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Digite a senha novamente"
            />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Incluso no trial:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-300">
            <li>✓ Acesso completo por 7 dias</li>
            <li>✓ Galeria de fotos ilimitadas</li>
            <li>✓ Sistema de pagamentos</li>
            <li>✓ WhatsApp integrado</li>
            <li>✓ Agendamentos online</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Criando conta...' : 'Criar Conta Grátis'}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Já tem uma conta? Fazer login
          </button>
        </div>
      </form>
    </div>
  );
}
