import React, { useState, useEffect } from 'react';
import { Calendar, Camera, Users, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAppointments } from '../../hooks/useAppointments';
import { useClients } from '../../hooks/useClients';
import { formatCurrency } from '../../utils/pricing';
import { sessionTypeLabels, getSessionIcon } from '../../utils/sessionTypes';
import { supabase } from '../../lib/supabase';


export function DashboardOverview() {
  const { appointments } = useAppointments();
  const { clients } = useClients();
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);

  useEffect(() => {
    fetchPaymentStats();
  }, []);

  const fetchPaymentStats = async () => {
    try {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('amount, status');

      if (error) throw error;

      const approved = payments
        ?.filter(p => p.status === 'approved')
        .reduce((sum, p) => sum + p.amount, 0) || 0;

      const pending = payments
        ?.filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amount, 0) || 0;

      setTotalRevenue(approved);
      setPendingPayments(pending);
    } catch (error) {
      console.error('Erro ao buscar estatísticas de pagamentos:', error);
    }
  };

  const today = new Date();
  const todayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.scheduled_date);
    return aptDate.toDateString() === today.toDateString() && apt.status === 'confirmed';
  });

  const upcomingAppointments = appointments
    .filter(apt => new Date(apt.scheduled_date) > today && apt.status === 'confirmed')
    .slice(0, 5);

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <a
          href="/agendamento"
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Agendamento</span>
          <span className="sm:hidden">Novo</span>
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {stat.title}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-2 sm:p-3 rounded-lg ${stat.bg}`}>
                  <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Session Types Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">Tipos de Sessão</h2>
            <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          
          {(() => {
            // Calcular dados para o gráfico de pizza
            const sessionTypeCounts = appointments
              .filter(apt => apt.status === 'confirmed' || apt.status === 'completed')
              .reduce((acc, apt) => {
                const type = apt.session_type;
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

            const chartData = Object.entries(sessionTypeCounts).map(([type, count]) => ({
              name: sessionTypeLabels[type as keyof typeof sessionTypeLabels] || type,
              value: count,
              icon: getSessionIcon(type as keyof typeof sessionTypeLabels)
            }));

            const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

            if (chartData.length === 0) {
              return (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">
                  Nenhuma sessão confirmada ainda
                </p>
              );
            }

            return (
              <div className="space-y-4">
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${value} sessões`, 'Total']}
                        labelStyle={{ color: '#374151' }}
                        contentStyle={{ 
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Legend */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {chartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                        <span>{entry.icon}</span>
                        <span>{entry.name}</span>
                        <span className="font-medium">({entry.value})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

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
                          minute: '2-digit',
                          timeZone: 'America/Sao_Paulo'
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
                      {new Date(appointment.scheduled_date).toLocaleDateString('pt-BR', {
                        timeZone: 'America/Sao_Paulo'
                      })}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {new Date(appointment.scheduled_date).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Sao_Paulo'
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