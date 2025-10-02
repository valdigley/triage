import React, { useState, useRef, useEffect } from 'react';
import { Save, Upload, TestTube, Check, X, AlertCircle, Camera, MessageSquare, CreditCard, Palette, Clock, Shield, Smartphone, Eye, EyeOff, Calendar } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useSessionTypes } from '../../hooks/useSessionTypes';
import { useMercadoPago } from '../../hooks/useMercadoPago';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { useNotifications } from '../../hooks/useNotifications';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';
import { useTenant } from '../../hooks/useTenant';
import { useGlobalSettings } from '../../hooks/useGlobalSettings';
import { supabase } from '../../lib/supabase';
import { CommercialHours, SessionTypeData, NotificationTemplate } from '../../types';

export function SettingsView() {
  const { settings, updateSettings } = useSettings();
  const { sessionTypes, createSessionType, updateSessionType, deleteSessionType, toggleSessionTypeStatus } = useSessionTypes();
  const { settings: mpSettings, updateSettings: updateMPSettings, testConnection } = useMercadoPago();
  const { instances, getQRCode, testConnection: testWhatsAppConnection, sendTestMessage, refetch: refetchWhatsApp } = useWhatsApp();
  const { templates, updateTemplate } = useNotifications();
  const { tenant } = useTenant();
  const { settings: globalSettings } = useGlobalSettings();
  const {
    settings: googleCalendarSettings,
    loading: googleCalendarLoading,
    error: googleCalendarError,
    saveSettings: saveGoogleCalendarSettings,
    updateSettings: updateGoogleCalendarSettings,
    testConnection: testGoogleCalendarConnection
  } = useGoogleCalendar();
  
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(0);
  const qrIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  // Session Types form state
  const [newSessionType, setNewSessionType] = useState({
    name: '',
    label: '',
    description: '',
    icon: '📸'
  });

  // WhatsApp form state
  const [whatsappSettings, setWhatsappSettings] = useState({
    evolution_api_url: '',
    evolution_api_key: '',
    instance_name: ''
  });

  // Generate instance name from studio phone
  const generateInstanceName = (phone: string) => {
    // Remove all non-numeric characters
    const cleanPhone = phone.replace(/\D/g, '');
    // Use phone as prefix for instance name
    return `studio_${cleanPhone}`;
  };

  // Google Calendar form state (campo único para JSON)
  const [googleCalendarForm, setGoogleCalendarForm] = useState({
    calendar_id: '',
    service_account_json: ''
  });

  // Update form when Google Calendar settings change
  useEffect(() => {
    if (googleCalendarSettings) {
      setGoogleCalendarForm({
        calendar_id: googleCalendarSettings.calendar_id || '',
        service_account_json: '' // Não mostrar o JSON por segurança
      });
    }
  }, [googleCalendarSettings]);

  // Get active WhatsApp instance data
  const activeWhatsAppInstance = instances.find(instance => 
    instance.status === 'connected' || instance.status === 'created'
  ) || instances[0];

  // Update form when active instance changes or settings change
  useEffect(() => {
    if (activeWhatsAppInstance) {
      setWhatsappSettings({
        evolution_api_url: activeWhatsAppInstance.instance_data.evolution_api_url || '',
        evolution_api_key: activeWhatsAppInstance.instance_data.evolution_api_key || '',
        instance_name: activeWhatsAppInstance.instance_name || ''
      });
    } else if (settings?.studio_phone) {
      // If no instance exists, generate name from studio phone
      setWhatsappSettings(prev => ({
        ...prev,
        instance_name: generateInstanceName(settings.studio_phone)
      }));
    }
  }, [activeWhatsAppInstance, settings?.studio_phone]);
  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const success = await updateSettings(settings);
      if (success) {
        alert('Configurações salvas com sucesso!');
      } else {
        alert('Erro ao salvar configurações.');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !settings) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB.');
      return;
    }

    setUploadingLogo(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `studio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      // Update settings
      await updateSettings({
        studio_logo_url: urlData.publicUrl
      });

      alert('Logo atualizado com sucesso!');
    } catch (error) {
      console.error('Erro no upload do logo:', error);
      alert('Erro ao fazer upload do logo.');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleWatermarkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !settings) return;

    // Validate file type (PNG only for transparency)
    if (file.type !== 'image/png') {
      alert('Por favor, selecione apenas arquivos PNG para a marca d\'água.');
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('A marca d\'água deve ter no máximo 5MB.');
      return;
    }

    setUploadingWatermark(true);
    try {
      // Upload to Supabase Storage
      const fileName = `watermark-${Date.now()}.png`;
      const filePath = `studio/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      // Update settings
      await updateSettings({
        watermark_image_url: urlData.publicUrl
      });

      alert('Marca d\'água atualizada com sucesso!');
    } catch (error) {
      console.error('Erro no upload da marca d\'água:', error);
      alert('Erro ao fazer upload da marca d\'água.');
    } finally {
      setUploadingWatermark(false);
      if (watermarkInputRef.current) {
        watermarkInputRef.current.value = '';
      }
    }
  };

  const handleTestMercadoPago = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Erro ao testar conexão'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await testWhatsAppConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Erro ao testar conexão WhatsApp'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestMessage = async () => {
    console.log('📋 Settings completo:', settings);
    console.log('📞 Telefone do estúdio:', settings?.studio_phone);

    if (!settings?.studio_phone) {
      setTestResult({
        success: false,
        message: 'Configure o telefone do estúdio primeiro em Configurações Gerais'
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await sendTestMessage(settings.studio_phone);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Erro ao enviar mensagem de teste'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCreateSessionType = async () => {
    if (!newSessionType.name || !newSessionType.label) {
      alert('Nome e rótulo são obrigatórios');
      return;
    }

    try {
      await createSessionType({
        ...newSessionType,
        sort_order: sessionTypes.length
      });
      setNewSessionType({
        name: '',
        label: '',
        description: '',
        icon: '📸'
      });
      alert('Tipo de sessão criado com sucesso!');
    } catch (error) {
      alert('Erro ao criar tipo de sessão');
    }
  };

  const saveWhatsAppSettings = async () => {
    if (!globalSettings?.evolution_api_url || !globalSettings?.evolution_api_key) {
      alert('Configurações globais da Evolution API não encontradas. Entre em contato com o administrador.');
      return;
    }

    if (!settings?.studio_phone) {
      alert('Configure o telefone do estúdio nas configurações gerais primeiro');
      return;
    }

    if (!tenant) {
      alert('Erro: Tenant não encontrado');
      return;
    }

    setSaving(true);
    try {
      // Generate unique instance name from studio phone
      const instanceName = generateInstanceName(settings.studio_phone);

      // Use upsert to handle both create and update
      const { error } = await supabase
        .from('triagem_whatsapp_instances')
        .upsert({
          tenant_id: tenant.id,
          instance_name: instanceName,
          status: 'created',
          instance_data: {
            evolution_api_url: globalSettings.evolution_api_url,
            evolution_api_key: globalSettings.evolution_api_key,
            saved_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'instance_name',
          ignoreDuplicates: false
        });

      if (error) throw error;

      alert('Configurações do WhatsApp salvas com sucesso!');

      // Refresh instances to get updated data
      await refetchWhatsApp();
    } catch (error) {
      console.error('Erro ao salvar WhatsApp:', error);
      alert('Erro ao salvar configurações do WhatsApp');
    } finally {
      setSaving(false);
    }
  };

  const checkConnectionStatus = async () => {
    if (!activeWhatsAppInstance) return false;

    const { evolution_api_url, evolution_api_key } = activeWhatsAppInstance.instance_data;

    if (!evolution_api_url || !evolution_api_key) return false;

    try {
      const response = await fetch(`${evolution_api_url}/instance/connectionState/${activeWhatsAppInstance.instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': evolution_api_key,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        return result.state === 'open';
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
    return false;
  };

  const handleGenerateQR = async () => {
    if (!settings?.studio_phone) {
      alert('Configure o telefone do estúdio nas configurações gerais primeiro');
      return;
    }

    if (!globalSettings?.evolution_api_url || !globalSettings?.evolution_api_key) {
      alert('Configurações globais da Evolution API não encontradas. Entre em contato com o administrador.');
      return;
    }

    setLoadingQR(true);
    setQrCode(null);
    setQrCountdown(15);

    try {
      console.log('🔄 Salvando configurações WhatsApp...');
      await saveWhatsAppSettings();

      console.log('🔄 Recarregando instâncias...');
      await refetchWhatsApp();

      console.log('📱 Gerando QR Code...');
      const result = await getQRCode();

      console.log('📊 Resultado:', result);

      if (result.success && result.qrCode) {
        setQrCode(result.qrCode);

        if (qrIntervalRef.current) {
          clearInterval(qrIntervalRef.current);
        }

        let countdown = 15;
        qrIntervalRef.current = setInterval(async () => {
          countdown--;
          setQrCountdown(countdown);

          const isConnected = await checkConnectionStatus();

          if (isConnected) {
            if (qrIntervalRef.current) {
              clearInterval(qrIntervalRef.current);
            }
            setQrCode(null);
            setQrCountdown(0);

            if (settings.studio_phone) {
              await sendTestMessage(settings.studio_phone);
              alert('WhatsApp conectado com sucesso! Uma mensagem de teste foi enviada.');
            }

            await refetchWhatsApp();
          } else if (countdown <= 0) {
            if (qrIntervalRef.current) {
              clearInterval(qrIntervalRef.current);
            }
            setQrCode(null);
            setQrCountdown(0);
          }
        }, 1000);
      } else if (result.message === 'WhatsApp já está conectado') {
        alert('WhatsApp já está conectado!');
        await refetchWhatsApp();
      } else {
        alert(`Erro ao gerar QR Code: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Erro ao gerar QR Code:', error);
      alert('Erro ao gerar QR Code');
    } finally {
      setLoadingQR(false);
    }
  };

  const handleDeleteInstance = async () => {
    if (!activeWhatsAppInstance) return;

    if (!confirm('Tem certeza que deseja excluir esta instância do WhatsApp?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('triagem_whatsapp_instances')
        .delete()
        .eq('id', activeWhatsAppInstance.id);

      if (error) throw error;

      alert('Instância excluída com sucesso!');
      setQrCode(null);
      await refetchWhatsApp();
    } catch (error) {
      console.error('Erro ao excluir instância:', error);
      alert('Erro ao excluir instância');
    }
  };

  useEffect(() => {
    return () => {
      if (qrIntervalRef.current) {
        clearInterval(qrIntervalRef.current);
      }
    };
  }, []);

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'Geral', icon: Camera },
    { id: 'pricing', label: 'Preços', icon: CreditCard },
    { id: 'watermark', label: 'Marca d\'água', icon: Palette },
    { id: 'sessions', label: 'Tipos de Sessão', icon: Camera },
    { id: 'notifications', label: 'Notificações', icon: MessageSquare },
    { id: 'google-calendar', label: 'Google Calendar', icon: Calendar },
    { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
    { id: 'mercadopago', label: 'MercadoPago', icon: CreditCard },
    { id: 'security', label: 'Segurança', icon: Shield }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{saving ? 'Salvando...' : 'Salvar'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações Gerais</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Estúdio
                </label>
                <input
                  type="text"
                  value={settings.studio_name}
                  onChange={(e) => updateSettings({ studio_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telefone do Estúdio
                </label>
                <input
                  type="tel"
                  value={settings.studio_phone ?? ''}
                  onChange={(e) => updateSettings({ studio_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL do Aplicativo
                </label>
                <input
                  type="url"
                  value={settings.app_url ?? ''}
                  onChange={(e) => updateSettings({ app_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://triagem.online"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  URL base do seu aplicativo (necessário para preview de links no WhatsApp)
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Endereço do Estúdio
                </label>
                <input
                  type="text"
                  value={settings.studio_address}
                  onChange={(e) => updateSettings({ studio_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL do Google Maps
                </label>
                <input
                  type="url"
                  value={settings.studio_maps_url}
                  onChange={(e) => updateSettings({ studio_maps_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://maps.google.com/?q=..."
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Logo do Estúdio
              </label>
              <div className="flex items-center space-x-4">
                {settings.studio_logo_url && (
                  <img
                    src={settings.studio_logo_url}
                    alt="Logo atual"
                    className="h-16 w-16 object-contain border border-gray-300 rounded"
                  />
                )}
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {uploadingLogo ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>{uploadingLogo ? 'Enviando...' : 'Enviar Logo'}</span>
                  </button>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG até 2MB</p>
                </div>
              </div>
            </div>

            {/* Delivery Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fotos Mínimas
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.minimum_photos}
                  onChange={(e) => updateSettings({ minimum_photos: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prazo de Entrega (dias)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.delivery_days}
                  onChange={(e) => updateSettings({ delivery_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Validade do Link (dias)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.link_validity_days}
                  onChange={(e) => updateSettings({ link_validity_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações de Preços</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preço Horário Comercial (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.price_commercial_hour}
                  onChange={(e) => updateSettings({ price_commercial_hour: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preço Fora do Horário (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.price_after_hours}
                  onChange={(e) => updateSettings({ price_after_hours: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Commercial Hours */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">Horário Comercial</h3>
              <div className="space-y-4">
                {[
                  ['monday', 'Segunda'],
                  ['tuesday', 'Terça'],
                  ['wednesday', 'Quarta'],
                  ['thursday', 'Quinta'],
                  ['friday', 'Sexta'],
                  ['saturday', 'Sábado'],
                  ['sunday', 'Domingo']
                ].map(([day, dayLabel]) => {
                  const schedule = settings.commercial_hours[day as keyof CommercialHours];
                  return (
                  <div key={day} className="flex items-center space-x-4">
                    <div className="w-24">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={schedule.enabled}
                          onChange={(e) => updateSettings({
                            commercial_hours: {
                              ...settings.commercial_hours,
                              [day]: { ...schedule, enabled: e.target.checked }
                            }
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {dayLabel}
                        </span>
                      </label>
                    </div>
                    
                    {schedule.enabled && (
                      <>
                        <input
                          type="time"
                          value={schedule.start}
                          onChange={(e) => updateSettings({
                            commercial_hours: {
                              ...settings.commercial_hours,
                              [day]: { ...schedule, start: e.target.value }
                            }
                          })}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-500">até</span>
                        <input
                          type="time"
                          value={schedule.end}
                          onChange={(e) => updateSettings({
                            commercial_hours: {
                              ...settings.commercial_hours,
                              [day]: { ...schedule, end: e.target.value }
                            }
                          })}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Watermark Tab */}
        {activeTab === 'watermark' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações de Marca d'água</h2>
            
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="watermark-enabled"
                checked={settings.watermark_enabled}
                onChange={(e) => updateSettings({ watermark_enabled: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="watermark-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ativar marca d'água nas fotos
              </label>
            </div>

            {settings.watermark_enabled && (
              <div className="space-y-6">
                {/* Watermark Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Imagem da Marca d'água (PNG)
                  </label>
                  <div className="flex items-center space-x-4">
                    {settings.watermark_image_url && (
                      <div className="relative">
                        <img
                          src={settings.watermark_image_url}
                          alt="Marca d'água atual"
                          className="h-16 w-16 object-contain border border-gray-300 rounded bg-white"
                        />
                        <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center text-gray-700 text-xs font-medium rounded pointer-events-none">
                          <span className="bg-white bg-opacity-80 px-1 rounded">PNG</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <input
                        ref={watermarkInputRef}
                        type="file"
                        accept="image/png"
                        onChange={handleWatermarkUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => watermarkInputRef.current?.click()}
                        disabled={uploadingWatermark}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      >
                        {uploadingWatermark ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        <span>{uploadingWatermark ? 'Enviando...' : 'Enviar PNG'}</span>
                      </button>
                      <p className="text-xs text-gray-500 mt-1">PNG com transparência, máximo 1MB</p>
                      <p className="text-xs text-gray-500 mt-1">PNG com transparência, máximo 5MB</p>
                    </div>
                  </div>
                </div>

                {/* Fallback Text Watermark */}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Opacidade
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={settings.watermark_opacity}
                      onChange={(e) => updateSettings({ watermark_opacity: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <span className="text-sm text-gray-500">{Math.round(settings.watermark_opacity * 100)}%</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Posição
                    </label>
                    <select
                      value={settings.watermark_position}
                      onChange={(e) => updateSettings({ watermark_position: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="center">Centro</option>
                      <option value="top-left">Superior Esquerda</option>
                      <option value="top-right">Superior Direita</option>
                      <option value="bottom-left">Inferior Esquerda</option>
                      <option value="bottom-right">Superior Direita</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tamanho
                    </label>
                    <select
                      value={settings.watermark_size}
                      onChange={(e) => updateSettings({ watermark_size: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="small">Pequeno</option>
                      <option value="medium">Médio</option>
                      <option value="large">Grande</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session Types Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Tipos de Sessão</h2>
            
            {/* Create New Session Type */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">Criar Novo Tipo</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Nome (ex: aniversario)"
                  value={newSessionType.name}
                  onChange={(e) => setNewSessionType(prev => ({ ...prev, name: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Rótulo (ex: Aniversário)"
                  value={newSessionType.label}
                  onChange={(e) => setNewSessionType(prev => ({ ...prev, label: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Ícone (ex: 🎂)"
                  value={newSessionType.icon}
                  onChange={(e) => setNewSessionType(prev => ({ ...prev, icon: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleCreateSessionType}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Criar
                </button>
              </div>
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={newSessionType.description}
                onChange={(e) => setNewSessionType(prev => ({ ...prev, description: e.target.value }))}
                className="w-full mt-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Existing Session Types */}
            <div className="space-y-4">
              {sessionTypes.map((sessionType) => (
                <div key={sessionType.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">{sessionType.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white">{sessionType.label}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{sessionType.name}</p>
                      {sessionType.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-500">{sessionType.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleSessionTypeStatus(sessionType.id, !sessionType.is_active)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        sessionType.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {sessionType.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                    <button
                      onClick={() => deleteSessionType(sessionType.id)}
                      className="text-red-600 hover:text-red-800 px-2 py-1"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Templates de Notificação</h2>
            
            <div className="space-y-6">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-800 dark:text-white">{template.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Tipo: {template.type}</p>
                    </div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={template.is_active}
                        onChange={(e) => updateTemplate(template.id, { is_active: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Ativo</span>
                    </label>
                  </div>
                  
                  <textarea
                    value={template.message_template}
                    onChange={(e) => updateTemplate(template.id, { message_template: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="Template da mensagem..."
                  />
                  
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {"Variáveis disponíveis: {{client_name}}, {{amount}}, {{session_type}}, {{appointment_date}}, {{appointment_time}}, {{studio_address}}, {{studio_maps_url}}, {{delivery_days}}, {{price_per_photo}}, {{minimum_photos}}, {{selected_count}}, {{extra_photos}}, {{extra_cost}}, {{gallery_link}}, {{studio_name}}, {{studio_phone}}"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Google Calendar Tab */}
        {activeTab === 'google-calendar' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Integração Google Calendar</h2>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Como Configurar</h3>
              <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-decimal list-inside">
                <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                <li>Crie um projeto e ative a <strong>Google Calendar API</strong></li>
                <li>Crie uma <strong>Service Account</strong> em IAM & Admin</li>
                <li>Gere uma chave JSON para a Service Account</li>
                <li>Compartilhe seu calendário com o email da Service Account</li>
                <li>Cole as informações abaixo</li>
              </ol>
            </div>

            {googleCalendarSettings && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-800 dark:text-green-200">
                    Google Calendar configurado e ativo
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Calendar ID *
                </label>
                <input
                  type="text"
                  value={googleCalendarForm.calendar_id}
                  onChange={(e) => setGoogleCalendarForm(prev => ({ ...prev, calendar_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="seu-email@gmail.com"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Encontre em: Configurações do Calendário → Integrar calendário
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 dark:text-white mb-3">Service Account JSON</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Cole aqui o conteúdo completo do arquivo JSON baixado do Google Cloud Console
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Arquivo JSON da Service Account *
                  </label>
                  <textarea
                    value={googleCalendarForm.service_account_json}
                    onChange={(e) => setGoogleCalendarForm(prev => ({ ...prev, service_account_json: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs"
                    placeholder='{&#10;  "type": "service_account",&#10;  "project_id": "seu-projeto",&#10;  "private_key_id": "abc123...",&#10;  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",&#10;  "client_email": "conta@projeto.iam.gserviceaccount.com",&#10;  "client_id": "123456789",&#10;  ...&#10;}'
                    rows={12}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Cole o arquivo JSON completo. Todos os campos serão extraídos automaticamente.
                    {googleCalendarSettings && !googleCalendarForm.service_account_json && (
                      <span className="block mt-1 text-yellow-600 dark:text-yellow-400">
                        Deixe em branco para manter as credenciais atuais
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={async () => {
                    setSaving(true);
                    setTestResult(null);
                    try {
                      // Validar JSON antes de enviar (apenas estrutura básica)
                      if (googleCalendarForm.service_account_json) {
                        try {
                          JSON.parse(googleCalendarForm.service_account_json);
                        } catch (error) {
                          setTestResult({
                            success: false,
                            message: 'JSON inválido. Verifique o formato e tente novamente.'
                          });
                          setSaving(false);
                          return;
                        }
                      }

                      // Enviar JSON original para o backend processar
                      const success = await saveGoogleCalendarSettings(
                        googleCalendarForm.calendar_id,
                        googleCalendarForm.service_account_json || undefined
                      );

                      if (success) {
                        setTestResult({ success: true, message: 'Configurações salvas com sucesso!' });
                        // Limpar JSON do formulário por segurança
                        setGoogleCalendarForm(prev => ({ ...prev, service_account_json: '' }));
                      } else {
                        const errorMsg = googleCalendarError || 'Erro ao salvar configurações.';
                        setTestResult({ success: false, message: errorMsg });
                      }
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={
                    saving ||
                    !googleCalendarForm.calendar_id ||
                    (!googleCalendarSettings && !googleCalendarForm.service_account_json)
                  }
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{googleCalendarSettings ? 'Atualizar' : 'Salvar'}</span>
                </button>

                <button
                  onClick={async () => {
                    setTesting(true);
                    setTestResult(null);
                    const result = await testGoogleCalendarConnection();
                    setTestResult(result);
                    setTesting(false);
                  }}
                  disabled={testing || !googleCalendarSettings}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {testing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  <span>Testar Conexão</span>
                </button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-start space-x-2">
                    {testResult.success ? (
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <p className={`text-sm ${
                      testResult.success
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {testResult.message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Importante</h3>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
                <li>A Service Account Key contém informações sensíveis. Mantenha-a segura.</li>
                <li>Certifique-se de compartilhar o calendário com o email da Service Account.</li>
                <li>A permissão mínima necessária é "Ver todos os detalhes do evento".</li>
                <li>O sistema verificará automaticamente a disponibilidade antes de cada agendamento.</li>
              </ul>
            </div>
          </div>
        )}

        {/* WhatsApp Tab */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações WhatsApp</h2>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-green-800 dark:text-green-200 mb-1">Instância Única por Estúdio</h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Cada estúdio possui sua própria instância WhatsApp, gerada automaticamente a partir do telefone configurado.
                    Isso garante que cada usuário utilize seu próprio número de WhatsApp de forma isolada.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Evolution API</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Configure sua instância da Evolution API para envio automático de mensagens WhatsApp.
              </p>
              {activeWhatsAppInstance && (
                <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Instância ativa:</strong> {activeWhatsAppInstance.instance_name} 
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                      activeWhatsAppInstance.status === 'connected' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {activeWhatsAppInstance.status}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              {!activeWhatsAppInstance ? (
                <button
                  onClick={handleGenerateQR}
                  disabled={loadingQR || !globalSettings}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {loadingQR ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Smartphone className="h-4 w-4" />
                  )}
                  <span>{loadingQR ? 'Conectando...' : 'Conectar WhatsApp'}</span>
                </button>
              ) : (
                <button
                  onClick={handleDeleteInstance}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span>Excluir Instância</span>
                </button>
              )}
            </div>

            {/* QR Code Display */}
            {qrCode && (
              <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 text-center">
                  Escaneie o QR Code com o WhatsApp do Estúdio
                </h3>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                  QR Code válido por {qrCountdown} segundos
                </p>
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg shadow-lg">
                    <img
                      src={qrCode}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64"
                    />
                  </div>
                  <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400 max-w-md">
                    <p className="mb-2">
                      1. Abra o WhatsApp no celular do estúdio
                    </p>
                    <p className="mb-2">
                      2. Toque em "Mais opções" ou "Configurações"
                    </p>
                    <p className="mb-2">
                      3. Selecione "Aparelhos conectados"
                    </p>
                    <p>
                      4. Toque em "Conectar um aparelho" e escaneie este QR Code
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MercadoPago Tab */}
        {activeTab === 'mercadopago' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações MercadoPago</h2>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Importante</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Configure suas credenciais do MercadoPago para processar pagamentos PIX automaticamente.
              </p>
            </div>

            {/* Webhook URL Display */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-3">URL do Webhook</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                Configure esta URL no painel do MercadoPago para receber notificações de pagamento:
              </p>
              <div className="bg-white dark:bg-gray-700 border border-blue-200 dark:border-gray-600 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">
                    {import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-webhook
                  </code>
                  <button
                    onClick={() => {
                      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-webhook`;
                      navigator.clipboard.writeText(webhookUrl);
                      alert('URL do webhook copiada para a área de transferência!');
                    }}
                    className="ml-3 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors flex-shrink-0"
                  >
                    Copiar
                  </button>
                </div>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <p><strong>Como configurar:</strong></p>
                <p>1. Acesse o painel do MercadoPago → Integrações → Webhooks</p>
                <p>2. Clique em "Criar webhook"</p>
                <p>3. Cole a URL acima no campo "URL de notificação"</p>
                <p>4. Selecione os eventos: "Pagamentos" e "Merchant Orders"</p>
                <p>5. Salve a configuração</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Access Token
                </label>
                <div className="relative">
                  <input
                    type={showAccessToken ? 'text' : 'password'}
                    value={mpSettings?.access_token ?? ''}
                    onChange={(e) => updateMPSettings({ access_token: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="APP_USR-... ou TEST-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessToken(!showAccessToken)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Public Key
                </label>
                <input
                  type="text"
                  value={mpSettings?.public_key ?? ''}
                  onChange={(e) => updateMPSettings({ public_key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="APP_USR-... ou TEST-..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ambiente
                </label>
                <select
                  value={mpSettings?.environment ?? 'sandbox'}
                  onChange={(e) => updateMPSettings({ environment: e.target.value as 'sandbox' | 'production' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="sandbox">Sandbox (Testes)</option>
                  <option value="production">Produção</option>
                </select>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleTestMercadoPago}
                  disabled={testing}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {testing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações de Segurança</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Termos e Condições
              </label>
              <textarea
                value={settings.terms_conditions}
                onChange={(e) => updateSettings({ terms_conditions: e.target.value })}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Digite os termos e condições do serviço..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Limpeza Automática (dias)
              </label>
              <input
                type="number"
                min="1"
                value={settings.cleanup_days}
                onChange={(e) => updateSettings({ cleanup_days: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Apenas as fotos originais serão removidas automaticamente após este período para liberar espaço. Thumbnails, dados de sessões, pagamentos e clientes permanecerão.
              </p>
            </div>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            testResult.success 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center">
              {testResult.success ? (
                <Check className="h-5 w-5 text-green-600 mr-2" />
              ) : (
                <X className="h-5 w-5 text-red-600 mr-2" />
              )}
              <p className={`text-sm ${
                testResult.success 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {testResult.message}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}