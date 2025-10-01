import React, { useState } from 'react';
import { Calendar, Phone, Mail, User, Clock, DollarSign, QrCode, ExternalLink, ChevronRight } from 'lucide-react';
import { BookingFormData, SessionType } from '../../types';
import { useSettings } from '../../hooks/useSettings';
import { useSessionTypes } from '../../hooks/useSessionTypes';
import { useAppointments } from '../../hooks/useAppointments';
import { useMercadoPago } from '../../hooks/useMercadoPago';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { calculatePrice, isDateTimeAvailable, formatCurrency } from '../../utils/pricing';
import { SessionDetailsForm } from './SessionDetailsForm';
import { supabase } from '../../lib/supabase';

// Função para gerar horários disponíveis
function generateAvailableTimeSlots(
  date: string,
  existingAppointments: Array<{ scheduled_date: string }>,
  commercialHours: any
): string[] {
  const selectedDate = new Date(date);
  const dayOfWeek = selectedDate.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];
  const daySchedule = commercialHours[dayName];

  if (!daySchedule.enabled) {
    return [];
  }

  const availableSlots: string[] = [];
  const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
  const [endHour, endMinute] = daySchedule.end.split(':').map(Number);

  // Gerar slots de 1 em 1 hora (1h sessão + 1h intervalo = 2h entre cada slot)
  for (let hour = startHour; hour <= endHour - 1; hour += 2) {
    const slotTime = `${hour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
    
    // Verificar se o horário não ultrapassa o fim do expediente
    if (hour < endHour || (hour === endHour && startMinute <= endMinute)) {
      const slotDateTime = new Date(selectedDate);
      slotDateTime.setHours(hour, startMinute, 0, 0);
      
      // Verificar se não há conflito com agendamentos existentes
      const hasConflict = existingAppointments.some(apt => {
        const existingDate = new Date(apt.scheduled_date);
        const timeDiff = Math.abs(slotDateTime.getTime() - existingDate.getTime());
        const twoHours = 2 * 60 * 60 * 1000; // 2 horas em milliseconds
        return timeDiff < twoHours;
      });

      // Verificar se é no futuro
      const now = new Date();
      const isInFuture = slotDateTime > now;

      if (!hasConflict && isInFuture) {
        const isoDateTime = slotDateTime.toISOString().slice(0, 16);
        availableSlots.push(isoDateTime);
      }
    }
  }

  return availableSlots;
}

export function BookingForm() {
  const { settings } = useSettings();
  const { getActiveSessionTypes } = useSessionTypes();
  const { appointments, checkAvailability, createAppointment } = useAppointments();
  const { getActiveSettings } = useMercadoPago();
  const { sendPaymentConfirmation } = useWhatsApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [availableSlots, setAvailableSlots] = useState<Array<{
    date: string;
    time: string;
    datetime: string;
    price: number;
  }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [formData, setFormData] = useState<BookingFormData>({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    sessionType: 'aniversario',
    scheduledDate: '',
    sessionDetails: {},
    termsAccepted: false
  });
  
  const [price, setPrice] = useState(0);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    payment_id: string;
    status: string;
    qr_code?: string;
    qr_code_base64?: string;
    expires_at?: string;
  } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const activeSessionTypes = getActiveSessionTypes();
  const mpSettings = getActiveSettings();

  // Carregar horários disponíveis quando o componente monta
  React.useEffect(() => {
    if (settings) {
      loadAvailableSlots();
    }
  }, [settings]);

  const loadAvailableSlots = async () => {
    if (!settings) return;
    
    setLoadingSlots(true);
    try {
      // Buscar agendamentos existentes
      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('scheduled_date')
        .in('status', ['pending', 'confirmed']);
      
      const slots = [];
      const today = new Date();
      
      // Gerar slots para os próximos 30 dias
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const daySlots = generateAvailableTimeSlots(
          date.toISOString().split('T')[0],
          existingAppointments || [],
          settings.commercial_hours
        );
        
        daySlots.forEach(slotDateTime => {
          const slotDate = new Date(slotDateTime);
          const calculatedPrice = calculatePrice(
            slotDateTime,
            settings.commercial_hours,
            settings.price_commercial_hour,
            settings.price_after_hours
          );
          
          slots.push({
            date: slotDate.toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit'
            }),
            time: slotDate.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            datetime: slotDateTime,
            price: calculatedPrice * settings.minimum_photos
          });
        });
      }
      
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Erro ao carregar horários disponíveis:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSlotSelect = (slot: typeof availableSlots[0]) => {
    setFormData(prev => ({ ...prev, scheduledDate: slot.datetime }));
    setPrice(slot.price);
  };

  const handleSubmit = async () => {
    if (!settings || !mpSettings) {
      alert('Configurações do sistema não encontradas. Tente novamente mais tarde.');
      return;
    }

    // Get device ID for MercadoPago security
    let deviceId = '';
    try {
      // @ts-ignore - MercadoPago global variable
      if (window.MP_DEVICE_SESSION_ID) {
        // @ts-ignore
        deviceId = window.MP_DEVICE_SESSION_ID;
      }
    } catch (error) {
      console.log('Device ID not available:', error);
    }

    setIsSubmitting(true);
    try {
      const selectedSessionType = activeSessionTypes.find(st => st.name === formData.sessionType);
      
      console.log('Enviando dados para create-payment:', {
        formData,
        amount: price,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        sessionType: selectedSessionType?.label || formData.sessionType,
        deviceId
      });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          formData: formData,
          amount: price,
          clientName: formData.clientName,
          clientEmail: formData.clientEmail,
          sessionType: selectedSessionType?.label || formData.sessionType,
          deviceId
        })
      });

      console.log('Response status:', response.status);
      const paymentResult = await response.json();
      console.log('Payment result:', paymentResult);
      
      if (paymentResult.success) {
        setPaymentData(paymentResult);
        setPaymentStatus(paymentResult.status);
        setCurrentStep(4); // Go to payment step instead of separate payment screen
        
        // Start polling for payment status
        startPaymentPolling(paymentResult.payment_id);
      } else {
        throw new Error(paymentResult.error || 'Erro ao criar pagamento');
      }
    } catch (error) {
      console.error('Appointment creation error:', error);
      alert(`Erro ao processar agendamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Tente novamente.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startPaymentPolling = (paymentId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-payment-status?payment_id=${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        });
        
        const result = await response.json();
        
        if (result.success) {
          setPaymentStatus(result.status);
          
          if (result.status === 'approved') {
            // Payment approved - stop polling and show success
            clearInterval(interval);
            setPollingInterval(null);
            
            // Send payment confirmation message
            try {
              const selectedSessionType = activeSessionTypes.find(st => st.name === formData.sessionType);
              await sendPaymentConfirmation(
                formData.clientName,
                formData.clientPhone,
                price,
                formData.scheduledDate,
                selectedSessionType?.label || formData.sessionType,
                settings?.studio_address,
                settings?.studio_maps_url
              );
            } catch (error) {
              console.error('Error sending payment confirmation:', error);
            }
          } else if (result.status === 'expired' || result.status === 'cancelled') {
            // Payment expired/cancelled - stop polling
            clearInterval(interval);
            setPollingInterval(null);
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }, 5000); // Check every 5 seconds
    
    setPollingInterval(interval);
  };

  const resetForm = () => {
    // Clear polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    setFormData({
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      sessionType: 'aniversario',
      scheduledDate: '',
      sessionDetails: {},
      termsAccepted: false
    });
    setCurrentStep(1);
    setPrice(0);
    setPaymentData(null);
    setPaymentStatus('pending');
    setShowPayment(false);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.sessionType && formData.scheduledDate && price > 0;
      case 2:
        return formData.clientName && formData.clientPhone;
      case 3:
        return formData.termsAccepted;
      default:
        return false;
    }
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* MercadoPago Device ID Script */}
      <script 
        src="https://www.mercadopago.com/v2/security.js" 
        view="checkout"
        data-onload="setDeviceId"
      ></script>
      
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className={`text-white p-8 ${
            currentStep === 4 
              ? 'bg-gradient-to-r from-green-700 to-green-800' 
              : 'bg-gradient-to-r from-gray-800 to-gray-900'
          }`}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 space-y-2 sm:space-y-0">
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">
                {currentStep === 4 ? 'Pagamento PIX' : settings.studio_name}
              </h1>
              <p className={`text-sm sm:text-base ${currentStep === 4 ? 'text-green-100' : 'text-gray-300'}`}>
                {currentStep === 4 ? 'Finalize seu agendamento' : 'Agende sua sessão fotográfica'}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          {currentStep < 4 && (
          <div className="bg-gray-50 dark:bg-gray-700 px-4 sm:px-8 py-4">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                      step <= currentStep
                        ? 'border-gray-600 bg-gray-50 dark:bg-gray-700'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {step}
                  </div>
                  {step < 3 && (
                    <div
                      className={`w-8 sm:w-16 h-1 mx-2 sm:mx-4 ${
                        step < currentStep ? 'bg-gray-700' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span className="text-center">Tipo e Data</span>
              <span className="text-center">Dados</span>
              <span className="text-center">Confirmação</span>
            </div>
          </div>
          )}

          <div className="p-4 sm:p-8">
            {/* Step 4: Payment with QR Code */}
            {currentStep === 4 && paymentData && (
              <div className="space-y-4 sm:space-y-6 text-center">
                {paymentStatus === 'approved' ? (
                  <div className="space-y-4">
                    <div className="text-4xl sm:text-6xl">✅</div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-green-600">
                      Pagamento Aprovado!
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600">
                      Seu agendamento foi confirmado com sucesso!
                    </p>
                    <button
                      onClick={resetForm}
                      className="w-full bg-green-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
                    >
                      Fazer Novo Agendamento
                    </button>
                  </div>
                ) : paymentStatus === 'expired' ? (
                  <div className="space-y-4">
                    <div className="text-4xl sm:text-6xl">⏰</div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-orange-600">
                      PIX Expirado
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600">
                      O tempo para pagamento expirou. Gere um novo PIX.
                    </p>
                    <button
                      onClick={resetForm}
                      className="w-full bg-orange-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-orange-700 transition-colors text-sm sm:text-base"
                    >
                      Gerar Novo PIX
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">
                    Escaneie o QR Code PIX
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    Seu agendamento será confirmado automaticamente após o pagamento
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-2">
                    {formatCurrency(price)}
                  </div>
                  <p className="text-sm sm:text-base text-gray-600">
                    Cliente: {formData.clientName}
                  </p>
                  <p className="text-sm sm:text-base text-gray-600">
                    Data: {new Date(formData.scheduledDate).toLocaleString('pt-BR')}
                  </p>
                </div>

                {/* QR Code */}
                {paymentData.qr_code_base64 ? (
                  <div className="mb-4 sm:mb-6">
                    <div className="flex justify-center mb-4">
                      <img 
                        src={`data:image/png;base64,${paymentData.qr_code_base64}`}
                        alt="QR Code para pagamento PIX"
                        className="w-48 h-48 sm:w-64 sm:h-64 border border-gray-300 rounded-lg shadow-md"
                      />
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                      Ou copie e cole o código PIX:
                    </p>
                    <div className="bg-gray-100 p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-mono break-all border">
                      {paymentData.qr_code}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(paymentData.qr_code || '')}
                      className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800"
                    >
                      Copiar código PIX
                    </button>
                  </div>
                ) : paymentData.qr_code ? (
                  <div className="mb-4 sm:mb-6">
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                      Copie e cole o código PIX abaixo:
                    </p>
                    <div className="bg-gray-100 p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-mono break-all border">
                      {paymentData.qr_code}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(paymentData.qr_code || '')}
                      className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800"
                    >
                      Copiar código PIX
                    </button>
                  </div>
                ) : (
                  <div className="mb-4 sm:mb-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4">
                      <p className="text-yellow-800 text-xs sm:text-sm">
                        <strong>⚠️ QR Code PIX não disponível</strong><br/>
                        Use o botão abaixo para pagar no site do MercadoPago
                      </p>
                    </div>
                    {paymentData.init_point && (
                      <a
                        href={paymentData.init_point}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-blue-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                      >
                        <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>Pagar no MercadoPago</span>
                      </a>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <div className={`flex items-center justify-center space-x-2 ${
                    paymentStatus === 'pending' ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-xs sm:text-sm">
                      {paymentStatus === 'pending' 
                        ? 'Aguardando confirmação do pagamento...' 
                        : `Status: ${paymentStatus}`
                      }
                    </span>
                  </div>
                  
                  <button
                    onClick={resetForm}
                    className="w-full border border-gray-300 text-gray-700 py-3 px-4 sm:px-6 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
                  >
                    Fazer Novo Agendamento
                  </button>
                </div>

                <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-green-800">
                    <strong>✅ Agendamento criado!</strong> Após a confirmação do pagamento PIX, 
                    você receberá uma confirmação via WhatsApp automaticamente.
                  </p>
                  {paymentData.expires_at && (
                    <p className="text-xs sm:text-sm text-orange-600 mt-1">
                      <strong>⏰ Expira em:</strong> {new Date(paymentData.expires_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Session Type and Date */}
            {currentStep === 1 && (
              <div className="space-y-4 sm:space-y-6">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">Escolha o tipo de sessão e horário</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {activeSessionTypes.map((sessionType) => (
                    <label
                      key={sessionType.name}
                      className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-purple-300 ${
                        formData.sessionType === sessionType.name
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sessionType"
                        value={sessionType.name}
                        checked={formData.sessionType === sessionType.name}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, sessionType: e.target.value as SessionType }))
                        }
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3">
                        <span className="text-xl sm:text-2xl">{sessionType.icon}</span>
                        <div>
                          <div className="text-sm sm:text-base font-medium text-gray-800 dark:text-white">{sessionType.label}</div>
                          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              {sessionType.description}
                            </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                    Horários Disponíveis
                  </label>
                  
                  {loadingSlots ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Carregando horários disponíveis...</p>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Nenhum horário disponível nos próximos 30 dias.
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                        Entre em contato para agendar em outras datas.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                      <div className="grid grid-cols-1 gap-2 p-2">
                        {availableSlots.map((slot, index) => (
                          <button
                            key={index}
                            onClick={() => handleSlotSelect(slot)}
                            className={`w-full p-3 rounded-lg border-2 transition-all text-left hover:border-gray-400 ${
                              formData.scheduledDate === slot.datetime
                                ? 'border-gray-600 bg-gray-100 dark:bg-gray-700'
                                : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <div>
                                  <div className="text-sm font-medium text-gray-800 dark:text-white">
                                    {slot.date}
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {slot.time}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-sm font-bold text-green-600">
                                  {formatCurrency(slot.price)}
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </p>
                  )}
                </div>

                {price > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm sm:text-base font-medium text-green-800 dark:text-green-200">Valor da Sessão</p>
                        <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                          {settings.minimum_photos} fotos mínimas incluídas
                        </p>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-green-600">
                        {formatCurrency(price)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Personal Data */}
            {currentStep === 2 && (
              <div className="space-y-4 sm:space-y-6">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">Seus dados</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, clientName: e.target.value }))
                      }
                      className="w-full pl-8 sm:pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                      placeholder="Digite seu nome completo"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="tel"
                      value={formData.clientPhone}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, clientPhone: e.target.value }))
                      }
                      className="w-full pl-8 sm:pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                      placeholder="(11) 99999-9999"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    E-mail (opcional)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, clientEmail: e.target.value }))
                      }
                      className="w-full pl-8 sm:pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                      placeholder="seuemail@exemplo.com"
                    />
                  </div>
                </div>

                <SessionDetailsForm
                  sessionType={formData.sessionType}
                  details={formData.sessionDetails}
                  onChange={(details) =>
                    setFormData(prev => ({ ...prev, sessionDetails: details }))
                  }
                />
              </div>
            )}

            {/* Step 3: Terms and Confirmation */}
            {currentStep === 3 && (
              <div className="space-y-4 sm:space-y-6">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">Confirmação</h2>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <h3 className="text-sm sm:text-base font-medium text-gray-800 dark:text-white">Resumo do Agendamento</h3>
                  
                  {(() => {
                    const selectedSessionType = activeSessionTypes.find(st => st.name === formData.sessionType);
                    return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
                      <span className="ml-2 font-medium">
                        {selectedSessionType?.icon} {selectedSessionType?.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Data:</span>
                      <span className="ml-2 font-medium">
                        {new Date(formData.scheduledDate).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Cliente:</span>
                      <span className="ml-2 font-medium">{formData.clientName}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {formatCurrency(price)}
                      </span>
                    </div>
                  </div>
                    );
                  })()}
                </div>

                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-medium text-gray-800 dark:text-white mb-3">Termos e Condições</h3>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line max-h-32 overflow-y-auto">
                    {settings?.terms_conditions}
                  </div>
                </div>

                <label className="flex items-start space-x-2 sm:space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.termsAccepted}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, termsAccepted: e.target.checked }))
                    }
                    className="mt-0.5 sm:mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600 rounded"
                    required
                  />
                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    Li e aceito os termos e condições do serviço
                  </span>
                </label>
              </div>
            )}

            {/* Navigation Buttons */}
            {currentStep < 4 && (
            <div className="flex flex-col sm:flex-row justify-between mt-6 sm:mt-8 space-y-3 sm:space-y-0">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-4 sm:px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm sm:text-base order-2 sm:order-1"
                >
                  Voltar
                </button>
              )}
              
              <div className="sm:ml-auto order-1 sm:order-2">
                {currentStep < 3 ? (
                  <button
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    disabled={!isStepValid()}
                    className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!isStepValid() || isSubmitting || !mpSettings}
                    className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>Gerar PIX</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            )}

            {!mpSettings && (
              <div className="mt-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-xs sm:text-sm text-red-800 dark:text-red-200">
                  Sistema de pagamento não configurado. Entre em contato com o estúdio.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}