import React, { useState } from 'react';
import { Search, Phone, Mail, Eye, ExternalLink, UserPlus, X, Edit2, Trash2 } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/pricing';
import { Client, Appointment } from '../../types';
import { sessionTypeLabels, getSessionIcon } from '../../utils/sessionTypes';

export function ClientsView() {
  const { clients, searchClients, getClientDetails, refetch } = useClients();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<{
    client: Client;
    appointments: Appointment[];
  } | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim() === '') {
      // Reset to all clients
      searchClients('');
    } else {
      searchClients(term);
    }
  };

  const handleViewClient = async (client: Client) => {
    const details = await getClientDetails(client.id);
    if (details) {
      setSelectedClient(details);
    }
  };

  const generateWhatsAppLink = (phone: string, name: string) => {
    const message = `Olá ${name}! Como posso ajudá-lo com sua sessão fotográfica?`;
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleCreateClient = async () => {
    if (!newClient.name || !newClient.phone) {
      alert('Nome e telefone são obrigatórios');
      return;
    }

    setCreating(true);
    try {
      // Check if client already exists
      const { data: existingClient } = await supabase
        .from('clients')
        .select('*')
        .eq('phone', newClient.phone)
        .maybeSingle();

      if (existingClient) {
        alert('Já existe um cliente com este telefone');
        return;
      }

      const { error } = await supabase
        .from('clients')
        .insert([{
          name: newClient.name,
          phone: newClient.phone,
          email: newClient.email || null
        }]);

      if (error) throw error;

      alert('Cliente criado com sucesso!');
      setShowCreateClient(false);
      setNewClient({
        name: '',
        phone: '',
        email: ''
      });

      // Refresh clients list
      await refetch();
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      alert('Erro ao criar cliente. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setShowEditClient(true);
  };

  const handleUpdateClient = async () => {
    if (!editingClient || !editingClient.name || !editingClient.phone) {
      alert('Nome e telefone são obrigatórios');
      return;
    }

    setUpdating(true);
    try {
      // Check if phone is being changed and already exists
      const { data: existingClient } = await supabase
        .from('clients')
        .select('*')
        .eq('phone', editingClient.phone)
        .neq('id', editingClient.id)
        .maybeSingle();

      if (existingClient) {
        alert('Já existe outro cliente com este telefone');
        return;
      }

      const { error } = await supabase
        .from('clients')
        .update({
          name: editingClient.name,
          phone: editingClient.phone,
          email: editingClient.email || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingClient.id);

      if (error) throw error;

      alert('Cliente atualizado com sucesso!');
      setShowEditClient(false);
      setEditingClient(null);

      // Refresh clients list
      await refetch();
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      alert('Erro ao atualizar cliente. Tente novamente.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClient = async (client: Client) => {
    const confirmMessage = `Tem certeza que deseja excluir o cliente "${client.name}"?\n\n` +
                          `ATENÇÃO: Esta ação irá:\n` +
                          `• Excluir todos os agendamentos do cliente\n` +
                          `• Excluir todas as galerias associadas\n` +
                          `• Excluir todos os pagamentos\n\n` +
                          `Esta ação NÃO PODE ser desfeita!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setDeleting(client.id);
    try {
      // The database will handle cascading deletes via foreign keys
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      alert('Cliente excluído com sucesso!');

      // Close modal if it's open
      if (selectedClient?.client.id === client.id) {
        setSelectedClient(null);
      }

      // Refresh clients list
      await refetch();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      alert('Erro ao excluir cliente. Tente novamente.');
    } finally {
      setDeleting(null);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
        <button
          onClick={() => setShowCreateClient(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Cliente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Clients Table */}
      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Gasto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cadastrado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{client.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white flex items-center space-x-1">
                      <Phone className="h-4 w-4" />
                      <span>{client.phone}</span>
                    </div>
                    {client.email && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                        <Mail className="h-4 w-4" />
                        <span>{client.email}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    {formatCurrency(client.total_spent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(client.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleViewClient(client)}
                        className="text-purple-600 hover:text-purple-900 transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditClient(client)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Editar cliente"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <a
                        href={generateWhatsAppLink(client.phone, client.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-900 transition-colors"
                        title="Contatar via WhatsApp"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteClient(client)}
                        disabled={deleting === client.id}
                        className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50"
                        title="Excluir cliente"
                      >
                        {deleting === client.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {clients.map((client) => (
          <div key={client.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {client.name}
                </h3>
                <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-300 mb-1">
                  <Phone className="h-4 w-4" />
                  <span>{client.phone}</span>
                </div>
                {client.email && (
                  <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                    <Mail className="h-3 w-3" />
                    <span>{client.email}</span>
                  </div>
                )}
              </div>
              <div className="ml-3 text-right">
                <div className="text-lg font-bold text-green-600">
                  {formatCurrency(client.total_spent)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Gasto</div>
              </div>
            </div>

            {/* Client Info */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Cliente desde</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {new Date(client.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewClient(client)}
                  className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center space-x-1"
                >
                  <Eye className="h-4 w-4" />
                  <span>Ver Detalhes</span>
                </button>

                <button
                  onClick={() => handleEditClient(client)}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>Editar</span>
                </button>
              </div>

              <div className="flex gap-2">
                <a
                  href={generateWhatsAppLink(client.phone, client.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>WhatsApp</span>
                </a>

                <button
                  onClick={() => handleDeleteClient(client)}
                  disabled={deleting === client.id}
                  className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                >
                  {deleting === client.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Excluindo...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Excluir</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {clients.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <p className="text-gray-500">Nenhum cliente encontrado</p>
        </div>
      )}

      {/* Client Details Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
                  Detalhes do Cliente
                </h3>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Eye className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Client Info */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 sm:p-4 space-y-3">
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm sm:text-base">Informações</h4>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Nome</label>
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{selectedClient.client.name}</p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Telefone</label>
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{selectedClient.client.phone}</p>
                    </div>
                    {selectedClient.client.email && (
                      <div>
                        <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">E-mail</label>
                        <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">{selectedClient.client.email}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Gasto</label>
                      <p className="font-medium text-green-600 text-sm sm:text-base">
                        {formatCurrency(selectedClient.client.total_spent)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Cliente desde</label>
                      <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">
                        {new Date(selectedClient.client.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    
                    <a
                      href={generateWhatsAppLink(selectedClient.client.phone, selectedClient.client.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-green-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Contatar via WhatsApp</span>
                    </a>
                  </div>
                </div>

                {/* Appointments History */}
                <div className="lg:col-span-2">
                  <h4 className="font-medium text-gray-800 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">Histórico de Agendamentos</h4>
                  {selectedClient.appointments.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">Nenhum agendamento encontrado</p>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {selectedClient.appointments.map((appointment) => (
                        <div key={appointment.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800 dark:text-white flex items-center space-x-2 text-sm sm:text-base">
                                <span>{getSessionIcon(appointment.session_type)}</span>
                                <span>{sessionTypeLabels[appointment.session_type]}</span>
                              </p>
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {new Date(appointment.scheduled_date).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="font-medium text-green-600 text-sm sm:text-base">
                                {formatCurrency(appointment.total_amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Novo Cliente</h3>
                <button
                  onClick={() => setShowCreateClient(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={newClient.name}
                    onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Nome completo do cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="cliente@email.com (opcional)"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateClient(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateClient}
                  disabled={creating}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {creating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  <span>{creating ? 'Criando...' : 'Criar Cliente'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditClient && editingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Editar Cliente</h3>
                <button
                  onClick={() => {
                    setShowEditClient(false);
                    setEditingClient(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Nome completo do cliente"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    value={editingClient.phone}
                    onChange={(e) => setEditingClient(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={editingClient.email || ''}
                    onChange={(e) => setEditingClient(prev => prev ? { ...prev, email: e.target.value } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="cliente@email.com (opcional)"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditClient(false);
                    setEditingClient(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateClient}
                  disabled={updating}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {updating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Edit2 className="h-4 w-4" />
                  )}
                  <span>{updating ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}