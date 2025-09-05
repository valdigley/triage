import React, { useState } from 'react';
import { Calendar, Clock, Phone, Mail, Eye, Check, X, Download, ExternalLink } from 'lucide-react';
import { useAppointments } from '../../hooks/useAppointments';
import { formatCurrency } from '../../utils/pricing';
import { sessionTypeLabels, getSessionIcon } from '../../utils/sessionTypes';
import { Appointment } from '../../types';
import { downloadICalendar } from '../../utils/calendar';

export function AppointmentsView() {
  const { appointments, updateAppointmentStatus } = useAppointments();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredAppointments = appointments.filter(apt => 
    statusFilter === 'all' || apt.status === statusFilter
  );

  const handleExportCalendar = () => {
    const confirmedAppointments = appointments.filter(apt => 
      apt.status === 'confirmed' || apt.status === 'completed'
    );
    downloadICalendar(confirmedAppointments, `agenda-estudio-${new Date().toISOString().split('T')[0]}.ics`);
  };

  const generateGoogleCalendarUrl = () => {
    const confirmedAppointments = appointments.filter(apt => 
      apt.status === 'confirmed' || apt.status === 'completed'
    );
    
    if (confirmedAppointments.length === 0) {
      alert('Nenhum agendamento confirmado para exportar');
      return;
    }

    // Para Google Calendar, vamos criar um link para adicionar o primeiro evento como exemplo
    const firstAppointment = confirmedAppointments[0];
    const startDate = new Date(firstAppointment.scheduled_date);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const sessionTypeLabels: Record<string, string> = {
      'aniversario': 'Aniversário',
      'gestante': 'Gestante', 
      'formatura': 'Formatura',
      'comercial': 'Comercial',
      'pre_wedding': 'Pré-wedding',
      'tematico': 'Temático'
    };

    const sessionLabel = sessionTypeLabels[firstAppointment.session_type] || firstAppointment.session_type;
    const title = `${sessionLabel} - ${firstAppointment.client?.name}`;
    const details = `Cliente: ${firstAppointment.client?.name}\\nTelefone: ${firstAppointment.client?.phone}\\nValor: R$ ${firstAppointment.total_amount.toFixed(2)}`;
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${encodeURIComponent(details)}`;
    
    window.open(googleUrl, '_blank');
  };
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
      confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-800' },
      completed: { label: 'Concluído', className: 'bg-blue-100 text-blue-800' },
      cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getPaymentBadge = (status: string) => {
    const paymentConfig = {
      pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Aprovado', className: 'bg-green-100 text-green-800' },
      rejected: { label: 'Rejeitado', className: 'bg-red-100 text-red-800' },
      cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800' }
    };

    const config = paymentConfig[status as keyof typeof paymentConfig];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Agendamentos</h1>
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Feed iCal para Google Calendar:</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cole este link no Google Calendar para sincronização automática</p>
              </div>
              <button
                onClick={() => {
                  const feedUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed`;
                  navigator.clipboard.writeText(feedUrl);
                  alert('Link do feed iCal copiado! Cole no Google Calendar em "Outros calendários" → "+" → "A partir de URL"');
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 text-sm"
              >
                <Calendar className="h-4 w-4" />
                <span>Copiar Link</span>
              </button>
            </div>
            <div className="mt-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

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
                  Sessão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Pagamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAppointments.map((appointment) => (
                <tr key={appointment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {appointment.client?.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>{appointment.client?.phone}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getSessionIcon(appointment.session_type)}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {sessionTypeLabels[appointment.session_type]}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {new Date(appointment.scheduled_date).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(appointment.scheduled_date).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {formatCurrency(appointment.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(appointment.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getPaymentBadge(appointment.payment_status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedAppointment(appointment)}
                        className="text-purple-600 hover:text-purple-900 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {appointment.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                            className="text-green-600 hover:text-green-900 transition-colors"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                            className="text-red-600 hover:text-red-900 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
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
        {filteredAppointments.map((appointment) => (
          <div key={appointment.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-lg">{getSessionIcon(appointment.session_type)}</span>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {sessionTypeLabels[appointment.session_type]}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                  {appointment.client?.name}
                </p>
                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                  <Phone className="h-3 w-3" />
                  <span>{appointment.client?.phone}</span>
                </div>
              </div>
              <div className="ml-3 text-right">
                {getStatusBadge(appointment.status)}
              </div>
            </div>

            {/* Date and Time */}
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(appointment.scheduled_date).toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(appointment.scheduled_date).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Value and Payment */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Valor</label>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(appointment.total_amount)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Pagamento</label>
                <div className="mt-1">
                  {getPaymentBadge(appointment.payment_status)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedAppointment(appointment)}
                className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center space-x-1"
              >
                <Eye className="h-4 w-4" />
                <span>Ver Detalhes</span>
              </button>
              
              {appointment.status === 'pending' && (
                <>
                  <button
                    onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Check className="h-4 w-4" />
                    <span>Confirmar</span>
                  </button>
                  <button
                    onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center space-x-1"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancelar</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredAppointments.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Nenhum agendamento encontrado</p>
        </div>
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">Detalhes do Agendamento</h3>
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Cliente</label>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white">{selectedAppointment.client?.name}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Telefone</label>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white">{selectedAppointment.client?.phone}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">E-mail</label>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white">{selectedAppointment.client?.email || 'Não informado'}</p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Tipo de Sessão</label>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white flex items-center space-x-2">
                      <span>{getSessionIcon(selectedAppointment.session_type)}</span>
                      <span>{sessionTypeLabels[selectedAppointment.session_type]}</span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Data e Hora</label>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white">
                      {new Date(selectedAppointment.scheduled_date).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Valor Total</label>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-semibold">
                      {formatCurrency(selectedAppointment.total_amount)}
                    </p>
                  </div>
                </div>

                {Object.keys(selectedAppointment.session_details).length > 0 && (
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Detalhes da Sessão</label>
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {Object.entries(selectedAppointment.session_details).map(([key, value]) => (
                        <div key={key} className="text-xs sm:text-sm text-gray-900 dark:text-white">
                          <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                          <span className="ml-2">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm sm:text-base"
                >
                  Fechar
                </button>
                {selectedAppointment.status === 'pending' && (
                  <button
                    onClick={() => {
                      updateAppointmentStatus(selectedAppointment.id, 'confirmed');
                      setSelectedAppointment(null);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}