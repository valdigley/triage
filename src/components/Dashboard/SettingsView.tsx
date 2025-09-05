import React, { useState, useEffect } from 'react';
import { Save, TestTube, Wifi, WifiOff, Settings as SettingsIcon, Phone, MapPin, Clock, DollarSign, Moon, Sun, Upload, Image, Eye } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useSessionTypes } from '../../hooks/useSessionTypes';
import { useMercadoPago } from '../../hooks/useMercadoPago';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { useNotifications } from '../../hooks/useNotifications';
import { useTheme } from '../../contexts/ThemeContext';
import { Settings, SessionTypeData, CommercialHours } from '../../types';

export function SettingsView() {
  const { settings, loading, error, updateSettings } = useSettings();
  const { sessionTypes, createSessionType, updateSessionType, deleteSessionType, toggleSessionTypeStatus } = useSessionTypes();
  const { settings: mpSettings, updateSettings: updateMPSettings, testConnection } = useMercadoPago();
  const { instances, getActiveInstance, sendMessage, testConnection: testWhatsAppConnection } = useWhatsApp();
  const { templates, updateTemplate, processNotificationQueue } = useNotifications();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingMessage, setTestingMessage] = useState(false);
  const [testMessageResult, setTestMessageResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testingWhatsAppConnection, setTestingWhatsAppConnection] = useState(false);
  const [whatsAppConnectionResult, setWhatsAppConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [whatsappSettings, setWhatsappSettings] = useState({
    evolution_api_url: '',
    evolution_api_key: '',
    instance_name: ''
  });
  const [newSessionType, setNewSessionType] = useState({
    name: '',
    label: '',
    description: '',
    icon: '📸',
    is_active: true,
    sort_order: 0
  });
  const [processingQueue, setProcessingQueue] = useState(false);
  const [queueResult, setQueueResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Initialize logo preview
  useEffect(() => {
    if (localSettings?.studio_logo_url) {
      setLogoPreview(localSettings.studio_logo_url);
    }
  }, [localSettings?.studio_logo_url]);

  // Initialize localSettings when settings are loaded
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Load WhatsApp settings from active instance
  useEffect(() => {
    const activeInstance = getActiveInstance();
    if (activeInstance) {
      setWhatsappSettings({
        evolution_api_url: activeInstance.instance_data.evolution_api_url || '',
        evolution_api_key: activeInstance.instance_data.evolution_api_key || '',
        instance_name: activeInstance.instance_name || ''
      });
    }
  }, [instances]);

  const updateLocalSetting = (key: keyof Settings, value: any) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        [key]: value
      });
    }
  };

  const handleSave = async () => {
    if (!localSettings) return;
    
    setSaving(true);
    try {
      const success = await updateSettings(localSettings);
      if (success) {
        alert('Configurações salvas com sucesso!');
      } else {
        alert('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const { supabase } = await import('../../lib/supabase');
      
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
      updateLocalSetting('studio_logo_url', urlData.publicUrl);
      setLogoPreview(urlData.publicUrl);
      
      alert('Logo carregada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload da logo:', error);
      alert('Erro ao carregar logo. Tente novamente.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    
    try {
      const result = await testConnection();
      setConnectionResult(result);
    } catch (error) {
      setConnectionResult({
        success: false,
        message: 'Erro ao testar conexão'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone.trim()) {
      setTestMessageResult({
        success: false,
        message: 'Digite um número de telefone para teste'
      });
      return;
    }

    setTestingMessage(true);
    setTestMessageResult(null);

    try {
      const testMessage = `🧪 *Teste de Mensagem*\n\nOlá! Esta é uma mensagem de teste do sistema de agendamento do estúdio.\n\nSe você recebeu esta mensagem, significa que a integração WhatsApp está funcionando corretamente! ✅\n\n_Mensagem automática de teste_`;
      
      const success = await sendMessage(testPhone, testMessage);
      
      setTestMessageResult({
        success,
        message: success 
          ? '✅ Mensagem de teste enviada com sucesso!' 
          : '❌ Erro ao enviar mensagem de teste. Verifique as configurações.'
      });
    } catch (error) {
      setTestMessageResult({
        success: false,
        message: `Erro ao enviar mensagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    } finally {
      setTestingMessage(false);
    }
  };

  const handleTestWhatsAppConnection = async () => {
    setTestingWhatsAppConnection(true);
    setWhatsAppConnectionResult(null);
    
    try {
      const result = await testWhatsAppConnection();
      setWhatsAppConnectionResult(result);
    } catch (error) {
      setWhatsAppConnectionResult({
        success: false,
        message: 'Erro ao testar conexão WhatsApp'
      });
    } finally {
      setTestingWhatsAppConnection(false);
    }
  };

  const handleSaveWhatsAppSettings = async () => {
    try {
      const { supabase } = await import('../../lib/supabase');
      
      const activeInstance = getActiveInstance();
      
      if (activeInstance) {
        // Update existing instance
        const { error } = await supabase
          .from('whatsapp_instances')
          .update({
            instance_name: whatsappSettings.instance_name,
            instance_data: {
              ...activeInstance.instance_data,
              evolution_api_url: whatsappSettings.evolution_api_url,
              evolution_api_key: whatsappSettings.evolution_api_key,
              saved_at: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', activeInstance.id);

        if (error) throw error;
      } else {
        // Create new instance
        const { error } = await supabase
          .from('whatsapp_instances')
          .insert({
            instance_name: whatsappSettings.instance_name,
            status: 'created',
            instance_data: {
              evolution_api_url: whatsappSettings.evolution_api_url,
              evolution_api_key: whatsappSettings.evolution_api_key,
              saved_at: new Date().toISOString()
            }
          });

        if (error) throw error;
      }
      
      alert('Configurações do WhatsApp salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações WhatsApp:', error);
      alert('Erro ao salvar configurações do WhatsApp');
    }
  };

  const handleCreateSessionType = async () => {
    try {
      await createSessionType(newSessionType);
      setNewSessionType({
        name: '',
        label: '',
        description: '',
        icon: '📸',
        is_active: true,
        sort_order: 0
      });
      alert('Tipo de sessão criado com sucesso!');
    } catch (error) {
      alert('Erro ao criar tipo de sessão');
    }
  };

  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    setQueueResult(null);
    
    try {
      const success = await processNotificationQueue();
      
      if (success) {
        setQueueResult({
          success: true,
          message: '✅ Fila de notificações processada com sucesso!'
        });
      } else {
        setQueueResult({
          success: false,
          message: '❌ Erro ao processar fila de notificações'
        });
      }
    } catch (error) {
      setQueueResult({
        success: false,
        message: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    } finally {
      setProcessingQueue(false);
    }
  };

  if (loading || !localSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'Geral', icon: SettingsIcon },
    { id: 'branding', label: 'Marca', icon: Image },
    { id: 'pricing', label: 'Preços', icon: DollarSign },
    { id: 'sessions', label: 'Tipos de Sessão', icon: Clock },
    { id: 'notifications', label: 'Avisos', icon: Phone },
    { id: 'whatsapp', label: 'WhatsApp', icon: Phone },
    { id: 'mercadopago', label: 'MercadoPago', icon: TestTube },
    { id: 'appearance', label: 'Aparência', icon: isDarkMode ? Sun : Moon }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Salvar</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* General Settings */}
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
                    value={localSettings.studio_name || ''}
                    onChange={(e) => updateLocalSetting('studio_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Nome do seu estúdio"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefone do Estúdio
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <input
                      type="tel"
                      value={localSettings.studio_phone || ''}
                      onChange={(e) => updateLocalSetting('studio_phone', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Endereço do Estúdio
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      value={localSettings.studio_address || ''}
                      onChange={(e) => updateLocalSetting('studio_address', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Rua das Flores, 123 - Centro, São Paulo - SP"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Link do Google Maps
                  </label>
                  <input
                    type="url"
                    value={localSettings.studio_maps_url || ''}
                    onChange={(e) => updateLocalSetting('studio_maps_url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="https://maps.google.com/?q=..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Termos e Condições
                </label>
                <textarea
                  value={localSettings.terms_conditions || ''}
                  onChange={(e) => updateLocalSetting('terms_conditions', e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Digite os termos e condições do serviço..."
                />
              </div>
            </div>
          )}

          {/* Branding Settings */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações de Marca</h2>
              
              {/* Studio Logo */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">Logo do Estúdio</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Logo Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Carregar Logo
                    </label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file);
                        }}
                        className="hidden"
                        id="logo-upload"
                        disabled={uploadingLogo}
                      />
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        {uploadingLogo ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                        ) : (
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {uploadingLogo ? 'Carregando...' : 'Clique para carregar logo'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          PNG, JPG, SVG • Máximo 5MB
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* Logo Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Preview da Logo
                    </label>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-700 min-h-[120px] flex items-center justify-center">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo do estúdio"
                          className="max-h-20 max-w-full object-contain"
                          onError={() => setLogoPreview(null)}
                        />
                      ) : (
                        <div className="text-center">
                          <Image className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma logo carregada</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Logo URL Input (alternative) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ou insira URL da Logo
                  </label>
                  <input
                    type="url"
                    value={localSettings.studio_logo_url || ''}
                    onChange={(e) => {
                      updateLocalSetting('studio_logo_url', e.target.value);
                      setLogoPreview(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
              </div>

              {/* Watermark Settings */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6 space-y-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">Marca d'Água nas Fotos</h3>
                
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="watermark-enabled"
                    checked={localSettings.watermark_enabled || false}
                    onChange={(e) => updateLocalSetting('watermark_enabled', e.target.checked)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                  <label htmlFor="watermark-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ativar marca d'água nas fotos de seleção
                  </label>
                </div>

                {localSettings.watermark_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Texto da Marca d'Água
                      </label>
                      <input
                        type="text"
                        value={localSettings.watermark_text || 'Preview'}
                        onChange={(e) => updateLocalSetting('watermark_text', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Preview"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Opacidade ({Math.round((localSettings.watermark_opacity || 0.7) * 100)}%)
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={localSettings.watermark_opacity || 0.7}
                        onChange={(e) => updateLocalSetting('watermark_opacity', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Posição
                      </label>
                      <select
                        value={localSettings.watermark_position || 'center'}
                        onChange={(e) => updateLocalSetting('watermark_position', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="top-left">Superior Esquerda</option>
                        <option value="top-center">Superior Centro</option>
                        <option value="top-right">Superior Direita</option>
                        <option value="center-left">Centro Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="center-right">Centro Direita</option>
                        <option value="bottom-left">Inferior Esquerda</option>
                        <option value="bottom-center">Inferior Centro</option>
                        <option value="bottom-right">Inferior Direita</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tamanho
                      </label>
                      <select
                        value={localSettings.watermark_size || 'medium'}
                        onChange={(e) => updateLocalSetting('watermark_size', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="small">Pequeno</option>
                        <option value="medium">Médio</option>
                        <option value="large">Grande</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Watermark Preview */}
                {localSettings.watermark_enabled && (
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Preview da Marca d'Água
                    </label>
                    <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 h-48">
                      {/* Sample photo background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800"></div>
                      
                      {/* Watermark overlay */}
                      <div 
                        className={`absolute inset-0 flex items-center justify-center pointer-events-none ${
                          localSettings.watermark_position === 'top-left' ? 'items-start justify-start p-4' :
                          localSettings.watermark_position === 'top-center' ? 'items-start justify-center p-4' :
                          localSettings.watermark_position === 'top-right' ? 'items-start justify-end p-4' :
                          localSettings.watermark_position === 'center-left' ? 'items-center justify-start p-4' :
                          localSettings.watermark_position === 'center' ? 'items-center justify-center' :
                          localSettings.watermark_position === 'center-right' ? 'items-center justify-end p-4' :
                          localSettings.watermark_position === 'bottom-left' ? 'items-end justify-start p-4' :
                          localSettings.watermark_position === 'bottom-center' ? 'items-end justify-center p-4' :
                          localSettings.watermark_position === 'bottom-right' ? 'items-end justify-end p-4' :
                          'items-center justify-center'
                        }`}
                        style={{ 
                          opacity: localSettings.watermark_opacity || 0.7 
                        }}
                      >
                        <div 
                          className={`bg-black text-white px-3 py-1 rounded font-medium ${
                            localSettings.watermark_size === 'small' ? 'text-xs' :
                            localSettings.watermark_size === 'large' ? 'text-lg' :
                            'text-sm'
                          }`}
                        >
                          {localSettings.watermark_text || 'Preview'}
                        </div>
                      </div>
                      
                      {/* Sample photo indicator */}
                      <div className="absolute bottom-2 left-2 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">
                        Foto de exemplo
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Como funciona:</h3>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• <strong>Logo:</strong> Será exibida no cabeçalho das páginas públicas</li>
                    <li>• <strong>Marca d'água:</strong> Sobreposta nas fotos durante a seleção</li>
                    <li>• <strong>Proteção:</strong> Evita uso não autorizado das fotos</li>
                    <li>• <strong>Fotos finais:</strong> Entregues sem marca d'água</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações de Aparência</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-4">Tema</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => !isDarkMode && toggleDarkMode()}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        !isDarkMode
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Sun className="h-6 w-6 text-yellow-500" />
                        <div className="text-left">
                          <div className="font-medium text-gray-900 dark:text-white">Modo Claro</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Interface clara e limpa</div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => isDarkMode && toggleDarkMode()}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        isDarkMode
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Moon className="h-6 w-6 text-blue-500" />
                        <div className="text-left">
                          <div className="font-medium text-gray-900 dark:text-white">Modo Escuro</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Interface escura e elegante</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Sobre os Temas:</h3>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• <strong>Modo Claro:</strong> Interface tradicional com fundo claro</li>
                    <li>• <strong>Modo Escuro:</strong> Reduz o cansaço visual em ambientes com pouca luz</li>
                    <li>• A preferência é salva automaticamente no seu navegador</li>
                    <li>• Você pode alternar entre os modos a qualquer momento</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Settings */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800">Configurações de Preços</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço por Foto (Horário Comercial)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={localSettings.price_commercial_hour || 0}
                      onChange={(e) => updateLocalSetting('price_commercial_hour', parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço por Foto (Fora do Horário)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={localSettings.price_after_hours || 0}
                      onChange={(e) => updateLocalSetting('price_after_hours', parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mínimo de Fotos
                  </label>
                  <input
                    type="number"
                    value={localSettings.minimum_photos || 5}
                    onChange={(e) => updateLocalSetting('minimum_photos', parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dias para Entrega
                  </label>
                  <input
                    type="number"
                    value={localSettings.delivery_days || 7}
                    onChange={(e) => updateLocalSetting('delivery_days', parseInt(e.target.value) || 7)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Session Types */}
          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800">Tipos de Sessão</h2>
              
              {/* Create New Session Type */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 dark:text-white mb-4">Criar Novo Tipo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Nome (ex: aniversario)"
                    value={newSessionType.name}
                    onChange={(e) => setNewSessionType({...newSessionType, name: e.target.value})}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Rótulo (ex: Aniversário)"
                    value={newSessionType.label}
                    onChange={(e) => setNewSessionType({...newSessionType, label: e.target.value})}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Ícone (emoji)"
                    value={newSessionType.icon}
                    onChange={(e) => setNewSessionType({...newSessionType, icon: e.target.value})}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Descrição"
                    value={newSessionType.description}
                    onChange={(e) => setNewSessionType({...newSessionType, description: e.target.value})}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
                <button
                  onClick={handleCreateSessionType}
                  className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Criar Tipo
                </button>
              </div>

              {/* Existing Session Types */}
              <div className="space-y-3">
                {sessionTypes.map((sessionType) => (
                  <div key={sessionType.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{sessionType.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-800 dark:text-white">{sessionType.label}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{sessionType.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleSessionTypeStatus(sessionType.id, !sessionType.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          sessionType.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {sessionType.is_active ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configuração de Avisos</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Configure as mensagens automáticas que serão enviadas aos clientes em diferentes momentos.
              </p>
              
              <div className="space-y-6">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 bg-white dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-800 dark:text-white">{template.name}</h3>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={template.is_active}
                          onChange={(e) => updateTemplate(template.id, { is_active: e.target.checked })}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Ativo</span>
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Mensagem
                      </label>
                      <textarea
                        value={template.message_template}
                        onChange={(e) => updateTemplate(template.id, { message_template: e.target.value })}
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Digite a mensagem..."
                      />
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <p className="font-medium mb-1">Variáveis disponíveis:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{client_name}}'}</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{amount}}'}</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{session_type}}'}</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{appointment_date}}'}</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{appointment_time}}'}</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{studio_address}}'}</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{studio_maps_url}}'}</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{delivery_days}}'}</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-800 dark:text-gray-200">{'{{gallery_link}}'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Process Queue Section */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                <h3 className="font-medium text-gray-800 dark:text-white mb-4">Processar Fila de Notificações</h3>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Force o processamento manual da fila de notificações pendentes.
                  </p>
                  
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={handleProcessQueue}
                      disabled={processingQueue}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {processingQueue ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <TestTube className="h-4 w-4" />
                          <span>Processar Fila</span>
                        </>
                      )}
                    </button>

                    {queueResult && (
                      <div className={`flex items-center space-x-2 ${
                        queueResult.success ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <span className="text-sm">{queueResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-2">Como funciona:</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Confirmação de Pagamento:</strong> Enviada imediatamente após pagamento aprovado</li>
                  <li>• <strong>Lembrete 1 Dia Antes:</strong> Enviada 24h antes da sessão</li>
                  <li>• <strong>Lembrete Dia da Sessão:</strong> Enviada 2h antes da sessão</li>
                  <li>• <strong>Galeria Pronta:</strong> Enviada quando fotos são carregadas</li>
                  <li>• <strong>Seleção Recebida:</strong> Enviada quando cliente confirma seleção</li>
                  <li>• <strong>Lembrete de Seleção:</strong> Enviada 1 dia antes do prazo</li>
                  <li>• <strong>Lembrete de Entrega:</strong> Enviada 1 dia antes da entrega</li>
                  <li>• <strong>Processamento Manual:</strong> Use o botão "Processar Fila" para forçar envio</li>
                </ul>
              </div>
            </div>
          )}

          {/* WhatsApp/Evolution API Settings */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações WhatsApp (Evolution API)</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL da Evolution API
                  </label>
                  <input
                    type="url"
                    value={whatsappSettings.evolution_api_url}
                    onChange={(e) => setWhatsappSettings(prev => ({ ...prev, evolution_api_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="https://sua-evolution-api.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={whatsappSettings.evolution_api_key}
                    onChange={(e) => setWhatsappSettings(prev => ({ ...prev, evolution_api_key: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Sua API Key da Evolution"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome da Instância
                  </label>
                  <input
                    type="text"
                    value={whatsappSettings.instance_name}
                    onChange={(e) => setWhatsappSettings(prev => ({ ...prev, instance_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="nome-da-instancia"
                  />
                </div>

                <div className="flex justify-start">
                  <button
                    onClick={handleSaveWhatsAppSettings}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Salvar Configurações WhatsApp
                  </button>
                </div>

                {/* Test WhatsApp Connection */}
                <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                  <h3 className="font-medium text-gray-800 dark:text-white mb-4">Testar Conexão WhatsApp</h3>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Teste se as configurações da Evolution API estão corretas e se a instância está acessível.
                    </p>
                    
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleTestWhatsAppConnection}
                        disabled={testingWhatsAppConnection || !whatsappSettings.evolution_api_url || !whatsappSettings.evolution_api_key || !whatsappSettings.instance_name}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      >
                        {testingWhatsAppConnection ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Testando...</span>
                          </>
                        ) : (
                          <>
                            <TestTube className="h-4 w-4" />
                            <span>Testar Conexão WhatsApp</span>
                          </>
                        )}
                      </button>

                      {whatsAppConnectionResult && (
                        <div className={`flex items-center space-x-2 ${
                          whatsAppConnectionResult.success ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {whatsAppConnectionResult.success ? (
                            <Wifi className="h-4 w-4" />
                          ) : (
                            <WifiOff className="h-4 w-4" />
                          )}
                          <span className="text-sm">{whatsAppConnectionResult.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Test Message Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-medium text-gray-800 dark:text-white mb-4">Testar Envio de Mensagem</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Número para Teste
                      </label>
                      <input
                        type="tel"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="(11) 99999-9999"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Digite um número de WhatsApp válido para receber a mensagem de teste
                      </p>
                    </div>

                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleTestMessage}
                        disabled={testingMessage || !testPhone.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      >
                        {testingMessage ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Phone className="h-4 w-4" />
                            <span>Enviar Mensagem de Teste</span>
                          </>
                        )}
                      </button>

                      {testMessageResult && (
                        <div className={`flex items-center space-x-2 ${
                          testMessageResult.success ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <span className="text-sm">{testMessageResult.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {instances.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-medium text-gray-800 dark:text-white mb-3">Instâncias Existentes</h3>
                    <div className="space-y-2">
                      {instances.map((instance) => (
                        <div key={instance.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
                          <div>
                            <p className="font-medium text-gray-800 dark:text-white">{instance.instance_name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Status: {instance.status}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            instance.status === 'connected' 
                              ? 'bg-green-100 text-green-800'
                              : instance.status === 'created'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {instance.status === 'connected' ? 'Conectado' : 
                             instance.status === 'created' ? 'Criado' : 'Desconectado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-800 mb-2">Como configurar:</h3>
                  <ol className="text-sm text-blue-700 space-y-1">
                    <li>1. Configure sua Evolution API</li>
                    <li>2. Crie uma instância do WhatsApp</li>
                    <li>3. Conecte o WhatsApp escaneando o QR Code</li>
                    <li>4. Insira as credenciais acima</li>
                    <li>5. Clique em "Salvar Configurações WhatsApp"</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* MercadoPago Settings */}
          {activeTab === 'mercadopago' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações MercadoPago</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={mpSettings?.access_token || ''}
                    onChange={(e) => updateMPSettings({ access_token: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Seu Access Token do MercadoPago"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Public Key
                  </label>
                  <input
                    type="text"
                    value={mpSettings?.public_key || ''}
                    onChange={(e) => updateMPSettings({ public_key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="Sua Public Key do MercadoPago"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={mpSettings?.webhook_url || ''}
                    onChange={(e) => updateMPSettings({ webhook_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="https://sua-api.com/webhook/mercadopago"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    URL para receber notificações de pagamento
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ambiente
                  </label>
                  <select
                    value={mpSettings?.environment || 'sandbox'}
                    onChange={(e) => updateMPSettings({ environment: e.target.value as 'sandbox' | 'production' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="sandbox">Sandbox (Testes)</option>
                    <option value="production">Produção</option>
                  </select>
                </div>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection || !mpSettings?.access_token}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {testingConnection ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Testando...</span>
                      </>
                    ) : (
                      <>
                        <TestTube className="h-4 w-4" />
                        <span>Testar Conexão</span>
                      </>
                    )}
                  </button>

                  {connectionResult && (
                    <div className={`flex items-center space-x-2 ${
                      connectionResult.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {connectionResult.success ? (
                        <Wifi className="h-4 w-4" />
                      ) : (
                        <WifiOff className="h-4 w-4" />
                      )}
                      <span className="text-sm">{connectionResult.message}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Como configurar:</h3>
                  <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>1. Acesse o <a href="https://www.mercadopago.com.br/developers" target="_blank" rel="noopener noreferrer" className="underline">Portal de Desenvolvedores</a></li>
                    <li>2. Crie uma aplicação ou use uma existente</li>
                    <li>3. Copie o Access Token e Public Key</li>
                    <li>4. Configure a URL do webhook para receber notificações</li>
                    <li>5. Teste a conexão antes de usar em produção</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}