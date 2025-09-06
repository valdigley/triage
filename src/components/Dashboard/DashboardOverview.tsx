import React from 'react';
import { Calendar, Camera, Users, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { useAppointments } from '../../hooks/useAppointments';
import { useClients } from '../../hooks/useClients';
import { formatCurrency } from '../../utils/pricing';
import { sessionTypeLabels, getSessionIcon } from '../../utils/sessionTypes';

export function DashboardOverview() {
  const { appointments } = useAppointments();
  const { clients } = useClients();

  const today = new Date();
  const todayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.scheduled_date);
    return aptDate.toDateString() === today.toDateString() && apt.status === 'confirmed';
  });

  const upcomingAppointments = appointments
    .filter(apt => new Date(apt.scheduled_date) > today && apt.status === 'confirmed')
    .slice(0, 5);

  const totalRevenue = appointments
    .filter(apt => apt.payment_status === 'approved')
    .reduce((sum, apt) => sum + apt.total_amount, 0);

  const pendingPayments = appointments
    .filter(apt => apt.payment_status === 'pending')
    .reduce((sum, apt) => sum + apt.total_amount, 0);

  const stats = [
    {
      title: 'Sessões Hoje',
      value: todayAppointments.length.toString(),
      icon: Calendar,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      title: 'Total de Clientes',
      value: clients.length.toString(),
      icon: Users,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      title: 'Faturamento',
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      title: 'Pendências',
      value: formatCurrency(pendingPayments),
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href="/agendamento"
              className="bg-purple-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Novo Agendamento</span>
              <span className="sm:hidden">Novo</span>
            </a>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm sm:text-base">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bg} ${stat.color} p-2 sm:p-3 rounded-lg`}>
                  <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Today's Appointments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">Sessões de Hoje</h2>
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          
          {todayAppointments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">Nenhuma sessão agendada para hoje</p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {todayAppointments.map((appointment) => (
                <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2 sm:space-y-0">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <span className="text-base sm:text-lg">{getSessionIcon(appointment.session_type)}</span>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-gray-800 dark:text-white">{appointment.client?.name}</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {sessionTypeLabels[appointment.session_type]} - 
                        {new Date(appointment.scheduled_date).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm sm:text-base font-medium text-green-600">{formatCurrency(appointment.total_amount)}</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                      appointment.payment_status === 'approved' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {appointment.payment_status === 'approved' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">Próximos Agendamentos</h2>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          
          {upcomingAppointments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">Nenhum agendamento futuro</p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2 sm:space-y-0">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <span className="text-base sm:text-lg">{getSessionIcon(appointment.session_type)}</span>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-gray-800 dark:text-white">{appointment.client?.name}</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {sessionTypeLabels[appointment.session_type]}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm font-medium text-gray-800 dark:text-white">
                      {new Date(appointment.scheduled_date).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {new Date(appointment.scheduled_date).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}