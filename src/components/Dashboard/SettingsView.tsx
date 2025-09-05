import React, { useState } from 'react';
import { Save, TestTube, MessageSquare, DollarSign, Clock, MapPin, Building, Phone, Image, Eye, EyeOff } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useMercadoPago } from '../../hooks/useMercadoPago';
import { useSessionTypes } from '../../hooks/useSessionTypes';
import { useNotifications } from '../../hooks/useNotifications';

export function SettingsView() {
  const { settings, updateSettings } = useSettings();
  const { settings: mpSettings, updateSettings: updateMpSettings, testConnection } = useMercadoPago();
  const { sessionTypes, createSessionType, updateSessionType, deleteSessionType } = useSessionTypes();
  const { templates, updateTemplate } = useNotifications();
  
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [showAccessToken, setShowAccessToken] = useState(false);

  const handleSaveSettings = async (updates: any) => {
    setSaving(true);
    try {
      const success = await updateSettings(updates);
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

  const tabs = [
    { id: 'general', label: 'Geral', icon: Building },
    { id: 'pricing', label: 'Preços', icon: DollarSign },
    { id: 'mercadopago', label: 'MercadoPago', icon: DollarSign },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'notifications', label: 'Notificações', icon: MessageSquare },
    { id: 'sessions', label: 'Tipos de Sessão', icon: Image }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
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
                  value={settings?.studio_name || ''}
                  onChange={(e) => handleSaveSettings({ studio_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Nome do seu estúdio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telefone do Estúdio
                </label>
                <input
                  type="tel"
                  value={settings?.studio_phone || ''}
                  onChange={(e) => handleSaveSettings({ studio_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Endereço do Estúdio
                </label>
                <input
                  type="text"
                  value={settings?.studio_address || ''}
                  onChange={(e) => handleSaveSettings({ studio_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Endereço completo do estúdio"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL do Google Maps
                </label>
                <input
                  type="url"
                  value={settings?.studio_maps_url || ''}
                  onChange={(e) => handleSaveSettings({ studio_maps_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          </div>
        )}

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
                  value={settings?.price_commercial_hour || 0}
                  onChange={(e) => handleSaveSettings({ price_commercial_hour: parseFloat(e.target.value) })}
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
                  value={settings?.price_after_hours || 0}
                  onChange={(e) => handleSaveSettings({ price_after_hours: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fotos Mínimas por Sessão
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings?.minimum_photos || 5}
                  onChange={(e) => handleSaveSettings({ minimum_photos: parseInt(e.target.value) })}
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
                  value={settings?.delivery_days || 7}
                  onChange={(e) => handleSaveSettings({ delivery_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mercadopago' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações MercadoPago</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Access Token
                </label>
                <div className="relative">
                  <input
                    type={showAccessToken ? 'text' : 'password'}
                    value={mpSettings?.access_token || ''}
                    onChange={(e) => updateMpSettings({ access_token: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Seu Access Token do MercadoPago"
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
                  Ambiente
                </label>
                <select
                  value={mpSettings?.environment || 'sandbox'}
                  onChange={(e) => updateMpSettings({ environment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="sandbox">Sandbox (Testes)</option>
                  <option value="production">Produção</option>
                </select>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleTestMercadoPago}
                  disabled={testing || !mpSettings?.access_token}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {testing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
                </button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg ${
                  testResult.success 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  <p className="text-sm">{testResult.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configurações WhatsApp</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Configure sua instância WhatsApp para envio automático de notificações.
            </p>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                Esta funcionalidade requer configuração manual no banco de dados.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Templates de Notificação</h2>
            
            <div className="space-y-4">
              {templates?.map((template) => (
                <div key={template.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-800 dark:text-white">{template.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      template.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {template.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  
                  <textarea
                    value={template.message_template}
                    onChange={(e) => updateTemplate(template.id, { message_template: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Variáveis disponíveis: {'{'}client_name{'}'}, {'{'}amount{'}'}, {'{'}session_type{'}'}, {'{'}appointment_date{'}'}, {'{'}appointment_time{'}'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Tipos de Sessão</h2>
            
            <div className="space-y-4">
              {sessionTypes?.map((sessionType) => (
                <div key={sessionType.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{sessionType.icon}</span>
                      <div>
                        <h3 className="font-medium text-gray-800 dark:text-white">{sessionType.label}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{sessionType.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        sessionType.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {sessionType.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                      
                      <button
                        onClick={() => updateSessionType(sessionType.id, { is_active: !sessionType.is_active })}
                        className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
                      >
                        {sessionType.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}