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
  const [showIdentificationForm, setShowIdentificationForm] = useState(false);
  const [clientData, setClientData] = useState({
    name: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    if (token) {
      fetchGallery();
      updateMetaTags();
    }
  }, [token]);

  const updateMetaTags = async () => {
    if (!token) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gallery-og-image?token=${token}&format=json`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update meta tags
        updateMetaTag('og:title', data.title);
        updateMetaTag('og:description', data.description);
        updateMetaTag('og:image', data.image);
        updateMetaTag('twitter:card', 'summary_large_image');
        updateMetaTag('twitter:title', data.title);
        updateMetaTag('twitter:description', data.description);
        updateMetaTag('twitter:image', data.image);

        // Update page title
        document.title = data.title;
      }
    } catch (error) {
      console.error('Error updating meta tags:', error);
    }
  };

  const updateMetaTag = (property: string, content: string) => {
    if (!content) return;

    let element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!element) {
      element = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
    }

    if (element) {
      element.content = content;
    } else {
      const meta = document.createElement('meta');
      if (property.startsWith('og:') || property.startsWith('twitter:')) {
        meta.setAttribute('property', property);
      } else {
        meta.setAttribute('name', property);
      }
      meta.content = content;
      document.head.appendChild(meta);
    }
  };

  useEffect(() => {
    if (photos.length > 0) {
      const code = generateSelectionCode(photos.filter(p => selectedPhotos.includes(p.id)));
      setSelectionCode(code);
    }
  }, [selectedPhotos, photos]);

  // Keyboard navigation for lightbox + Protection against screenshots
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Block screenshot shortcuts
      if (
        (e.key === 'PrintScreen') ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) || // Mac screenshots
        (e.metaKey && e.shiftKey && e.key === 's') || // Some screenshot tools
        (e.ctrlKey && e.key === 'PrintScreen') // Windows
      ) {
        e.preventDefault();
        alert('Screenshots estão desabilitados nesta galeria. As fotos estarão disponíveis após a compra.');
        return;
      }

      // Block save shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        return;
      }

      // Lightbox navigation only when lightbox is open
      if (!lightboxPhoto) return;

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

    // Disable right-click on entire page
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
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
        .from('triagem_photos')
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
        .from('triagem_photos')
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

            // Se for galeria pública, finalizar a seleção
            if (gallery?.is_public) {
              alert('✅ Pagamento confirmado!\n\nSua seleção foi finalizada com sucesso.\n\nVocê receberá as fotos editadas no prazo combinado.');
              setShowPayment(false);
              setGallery(prev => prev ? { ...prev, selection_completed: true, status: 'completed' } : null);
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

    // Se for galeria pública, mostrar formulário de identificação primeiro
    if (gallery.is_public) {
      setShowIdentificationForm(true);
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

        // Calcular fotos extras
        const extrasCount = Math.max(0, selectedPhotos.length - (gallery.appointment?.minimum_photos || 5));

        // Se há fotos extras, mostrar carrinho
        if (extrasCount > 0) {
          setShowCart(true);
        } else {
          alert('✅ Seleção enviada com sucesso!\n\nSua seleção foi salva e o estúdio foi notificado.\n\nVocê receberá as fotos editadas conforme combinado.\n\n💡 Dica: Você receberá uma confirmação por WhatsApp em alguns minutos.');
        }

        // Aguardar upload mínimo de fotos antes de enviar link da galeria
        const minimumPhotosToSend = gallery.appointment?.minimum_photos || 5;

        setTimeout(async () => {
          console.log('🔄 Verificando fotos carregadas antes de enviar notificações...');

          // Verificar quantas fotos estão carregadas na galeria
          const { data: currentPhotos } = await (await import('../../lib/supabase')).supabase
            .from('triagem_photos')
            .select('id')
            .eq('gallery_id', gallery.id);

          const uploadedCount = currentPhotos?.length || 0;

          if (uploadedCount >= minimumPhotosToSend) {
            console.log(`✅ ${uploadedCount} fotos carregadas (mínimo: ${minimumPhotosToSend}), processando notificações...`);
            await reprocessPendingNotifications();
          } else {
            console.log(`⏳ Apenas ${uploadedCount}/${minimumPhotosToSend} fotos carregadas, aguardando mais uploads...`);
          }
        }, 10000); // Delay de 10 segundos para dar tempo do upload
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

  const handleIdentificationSubmit = async () => {
    if (!gallery || !clientData.name || !clientData.phone) {
      alert('Por favor, preencha nome e telefone.');
      return;
    }

    setSubmitting(true);
    try {
      const totalAmount = selectedPhotos.length * (gallery.price_per_photo || 0);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-public-gallery-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            parentGalleryId: gallery.id,
            clientName: clientData.name,
            clientPhone: clientData.phone,
            clientEmail: clientData.email || null,
            selectedPhotos: selectedPhotos,
            totalAmount: totalAmount,
            eventName: gallery.event_name || gallery.name
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Payment error:', errorData);
        throw new Error(errorData.error || 'Erro ao gerar pagamento');
      }

      const payment = await response.json();

      if (!payment.success) {
        throw new Error(payment.error || 'Erro ao gerar pagamento');
      }

      setPaymentData(payment);
      setShowIdentificationForm(false);
      setShowPayment(true);

      // Iniciar polling do status do pagamento
      startPaymentPolling(payment.payment_id);

    } catch (error) {
      console.error('Erro ao processar identificação:', error);
      alert('Erro ao processar seus dados. Tente novamente.');
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

  // Galerias manuais (sem appointment_id) cobram desde a primeira foto
  // Galerias de pacotes cobram apenas acima do mínimo
  const isManualGallery = !gallery.appointment_id;
  const minimumPhotos = isManualGallery ? 0 : (gallery.appointment?.minimum_photos || 5);
  const extraPhotos = Math.max(0, selectedPhotos.length - minimumPhotos);
  const pricePerPhoto = settings?.price_commercial_hour || 30;
  const extraCost = extraPhotos * pricePerPhoto;
  const isExpired = new Date() > new Date(gallery.link_expires_at);

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
                  disabled={(isManualGallery ? selectedPhotos.length === 0 : selectedPhotos.length < minimumPhotos) || submitting}
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
            {isManualGallery ? (
              // Layout para galerias manuais (sem pacote)
              <div className="grid grid-cols-2 gap-3 lg:gap-4 text-center">
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-xl lg:text-2xl font-bold text-purple-600 dark:text-purple-400">{photos.length}</div>
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Disponíveis</div>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400">{selectedPhotos.length}</div>
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Selecionadas</div>
                </div>
              </div>
            ) : (
              // Layout para galerias de pacotes
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
                  <div className="text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">{minimumPhotos}</div>
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Incluídas</div>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-xl lg:text-2xl font-bold text-orange-600 dark:text-orange-400">+{extraPhotos}</div>
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Extras</div>
                </div>
              </div>
            )}

            {extraPhotos > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-center">
                <div className="text-xs lg:text-sm text-orange-600 dark:text-orange-400 font-medium">
                  {isManualGallery ? 'Custo total:' : 'Custo adicional:'} {formatCurrency(extraCost)}
                </div>
              </div>
            )}
          </div>

          {/* Protection Notice */}
          {!gallery.selection_completed && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
              <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
                🔒 As fotos estão protegidas. Download disponível após a compra.
              </p>
            </div>
          )}
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
                    {!isManualGallery && (
                      <div className="flex items-start space-x-3">
                        <span className="w-6 h-6 bg-purple-200 dark:bg-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                        <span className="leading-relaxed">Selecione pelo menos {minimumPhotos} fotos para continuar</span>
                      </div>
                    )}
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
            <div className="grid grid-cols-1 gap-4">
              {photos.map((photo) => {
                const isSelected = selectedPhotos.includes(photo.id);
                const canSelect = !gallery.selection_completed;

                const watermarkSettings = settings ? {
                  enabled: settings.watermark_enabled || false,
                  text: settings.watermark_text || 'Preview',
                  opacity: settings.watermark_opacity || 0.7,
                  position: settings.watermark_position || 'center',
                  size: settings.watermark_size || 'medium',
                  watermark_image_url: settings.watermark_image_url
                } : undefined;

                return (
                  <div key={photo.id} className="w-full">
                    <PhotoCard
                      photo={photo}
                      isSelected={isSelected}
                      canSelect={canSelect}
                      onToggleSelection={() => canSelect && togglePhotoSelection(photo.id)}
                      onViewFullSize={() => {
                        if (canSelect) togglePhotoSelection(photo.id);
                      }}
                      hasComment={!!photoComments[photo.id]}
                      watermarkSettings={watermarkSettings}
                      className="w-full h-full"
                      onAddComment={() => {
                        setShowCommentInput(photo.id);
                        setTempComment(photoComments[photo.id] || '');
                      }}
                      canComment={!gallery.selection_completed}
                    />
                  </div>
                );
              })}
            </div>
            
            {!isManualGallery && selectedPhotos.length < minimumPhotos && !gallery.selection_completed && (
              <div className="mt-6 sm:mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-red-700 dark:text-red-300 font-bold">Atenção!</span>
                </div>
                <p className="text-red-700 dark:text-red-300 font-medium text-base">
                  Por favor, selecione pelo menos {minimumPhotos} fotos para continuar
                </p>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  Você selecionou {selectedPhotos.length} de {minimumPhotos} fotos necessárias
                </p>
              </div>
            )}
          </>
        )}

        {/* Duplicate Confirm Button at Bottom */}
        {!gallery?.selection_completed && photos.length > 0 && !isExpired && (
          <div className="mt-8 sm:mt-12 flex justify-center">
            <button
              onClick={handleSubmitSelection}
              disabled={(isManualGallery ? selectedPhotos.length === 0 : selectedPhotos.length < minimumPhotos) || submitting}
              className="w-full sm:w-auto bg-purple-600 text-white px-8 py-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 text-lg font-medium shadow-lg"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Check className="h-6 w-6" />
                  <span>Confirmar Seleção ({selectedPhotos.length})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Lightbox */}
        {lightboxPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-98 flex items-center justify-center z-50 p-1 sm:p-2 lg:p-2">
            <div className="relative w-full h-full max-w-[98vw] max-h-[98vh] flex items-center justify-center">
              {/* Photo Counter */}
              <div className="absolute top-2 sm:top-3 lg:top-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white px-3 sm:px-4 lg:px-6 py-2 sm:py-2 lg:py-3 rounded-xl z-20 backdrop-blur-sm">
                <span className="text-sm sm:text-base lg:text-lg font-medium">
                  {currentPhotoIndex + 1} de {photos.length}
                </span>
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={() => navigatePhoto('prev')}
                className="absolute left-2 sm:left-4 lg:left-8 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-70 text-white rounded-full p-2 sm:p-3 lg:p-4 hover:bg-opacity-90 hover:scale-110 transition-all duration-200 z-20 backdrop-blur-sm shadow-2xl"
                title="Foto anterior (←)"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={() => navigatePhoto('next')}
                className="absolute right-2 sm:right-4 lg:right-8 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-70 text-white rounded-full p-2 sm:p-3 lg:p-4 hover:bg-opacity-90 hover:scale-110 transition-all duration-200 z-20 backdrop-blur-sm shadow-2xl"
                title="Próxima foto (→)"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Close Button */}
              <button
                onClick={() => setLightboxPhoto(null)}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 lg:top-8 lg:right-8 bg-black bg-opacity-70 text-white rounded-full p-2 sm:p-3 lg:p-4 hover:bg-opacity-90 hover:scale-110 hover:bg-red-600 transition-all duration-200 z-20 backdrop-blur-sm shadow-2xl"
                title="Fechar (Esc)"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8" />
              </button>
              
              {/* Photo Name */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">{minimumPhotos}</div>
                <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Incluídas</div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xl lg:text-2xl font-bold text-orange-600 dark:text-orange-400">{extraPhotos}</div>
                <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Extras</div>
              </div>
              
              {photoComments[lightboxPhoto.id] && (
                <div className="absolute top-16 sm:top-20 lg:top-28 left-2 sm:left-4 lg:left-8 bg-blue-600 bg-opacity-95 text-white px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 rounded-xl z-20 max-w-[250px] sm:max-w-[320px] lg:max-w-[500px] backdrop-blur-sm shadow-2xl">
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm sm:text-base lg:text-lg font-medium mb-1 sm:mb-2">Instruções:</div>
                      <div className="text-sm sm:text-base lg:text-lg leading-relaxed">{photoComments[lightboxPhoto.id]}</div>
                    </div>
                  </div>
                </div>
              )}
              
              {extraPhotos > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-center">
                  <div className="text-xs lg:text-sm text-orange-600 dark:text-orange-400 font-medium">
                    Custo adicional: {formatCurrency(extraCost)}
                  </div>
                </div>
              )}
              
              {/* Main Image Container */}
              <div
                className="w-full h-full flex items-center justify-center p-4 sm:p-8 lg:p-12 relative"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              >
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.filename}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl touch-manipulation transition-transform duration-300 select-none pointer-events-none"
                  draggable="false"
                  onContextMenu={(e) => e.preventDefault()}
                  onError={(e) => {
                    // Fallback para imagem de erro
                    const target = e.target as HTMLImageElement;
                    target.src = `https://via.placeholder.com/800x600/f0f0f0/666?text=${encodeURIComponent(lightboxPhoto.filename)}`;
                  }}
                />
                {/* Invisible protection overlay */}
                <div
                  className="absolute inset-0 z-[5]"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                />
              </div>
              
              {/* Selection Button */}
              <div className="absolute bottom-4 sm:bottom-6 lg:bottom-12 left-1/2 transform -translate-x-1/2 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePhotoSelection(lightboxPhoto.id);
                  }}
                  disabled={gallery.selection_completed}
                  className={`px-4 sm:px-6 lg:px-8 py-3 sm:py-3 lg:py-4 rounded-xl text-sm sm:text-base lg:text-lg font-medium transition-all duration-200 backdrop-blur-sm shadow-2xl hover:scale-105 ${
                    selectedPhotos.includes(lightboxPhoto.id)
                      ? 'bg-red-600 bg-opacity-95 text-white hover:bg-red-700 hover:bg-opacity-100'
                      : 'bg-purple-600 bg-opacity-95 text-white hover:bg-purple-700 hover:bg-opacity-100'
                  } disabled:bg-gray-400 disabled:bg-opacity-60 disabled:cursor-not-allowed`}
                >
                  {selectedPhotos.includes(lightboxPhoto.id) ? 
                    <span>Remover Seleção</span> :
                    <span>Selecionar Foto</span>
                  }
                </button>
              </div>

              {/* Keyboard shortcuts guide */}
              <div className="hidden lg:block absolute bottom-4 left-4 lg:bottom-12 lg:left-8 bg-black bg-opacity-90 text-white px-4 sm:px-5 lg:px-6 py-3 sm:py-3 lg:py-4 rounded-xl z-20 backdrop-blur-sm shadow-2xl">
                <div className="text-sm lg:text-base space-y-1 lg:space-y-2">
                  <div className="font-medium mb-2">Atalhos:</div>
                  <div>← → Navegar</div>
                  <div>Espaço: Selecionar</div>
                  <div>Esc: Fechar</div>
                </div>
              </div>

              {/* Comment Button */}
              <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 lg:bottom-12 lg:right-8 z-20">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCommentInput(lightboxPhoto.id);
                    setTempComment(photoComments[lightboxPhoto.id] || '');
                  }}
                  disabled={gallery.selection_completed}
                  className={`p-3 sm:p-3 lg:p-4 rounded-xl text-base sm:text-lg font-medium transition-all duration-200 backdrop-blur-sm shadow-2xl hover:scale-105 ${
                    photoComments[lightboxPhoto.id]
                      ? 'bg-blue-600 bg-opacity-95 text-white hover:bg-blue-700 hover:bg-opacity-100'
                      : 'bg-gray-600 bg-opacity-95 text-white hover:bg-gray-700 hover:bg-opacity-100'
                  } disabled:bg-gray-400 disabled:bg-opacity-60 disabled:cursor-not-allowed`}
                  title="Adicionar comentário para ajustes"
                >
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comment Input Modal */}
        {showCommentInput && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full mx-3 sm:mx-0 p-4 sm:p-6">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
                  Comentário para Ajustes
                </h3>
                <button
                  onClick={() => {
                    setShowCommentInput(null);
                    setTempComment('');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
              
              <div className="mb-3 sm:mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Foto: {photos.find(p => p.id === showCommentInput)?.filename}
                </p>
                <textarea
                  value={tempComment}
                  onChange={(e) => setTempComment(e.target.value)}
                  placeholder="Descreva os ajustes desejados para esta foto:&#10;&#10;• Clarear/escurecer&#10;• Ajustar contraste&#10;• Remover objetos&#10;• Corrigir cores&#10;• Suavizar pele&#10;• Outros ajustes..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none text-sm sm:text-base"
                  rows={6}
                  autoFocus
                />
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowCommentInput(null);
                    setTempComment('');
                  }}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm sm:text-base"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => savePhotoComment(showCommentInput!, tempComment)}
                  className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                >
                  <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>Salvar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Identification Form Modal (Public Gallery) */}
        {showIdentificationForm && gallery?.is_public && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full mx-3 sm:mx-0 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  Identificação
                </h3>
                <button
                  onClick={() => setShowIdentificationForm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Resumo da Seleção */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                      {selectedPhotos.length} {selectedPhotos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
                    </div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(selectedPhotos.length * (gallery.price_per_photo || 0))}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatCurrency(gallery.price_per_photo || 0)} por foto
                    </div>
                  </div>
                </div>

                {/* Informação */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Para finalizar sua seleção, precisamos de alguns dados para contato e entrega das fotos.
                  </p>
                </div>

                {/* Formulário */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={clientData.name}
                      onChange={(e) => setClientData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Telefone/WhatsApp *
                    </label>
                    <input
                      type="tel"
                      value={clientData.phone}
                      onChange={(e) => setClientData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="(00) 00000-0000"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      E-mail (opcional)
                    </label>
                    <input
                      type="email"
                      value={clientData.email}
                      onChange={(e) => setClientData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                {/* Botões */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleIdentificationSubmit}
                    disabled={submitting || !clientData.name || !clientData.phone}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 font-medium"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Processando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        <span>Continuar para Pagamento</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowIdentificationForm(false)}
                    disabled={submitting}
                    className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shopping Cart Modal */}
        {showCart && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full mx-3 sm:mx-0 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  🛒 Fotos Extras Selecionadas
                </h3>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4 sm:space-y-6">
                {/* Resumo */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                      {isManualGallery ? `${selectedPhotos.length} fotos` : `+${extraPhotos} fotos extras`}
                    </div>
                    {!isManualGallery && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Além das {minimumPhotos} fotos incluídas
                      </div>
                    )}
                    <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(extraCost)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatCurrency(pricePerPhoto)} por foto
                    </div>
                  </div>
                </div>

                {/* Informações */}
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-start space-x-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Sua seleção de {selectedPhotos.length} fotos foi confirmada</span>
                  </div>
                  {!isManualGallery && (
                    <div className="flex items-start space-x-2">
                      <Clock className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>As {minimumPhotos} primeiras fotos estão incluídas no pacote</span>
                    </div>
                  )}
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>Para receber {isManualGallery ? 'suas fotos' : `as ${extraPhotos} fotos extras`}, é necessário efetuar o pagamento</span>
                  </div>
                </div>
                
                {/* Botões de Ação */}
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      createExtraPhotosPayment();
                    }}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 font-medium"
                  >
                    <span>💳 {isManualGallery ? 'Pagar Fotos' : 'Pagar Fotos Extras'}</span>
                  </button>
                  
                  <button
                    onClick={() => setShowCart(false)}
                    className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
                
                {/* Nota */}
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  💡 <strong>Importante:</strong> {isManualGallery
                    ? 'Suas fotos serão entregues após a confirmação do pagamento.'
                    : `Você receberá as ${minimumPhotos} fotos incluídas independentemente do pagamento das extras. As fotos extras serão entregues após a confirmação do pagamento.`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPayment && paymentData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full mx-3 sm:mx-0 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <div className="text-center space-y-4 sm:space-y-6">
                {paymentStatus === 'approved' ? (
                  <div className="space-y-4">
                    <div className="text-4xl sm:text-6xl">✅</div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-green-600">
                      Pagamento Aprovado!
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                      {isManualGallery ? `Suas ${extraPhotos} fotos` : `Suas ${extraPhotos} fotos extras`} foram pagas com sucesso!
                    </p>
                    <button
                      onClick={resetPayment}
                      className="w-full bg-green-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
                    >
                      Fechar
                    </button>
                  </div>
                ) : paymentStatus === 'expired' ? (
                  <div className="space-y-4">
                    <div className="text-4xl sm:text-6xl">⏰</div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-orange-600">
                      PIX Expirado
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                      O tempo para pagamento expirou. Gere um novo PIX.
                    </p>
                    <button
                      onClick={() => {
                        resetPayment();
                        setShowCart(true);
                      }}
                      className="w-full bg-orange-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-orange-700 transition-colors text-sm sm:text-base"
                    >
                      Gerar Novo PIX
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="mb-4 sm:mb-6">
                      <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white mb-2">
                        {isManualGallery ? 'Pagar Fotos' : 'Pagar Fotos Extras'}
                      </h2>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        Escaneie o QR Code PIX para pagar {isManualGallery ? 'suas fotos' : 'as fotos extras'}
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                      <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                        {formatCurrency(extraCost)}
                      </div>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        {extraPhotos} fotos × {formatCurrency(pricePerPhoto)}
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
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Ou copie e cole o código PIX:
                        </p>
                        <div className="bg-gray-100 dark:bg-gray-600 p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-mono break-all border">
                          {paymentData.qr_code}
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(paymentData.qr_code || '')}
                          className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Copiar código PIX
                        </button>
                      </div>
                    ) : paymentData.qr_code ? (
                      <div className="mb-4 sm:mb-6">
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Copie e cole o código PIX abaixo:
                        </p>
                        <div className="bg-gray-100 dark:bg-gray-600 p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-mono break-all border">
                          {paymentData.qr_code}
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(paymentData.qr_code || '')}
                          className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Copiar código PIX
                        </button>
                      </div>
                    ) : null}

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
                        onClick={resetPayment}
                        className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 sm:px-6 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm sm:text-base"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-xs sm:text-sm text-green-800 dark:text-green-200">
                        <strong>✅ Importante:</strong> Após a confirmação do pagamento PIX,
                        você receberá {isManualGallery ? `todas as ${selectedPhotos.length} fotos selecionadas` : `as ${extraPhotos} fotos extras`} editadas.
                      </p>
                      {paymentData.expires_at && (
                        <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mt-1">
                          <strong>⏰ Expira em:</strong> {new Date(paymentData.expires_at).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}