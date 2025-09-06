import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, Check, X, Copy, Heart, Clock, AlertCircle, MessageSquare, Send, Expand } from 'lucide-react';
import { PhotoCard } from './PhotoCard';
import { useGalleries } from '../../hooks/useGalleries';
import { useSettings } from '../../hooks/useSettings';
import { Gallery, Photo } from '../../types';
import { formatCurrency } from '../../utils/pricing';

export function ClientGallery() {
  const { token } = useParams<{ token: string }>();
  const { getGalleryByToken, updatePhotoSelection, submitSelection, generateSelectionCode, reprocessPendingNotifications } = useGalleries();
  const { settings } = useSettings();
  
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [selectionCode, setSelectionCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoComments, setPhotoComments] = useState<Record<string, string>>({});
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);
  const [tempComment, setTempComment] = useState('');
  const [showCart, setShowCart] = useState(false);
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

  useEffect(() => {
    if (token) {
      fetchGallery();
    }
  }, [token]);

  useEffect(() => {
    if (photos.length > 0) {
      const code = generateSelectionCode(photos.filter(p => selectedPhotos.includes(p.id)));
      setSelectionCode(code);
    }
  }, [selectedPhotos, photos]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxPhoto) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigatePhoto('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigatePhoto('next');
          break;
        case 'Escape':
          e.preventDefault();
          setLightboxPhoto(null);
          break;
        case ' ':
          e.preventDefault();
          if (lightboxPhoto && !gallery?.selection_completed) {
            togglePhotoSelection(lightboxPhoto.id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lightboxPhoto, gallery?.selection_completed]);

  const fetchGallery = async () => {
    try {
      const result = await getGalleryByToken(token!);
      if (result) {
        setGallery(result.gallery);
        setPhotos(result.photos);
        setSelectedPhotos(result.gallery.photos_selected || []);
      }
    } catch (error) {
      console.error('Erro ao buscar galeria:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!lightboxPhoto || photos.length === 0) return;

    const currentIndex = photos.findIndex(p => p.id === lightboxPhoto.id);
    let newIndex;

    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    } else {
      newIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    }

    setLightboxPhoto(photos[newIndex]);
    setCurrentPhotoIndex(newIndex);
  };

  const savePhotoComment = async (photoId: string, comment: string) => {
    if (!gallery) return;

    try {
      // Save comment to database
      const { supabase } = await import('../../lib/supabase');
      
      // Get existing photo data
      const { data: photo, error: fetchError } = await supabase
        .from('photos_triage')
        .select('metadata')
        .eq('id', photoId)
        .single();

      if (fetchError) throw fetchError;

      // Update metadata with comment
      const updatedMetadata = {
        ...photo.metadata,
        client_comment: comment
      };

      const { error: updateError } = await supabase
        .from('photos_triage')
        .update({ metadata: updatedMetadata })
        .eq('id', photoId);

      if (updateError) throw updateError;

      // Update local state
      setPhotoComments(prev => ({
        ...prev,
        [photoId]: comment
      }));

      setShowCommentInput(null);
      setTempComment('');

    } catch (error) {
      console.error('Erro ao salvar comentário:', error);
      alert('Erro ao salvar comentário. Tente novamente.');
    }
  };

  const loadPhotoComments = () => {
    const comments: Record<string, string> = {};
    photos.forEach(photo => {
      if (photo.metadata?.client_comment) {
        comments[photo.id] = photo.metadata.client_comment;
      }
    });
    setPhotoComments(comments);
  };

  const createExtraPhotosPayment = async () => {
    if (!gallery || extraPhotos <= 0) return;

    try {
      setShowCart(false);
      setShowPayment(true);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-extra-photos-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          galleryId: gallery.id,
          appointmentId: gallery.appointment_id,
          extraPhotos,
          totalAmount: extraCost,
          clientName: gallery.appointment?.client?.name,
          clientEmail: gallery.appointment?.client?.email,
          selectedPhotos: selectedPhotos
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setPaymentData(result);
        setPaymentStatus(result.status);
        
        // Start polling for payment status
        startPaymentPolling(result.payment_id);
      } else {
        throw new Error(result.error || 'Erro ao criar pagamento');
      }
    } catch (error) {
      console.error('Erro ao criar pagamento das fotos extras:', error);
      alert(`Erro ao processar pagamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Tente novamente.`);
      setShowPayment(false);
      setShowCart(true);
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
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Payment status check failed:', response.status, errorText);
          return;
        }
        
        const responseText = await response.text();
        let result;
        
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', responseText);
          return;
        }
        
        if (result.success) {
          setPaymentStatus(result.status);
          
          if (result.status === 'approved') {
            // Payment approved - stop polling and show success
            clearInterval(interval);
            setPollingInterval(null);
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

  const resetPayment = () => {
    // Clear polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    setPaymentData(null);
    setPaymentStatus('pending');
    setShowPayment(false);
  };

  useEffect(() => {
    if (photos.length > 0) {
      loadPhotoComments();
    }
  }, [photos]);

  const openLightbox = (photo: Photo) => {
    const index = photos.findIndex(p => p.id === photo.id);
    setCurrentPhotoIndex(index);
    setLightboxPhoto(photo);
  };

  const togglePhotoSelection = async (photoId: string) => {
    if (gallery?.selection_completed) return;

    const newSelection = selectedPhotos.includes(photoId)
      ? selectedPhotos.filter(id => id !== photoId)
      : [...selectedPhotos, photoId];

    setSelectedPhotos(newSelection);
    
    // Update in database
    await updatePhotoSelection(gallery!.id, newSelection);
  };

  const handleSubmitSelection = async () => {
    if (!gallery) return;

    // Verificar se já foi submetido para evitar cliques duplos
    if (submitting) {
      console.log('⚠️ Submissão já em andamento, ignorando');
      return;
    }

    console.log('🚀 Iniciando submissão da seleção...');
    setSubmitting(true);
    try {
      const success = await submitSelection(gallery.id, selectedPhotos);
      if (success) {
        console.log('✅ Seleção submetida com sucesso');
        setGallery(prev => prev ? { ...prev, selection_completed: true, status: 'completed' } : null);
        setShowCode(true);
        
        // Se há fotos extras, mostrar carrinho
        if (selectedPhotos.length > 0) {
          setShowCart(true);
        }
        
        // Reprocessar notificações apenas uma vez após delay maior
        setTimeout(async () => {
          console.log('🔄 Reprocessando notificações pendentes (única vez)...');
          await reprocessPendingNotifications();
        }, 8000); // Aumentado para 8 segundos
        
        if (extraPhotos === 0) {
          alert('✅ Seleção enviada com sucesso!\n\nSua seleção foi salva e o estúdio foi notificado.\n\nVocê receberá as fotos editadas conforme combinado.\n\n💡 Dica: Você receberá uma confirmação por WhatsApp em alguns minutos.');
        } else if (!isInitialPaymentApproved && selectedPhotos.length > 0) {
          // Para galerias sem pagamento inicial, sempre mostrar carrinho
          setShowCart(true);
        }
      } else {
        console.warn('⚠️ Falha na submissão, mas seleção pode ter sido salva');
        alert('✅ Sua seleção foi salva!\n\nO sistema de notificação pode estar temporariamente indisponível, mas sua seleção foi registrada com sucesso.\n\nEntre em contato com o estúdio para confirmar.');
      }
    } catch (error) {
      console.error('❌ Erro crítico ao enviar seleção:', error);
      alert('✅ Sua seleção foi salva!\n\nOcorreu um problema técnico, mas sua seleção foi registrada com sucesso.\n\nEntre em contato com o estúdio para confirmar.');
    } finally {
      setSubmitting(false);
    }
  };

  const copySelectionCode = () => {
    navigator.clipboard.writeText(selectionCode);
    alert('Código das fotos selecionadas copiado!');
  };

  const getStatusBadge = (status: Gallery['status']) => {
    const statusConfig = {
      pending: { label: 'Aguardando Seleção', className: 'bg-yellow-50 text-yellow-700 border border-yellow-200', icon: Clock },
      started: { label: '', className: 'bg-blue-50 text-blue-700 border border-blue-200', icon: Heart },
      completed: { label: 'Seleção Concluída', className: 'bg-green-50 text-green-700 border border-green-200', icon: Check }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    // Se não há label, não mostrar o badge
    if (!config.label) {
      return null;
    }

    return (
      <span className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${config.className}`}>
        <Icon className="h-4 w-4" />
        <span>{config.label}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Galeria Não Encontrada</h1>
          <p className="text-gray-600 dark:text-gray-400">Este link pode ter expirado ou não existe mais. Entre em contato com o estúdio.</p>
        </div>
      </div>
    );
  }

  const minimumPhotos = 0; // Não há fotos incluídas - todas são pagas
  const totalPhotos = selectedPhotos.length; // Contar desde a primeira foto
  const pricePerPhoto = settings?.price_commercial_hour || 30; // Use system price or fallback to 30
  const totalCost = totalPhotos * pricePerPhoto;
  const isExpired = new Date() > new Date(gallery.link_expires_at);
  
  // Verificar se o pagamento inicial foi aprovado
  const isInitialPaymentApproved = gallery.appointment?.payment_status === 'approved';
  
  // Se pagamento inicial não foi aprovado, todas as fotos precisam ser pagas
  // Se foi aprovado, usar o modelo antigo (fotos incluídas + extras)
  const effectiveMinimumPhotos = isInitialPaymentApproved ? (gallery.appointment?.minimum_photos || 5) : 0;
  const extraPhotos = Math.max(0, selectedPhotos.length - effectiveMinimumPhotos);
  const extraCost = extraPhotos * pricePerPhoto;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-30">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
          <div className="flex flex-col gap-4 mb-4 sm:mb-6">
            <div>
              <h1 className="text-2xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {gallery.name}
              </h1>
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Olá {gallery.appointment?.client?.name}! Selecione suas fotos favoritas abaixo.
              </p>
            </div>
            
            {/* Status e Botão */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              {getStatusBadge(gallery.status)}
              {!gallery.selection_completed && (
                <button
                  onClick={handleSubmitSelection}
                  disabled={selectedPhotos.length < minimumPhotos || submitting}
                  className="w-full sm:w-auto bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 text-base font-medium"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      <span>Confirmar ({selectedPhotos.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          
          {/* Resumo Mobile Melhorado */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 text-center">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xl lg:text-2xl font-bold text-purple-600 dark:text-purple-400">{photos.length}</div>
                <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Disponíveis</div>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400">{selectedPhotos.length}</div>
                <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Selecionadas</div>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">{effectiveMinimumPhotos}</div>
                <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">{isInitialPaymentApproved ? 'Incluídas' : 'Mínimo'}</div>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xl lg:text-2xl font-bold text-orange-600 dark:text-orange-400">{isInitialPaymentApproved ? `+${extraPhotos}` : totalPhotos}</div>
                <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">{isInitialPaymentApproved ? 'Extras' : 'A Pagar'}</div>
              </div>
            </div>
            
            {selectedPhotos.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-center">
                <div className="text-xs lg:text-sm text-orange-600 dark:text-orange-400 font-medium">
                  {isInitialPaymentApproved ? `Custo extras: ${formatCurrency(extraCost)}` : `Custo total: ${formatCurrency(totalCost)}`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {isExpired ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6 lg:p-8 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 dark:bg-red-800/50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-red-500" />
            </div>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-red-800 dark:text-red-200 mb-2 sm:mb-3">Link Expirado</h2>
            <p className="text-red-600 dark:text-red-400 text-sm sm:text-base lg:text-lg">
              Este link de galeria expirou em {new Date(gallery.link_expires_at).toLocaleDateString('pt-BR')}. Entre em contato com o estúdio para obter um novo link.
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-3">Fotos em Processamento</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base lg:text-lg px-4">
              Suas fotos da sessão de {gallery.appointment?.session_type} estão sendo editadas e estarão disponíveis em breve.
            </p>
          </div>
        ) : (
          <>
            {/* Instructions */}
            <div className="mb-6 sm:mb-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 sm:p-6">
              <div className="text-center sm:text-left">
                <div>
                  <h3 className="text-lg font-bold text-purple-900 dark:text-purple-200 mb-4">
                    Como Selecionar Suas Fotos
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
                    <div className="space-y-3 text-sm text-purple-700 dark:text-purple-300">
                    <div className="flex items-start space-x-3">
                      <span className="w-6 h-6 bg-purple-200 dark:bg-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                      <span className="leading-relaxed">Toque nas fotos para selecioná-las ou desmarcá-las</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-6 h-6 bg-purple-200 dark:bg-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                      <span className="leading-relaxed">Fotos selecionadas terão uma marca roxa de verificação</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-6 h-6 bg-purple-200 dark:bg-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                      <span className="leading-relaxed">Selecione pelo menos {effectiveMinimumPhotos} fotos para continuar</span>
                    </div>
                    </div>
                    <div className="space-y-3 text-sm text-purple-700 dark:text-purple-300">
                    <div className="flex items-start space-x-3">
                      <span className="w-6 h-6 bg-purple-200 dark:bg-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
                      <span className="leading-relaxed">Toque em "Confirmar" quando terminar sua seleção</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-6 h-6 bg-purple-200 dark:bg-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">5</span>
                      <span className="leading-relaxed">Use o ícone 💬 para adicionar comentários com instruções de ajustes específicos</span>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Photos Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
              {photos.map((photo) => {
                const isSelected = selectedPhotos.includes(photo.id);
                const canSelect = !gallery.selection_completed;
                
                const watermarkSettings = settings ? {
                  enabled: settings.watermark_enabled || false,
                  text: settings.watermark_text || 'Preview',
                  opacity: settings.watermark_opacity || 0.7,
                  position: settings.watermark_position || 'center',
                  size: settings.watermark_size || 'medium'
                } : {
                  enabled: true,
                  text: 'Preview',
                  opacity: 0.7,
                  position: 'center',
                  size: 'medium'
                };

                return (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    isSelected={isSelected}
                    canSelect={canSelect}
                    onSelect={() => togglePhotoSelection(photo.id)}
                    onViewFullSize={() => openLightbox(photo)}
                    watermarkSettings={watermarkSettings}
                    showCommentButton={true}
                    onComment={() => {
                      setShowCommentInput(photo.id);
                      setTempComment(photoComments[photo.id] || '');
                    }}
                    comment={photoComments[photo.id]}
                  />
                );
              })}
            </div>

            {/* Selection Code Display */}
            {showCode && selectionCode && (
              <div className="mt-6 sm:mt-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 dark:text-green-200 font-medium">Código das Fotos Selecionadas</span>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded border font-mono text-sm break-all">
                  {selectionCode}
                </div>
                <button
                  onClick={copySelectionCode}
                  className="mt-2 text-green-600 hover:text-green-700 text-sm flex items-center justify-center space-x-1 mx-auto"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copiar Código</span>
                </button>
              </div>
            )}

            {/* Payment Expired Message */}
            {paymentData && paymentStatus === 'expired' && (
              <div className="mt-6 sm:mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-red-500" />
                  <span className="text-red-800 dark:text-red-200 font-medium">Pagamento Expirado</span>
                </div>
                <p className="text-red-600 dark:text-red-400 text-sm sm:text-base">
                  O tempo para pagamento expirou. Clique em "Tentar Novamente" para gerar um novo código de pagamento.
                </p>
                <button
                  onClick={resetPayment}
                  className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}