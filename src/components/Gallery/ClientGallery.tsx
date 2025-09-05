import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, MessageSquare, Check, X, Send, AlertTriangle, Clock, Expand } from 'lucide-react';
import { useGalleries } from '../../hooks/useGalleries';
import { supabase } from '../../lib/supabase';
import { Photo } from '../../types';
import { PhotoCard } from './PhotoCard';
import { PhotoLightbox } from './PhotoLightbox';

export function ClientGallery() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { getGalleryByToken, updatePhotoSelection, submitSelection } = useGalleries();
  
  const [gallery, setGallery] = useState<any>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [photoComments, setPhotoComments] = useState<Record<string, string>>({});
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentingPhoto, setCommentingPhoto] = useState<string | null>(null);
  const [tempComment, setTempComment] = useState('');
  const [viewMode, setViewMode] = useState<'masonry' | 'grid'>('masonry');

  useEffect(() => {
    if (token) {
      loadGallery();
    }
  }, [token]);

  const loadGallery = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const result = await getGalleryByToken(token);
      
      if (!result) {
        setError('Galeria não encontrada ou link inválido');
        return;
      }

      const { gallery: galleryData, photos: photosData } = result;
      
      // Check if gallery is expired
      const now = new Date();
      const expirationDate = new Date(galleryData.link_expires_at);
      
      if (now > expirationDate) {
        setError('Esta galeria expirou');
        return;
      }

      setGallery(galleryData);
      setPhotos(photosData);
      setSelectedPhotos(galleryData.photos_selected || []);
      
      // Load existing comments from photo metadata
      const comments: Record<string, string> = {};
      photosData.forEach((photo: Photo) => {
        if (photo.metadata?.client_comment) {
          comments[photo.id] = photo.metadata.client_comment;
        }
      });
      setPhotoComments(comments);
      
    } catch (err) {
      console.error('Erro ao carregar galeria:', err);
      setError('Erro ao carregar galeria');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelection = async (photoId: string) => {
    const newSelection = selectedPhotos.includes(photoId)
      ? selectedPhotos.filter(id => id !== photoId)
      : [...selectedPhotos, photoId];
    
    setSelectedPhotos(newSelection);
    
    // Update in database
    if (gallery) {
      await updatePhotoSelection(gallery.id, newSelection);
    }
  };

  const handleSubmitSelection = async () => {
    if (!gallery) return;
    
    const minimumPhotos = gallery.appointment?.minimum_photos || 5;
    
    // Validar quantidade mínima
    if (selectedPhotos.length < minimumPhotos) {
      alert(`Você deve selecionar pelo menos ${minimumPhotos} fotos para finalizar sua seleção.`);
      return;
    }

    const extraPhotos = selectedPhotos.length - minimumPhotos;
    
    // Se seleção exata, confirmar diretamente
    if (extraPhotos === 0) {
      if (!confirm(`Confirmar seleção de ${selectedPhotos.length} fotos? Esta ação não pode ser desfeita.`)) {
        return;
      }
      
      setSubmitting(true);
      try {
        const success = await submitSelection(gallery.id, selectedPhotos);
        
        if (success) {
          alert('Seleção confirmada com sucesso! Você receberá suas fotos editadas em breve.');
          await loadGallery();
        } else {
          alert('Erro ao confirmar seleção. Tente novamente.');
        }
      } catch (error) {
        console.error('Erro ao submeter seleção:', error);
        alert('Erro ao confirmar seleção. Tente novamente.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    
    // Se há fotos extras, gerar pagamento
    if (extraPhotos > 0) {
      await handleExtraPhotosPayment(extraPhotos);
    }
  };

  const handleExtraPhotosPayment = async (extraPhotos: number) => {
    try {
      // Buscar configurações de preço
      const { data: settings } = await supabase
        .from('settings')
        .select('price_commercial_hour')
        .single();

      const pricePerPhoto = settings?.price_commercial_hour || 30;
      const totalAmount = extraPhotos * pricePerPhoto;
      
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(totalAmount);

      if (!confirm(`Você selecionou ${extraPhotos} fotos extras.\n\nValor adicional: ${formattedAmount}\n\nDeseja prosseguir com o pagamento?`)) {
        return;
      }

      setSubmitting(true);
      
      // Criar preferência de pagamento no MercadoPago
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago?action=create-preference`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Fotos Extras - ${extraPhotos} fotos`,
          amount: totalAmount,
          external_reference: `${gallery.appointment.id}-extra-${Date.now()}`,
          payer: {
            name: gallery.appointment?.client?.name || 'Cliente',
            email: gallery.appointment?.client?.email || 'cliente@exemplo.com',
            phone: {
              area_code: '11',
              number: gallery.appointment?.client?.phone?.replace(/\D/g, '').slice(-9) || '999999999'
            },
            cpf: '12345678909'
          },
          back_urls: {
            success: `${window.location.origin}/gallery/${token}?payment=success`,
            failure: `${window.location.origin}/gallery/${token}?payment=failure`,
            pending: `${window.location.origin}/gallery/${token}?payment=pending`
          },
          notification_url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-webhook`
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.payment_link) {
          // Salvar seleção antes de redirecionar para pagamento
          await submitSelection(gallery.id, selectedPhotos);
          
          // Redirecionar para página de pagamento
          window.open(result.payment_link, '_blank');
          
          alert('Seleção salva! Complete o pagamento das fotos extras na nova aba.');
        } else {
          throw new Error(result.error || 'Erro ao criar pagamento');
        }
      } else {
        throw new Error('Erro na comunicação com o servidor');
      }
    } catch (error) {
      console.error('Erro ao processar pagamento de fotos extras:', error);
      alert('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };


  const handlePhotoClick = (photo: Photo, index: number) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  };

  const handleAddComment = (photoId: string) => {
    setCommentingPhoto(photoId);
    setTempComment(photoComments[photoId] || '');
    setShowCommentModal(true);
  };

  const handleSaveComment = () => {
    if (commentingPhoto) {
      setPhotoComments(prev => ({
        ...prev,
        [commentingPhoto]: tempComment
      }));
    }
    setShowCommentModal(false);
    setCommentingPhoto(null);
    setTempComment('');
  };

  const getDaysUntilExpiration = () => {
    if (!gallery?.link_expires_at) return null;
    
    const now = new Date();
    const expiration = new Date(gallery.link_expires_at);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const daysUntilExpiration = getDaysUntilExpiration();
  const isExpired = daysUntilExpiration !== null && daysUntilExpiration <= 0;

  // Get cover photo
  const coverPhoto = gallery?.cover_photo_id 
    ? photos.find(p => p.id === gallery.cover_photo_id) || photos[0]
    : photos[0];

  const selectedCount = selectedPhotos.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Galeria Indisponível</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Galeria não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section with Cover Photo */}
      {coverPhoto && (
        <div className="relative h-96 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${coverPhoto.url})` }}
          />
          <div className="absolute inset-0 bg-black bg-opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          
          <div className="relative h-full flex items-end">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
              <div className="text-white">
                <h1 className="text-4xl md:text-5xl font-bold mb-2">{gallery.name}</h1>
                <div className="flex items-center gap-4 text-lg opacity-90">
                  <span>{new Date(gallery.created_at).toLocaleDateString('pt-BR')}</span>
                  {daysUntilExpiration !== null && (
                    <>
                      <span>•</span>
                      <div className={`flex items-center gap-1 ${isExpired ? 'text-red-300' : daysUntilExpiration <= 7 ? 'text-yellow-300' : 'text-green-300'}`}>
                        <Clock size={16} />
                        <span>
                          {isExpired 
                            ? 'Expirada' 
                            : daysUntilExpiration === 1 
                              ? '1 dia restante'
                              : `${daysUntilExpiration} dias restantes`
                          }
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {photos.length} fotos disponíveis
                </div>
              </div>

              <div className="flex items-center gap-3">
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selection Completed Banner */}
      {gallery.selection_completed && (
        <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-3">
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-green-800 dark:text-green-200 font-medium">
                  Seleção confirmada em {new Date(gallery.selection_submitted_at).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-green-700 dark:text-green-300 text-sm">
                  Suas fotos editadas serão entregues em breve. Obrigado!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <Camera size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nenhuma foto encontrada
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Esta galeria ainda não possui fotos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {photos.map((photo, index) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                isSelected={selectedPhotos.includes(photo.id)}
                canSelect={!gallery.selection_completed}
                onToggleSelection={() => handlePhotoSelection(photo.id)}
                onViewFullSize={() => handlePhotoClick(photo, index)}
                hasComment={!!photoComments[photo.id]}
                onAddComment={() => handleAddComment(photo.id)}
                canComment={!gallery.selection_completed}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        photos={photos}
        currentIndex={currentPhotoIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setCurrentPhotoIndex}
      />

      {/* Comment Modal */}
      {showCommentModal && commentingPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Adicionar Comentário
                </h3>
                <button
                  onClick={() => setShowCommentModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instruções para edição desta foto:
                </label>
                <textarea
                  value={tempComment}
                  onChange={(e) => setTempComment(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ex: Clarear um pouco, remover objeto do fundo, ajustar cores..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCommentModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveComment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Salvar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selection Summary - Fixed Bottom */}
      {!gallery.selection_completed && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {selectedCount > 0 ? (
                  <div className="flex items-center space-x-2">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {selectedCount} fotos selecionadas
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      Selecione suas fotos favoritas
                    </span>
                  </div>
                )}
                
                {gallery.appointment?.minimum_photos && (
                  <div className="text-sm">
                    {selectedCount < gallery.appointment.minimum_photos ? (
                      <span className="text-red-600 dark:text-red-400">
                        Mínimo: {gallery.appointment.minimum_photos} fotos (faltam {gallery.appointment.minimum_photos - selectedCount})
                      </span>
                    ) : selectedCount === gallery.appointment.minimum_photos ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ Mínimo atingido: {gallery.appointment.minimum_photos} fotos
                      </span>
                    ) : (
                      <span className="text-purple-600 dark:text-purple-400">
                        {gallery.appointment.minimum_photos} incluídas + {selectedCount - gallery.appointment.minimum_photos} extras
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {selectedCount > 0 && (
                  <button
                    onClick={() => setSelectedPhotos([])}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                  >
                    Limpar Seleção
                  </button>
                )}
                
                <button
                  onClick={handleSubmitSelection}
                  disabled={submitting || selectedCount === 0}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>
                    {submitting ? 'Processando...' : 
                     selectedCount === 0 ? 'Selecione fotos' :
                     selectedCount < (gallery.appointment?.minimum_photos || 5) ? 'Selecione mais fotos' :
                     selectedCount === (gallery.appointment?.minimum_photos || 5) ? 'Confirmar Seleção' :
                     'Confirmar e Pagar Extras'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}