import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Heart, Download, MessageSquare, X, Check, ChevronLeft, ChevronRight, Expand, Eye, EyeOff } from 'lucide-react';
import { useGalleries } from '../../hooks/useGalleries';
import { supabase } from '../../lib/supabase';
import { Photo } from '../../types';

interface GalleryData {
  gallery: any;
  photos: Photo[];
}

export function ClientGallery() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { updatePhotoSelection, submitSelection } = useGalleries();
  
  const [galleryData, setGalleryData] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [commentingPhoto, setCommentingPhoto] = useState<Photo | null>(null);
  const [comment, setComment] = useState('');
  const [showWatermark, setShowWatermark] = useState(true);

  useEffect(() => {
    if (token) {
      fetchGallery();
    }
  }, [token]);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      const { data: gallery, error: galleryError } = await supabase
        .from('galleries_triage')
        .select('*')
        .eq('gallery_token', token)
        .maybeSingle();

      if (galleryError) throw galleryError;

      if (!gallery) {
        setError('Galeria não encontrada');
        return;
      }

      // Check if gallery is expired
      if (new Date(gallery.link_expires_at) < new Date()) {
        setError('Esta galeria expirou');
        return;
      }

      // Check if password is required
      if (gallery.password && !passwordRequired) {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }

      const { data: photos, error: photosError } = await supabase
        .from('photos_triage')
        .select('*')
        .eq('gallery_id', gallery.id)
        .order('created_at', { ascending: true });

      if (photosError) throw photosError;

      setGalleryData({ gallery, photos: photos || [] });
      setSelectedPhotos(gallery.photos_selected || []);
    } catch (err) {
      console.error('Erro ao buscar galeria:', err);
      setError('Erro ao carregar galeria');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!galleryData?.gallery.password) return;
    
    if (password === galleryData.gallery.password) {
      setPasswordRequired(false);
      setPasswordError('');
      await fetchGallery();
    } else {
      setPasswordError('Senha incorreta');
    }
  };

  const handlePhotoSelect = (photoId: string) => {
    if (!galleryData?.gallery || galleryData.gallery.selection_completed) return;

    setSelectedPhotos(prev => {
      const newSelection = prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId];
      
      // Update selection in database
      updatePhotoSelection(galleryData.gallery.id, newSelection);
      return newSelection;
    });
  };

  const handleSubmitSelection = async () => {
    if (!galleryData?.gallery || selectedPhotos.length === 0) return;

    setSubmitting(true);
    try {
      const success = await submitSelection(galleryData.gallery.id, selectedPhotos);
      if (success) {
        // Refresh gallery data to show completion
        await fetchGallery();
        alert('Seleção enviada com sucesso! Você receberá suas fotos em breve.');
      } else {
        alert('Erro ao enviar seleção. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao submeter seleção:', error);
      alert('Erro ao enviar seleção. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const openLightbox = (photo: Photo) => {
    const index = galleryData?.photos.findIndex(p => p.id === photo.id) || 0;
    setLightboxPhoto(photo);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxPhoto(null);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!galleryData?.photos) return;
    
    const newIndex = direction === 'next' 
      ? (lightboxIndex + 1) % galleryData.photos.length
      : (lightboxIndex - 1 + galleryData.photos.length) % galleryData.photos.length;
    
    setLightboxIndex(newIndex);
    setLightboxPhoto(galleryData.photos[newIndex]);
  };

  const handleAddComment = (photo: Photo) => {
    setCommentingPhoto(photo);
    setComment(photo.metadata?.client_comment || '');
  };

  const saveComment = async () => {
    if (!commentingPhoto) return;

    try {
      const { error } = await supabase
        .from('photos_triage')
        .update({
          metadata: {
            ...commentingPhoto.metadata,
            client_comment: comment.trim()
          }
        })
        .eq('id', commentingPhoto.id);

      if (error) throw error;

      // Update local state
      setGalleryData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          photos: prev.photos.map(p => 
            p.id === commentingPhoto.id 
              ? { ...p, metadata: { ...p.metadata, client_comment: comment.trim() } }
              : p
          )
        };
      });

      setCommentingPhoto(null);
      setComment('');
    } catch (error) {
      console.error('Erro ao salvar comentário:', error);
      alert('Erro ao salvar comentário');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Galeria não encontrada</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Camera className="h-16 w-16 text-purple-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Galeria Protegida</h1>
            <p className="text-gray-600">Esta galeria requer senha para acesso</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Digite a senha"
                required
              />
              {passwordError && (
                <p className="text-red-600 text-sm mt-1">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Acessar Galeria
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!galleryData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Galeria não encontrada</p>
        </div>
      </div>
    );
  }

  const { gallery, photos } = galleryData;
  const minimumPhotos = gallery.appointment?.minimum_photos || 5;
  const extraPhotos = Math.max(0, selectedPhotos.length - minimumPhotos);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{gallery.name}</h1>
              <p className="text-gray-600 mt-1">
                Selecione suas fotos favoritas • {photos.length} fotos disponíveis
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowWatermark(!showWatermark)}
                className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showWatermark ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="text-sm">{showWatermark ? 'Ocultar' : 'Mostrar'} Marca</span>
              </button>
              
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  {selectedPhotos.length} de {photos.length} selecionadas
                </div>
                <div className="text-xs text-gray-500">
                  Mínimo: {minimumPhotos} fotos
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      {selectedPhotos.length > 0 && (
        <div className="bg-purple-50 border-b border-purple-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Heart className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-800">
                    {selectedPhotos.length} fotos selecionadas
                  </span>
                </div>
                
                {extraPhotos > 0 && (
                  <div className="text-sm text-purple-700">
                    (+{extraPhotos} fotos extras)
                  </div>
                )}
              </div>

              {!gallery.selection_completed && (
                <button
                  onClick={handleSubmitSelection}
                  disabled={submitting || selectedPhotos.length === 0}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{submitting ? 'Enviando...' : 'Confirmar Seleção'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photos Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Nenhuma foto disponível</h2>
            <p className="text-gray-500">As fotos ainda não foram enviadas para esta galeria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {photos.map((photo) => {
              const isSelected = selectedPhotos.includes(photo.id);
              const hasComment = photo.metadata?.client_comment;
              
              return (
                <div
                  key={photo.id}
                  className="relative group cursor-pointer"
                  onClick={() => openLightbox(photo)}
                >
                  <div className="aspect-square relative overflow-hidden rounded-lg border-2 transition-all duration-200 hover:shadow-lg">
                    {/* Photo */}
                    <img
                      src={photo.thumbnail || photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://via.placeholder.com/300x300/f0f0f0/666?text=${encodeURIComponent(photo.filename)}`;
                      }}
                    />

                    {/* Watermark */}
                    {showWatermark && gallery.watermark_settings?.enabled && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{ opacity: gallery.watermark_settings.opacity || 0.7 }}
                      >
                        <div className="text-white font-bold text-lg drop-shadow-lg">
                          {gallery.watermark_settings.text || 'Preview'}
                        </div>
                      </div>
                    )}

                    {/* Selection Overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-purple-600 bg-opacity-20 flex items-center justify-center">
                        <div className="bg-purple-600 rounded-full p-2">
                          <Check className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Photo Number */}
                    <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                      {photo.filename}
                    </div>

                    {/* Comment Indicator */}
                    {hasComment && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                        <MessageSquare className="h-3 w-3" />
                      </div>
                    )}

                    {/* Expand Icon */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="bg-white bg-opacity-90 rounded-full p-2">
                        <Expand className="h-5 w-5 text-gray-800" />
                      </div>
                    </div>
                  </div>

                  {/* Selection Button */}
                  {!gallery.selection_completed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePhotoSelect(photo.id);
                      }}
                      className={`absolute bottom-2 left-2 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'bg-white bg-opacity-90 text-gray-800 hover:bg-purple-100'
                      }`}
                    >
                      {isSelected ? 'Selecionada' : 'Selecionar'}
                    </button>
                  )}

                  {/* Comment Button */}
                  {!gallery.selection_completed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddComment(photo);
                      }}
                      className="absolute bottom-2 right-2 bg-gray-600 bg-opacity-80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-600"
                      title="Adicionar comentário"
                    >
                      <MessageSquare className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 bg-white bg-opacity-20 text-white rounded-full p-2 hover:bg-opacity-30 transition-colors z-10"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Navigation Buttons */}
            {galleryData.photos.length > 1 && (
              <>
                <button
                  onClick={() => navigateLightbox('prev')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 text-white rounded-full p-2 hover:bg-opacity-30 transition-colors z-10"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={() => navigateLightbox('next')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 text-white rounded-full p-2 hover:bg-opacity-30 transition-colors z-10"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Photo Container */}
            <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.filename}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://via.placeholder.com/800x600/f0f0f0/666?text=${encodeURIComponent(lightboxPhoto.filename)}`;
                }}
              />

              {/* Watermark in Lightbox */}
              {showWatermark && gallery.watermark_settings?.enabled && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ opacity: gallery.watermark_settings.opacity || 0.7 }}
                >
                  <div className="text-white font-bold text-4xl drop-shadow-lg">
                    {gallery.watermark_settings.text || 'Preview'}
                  </div>
                </div>
              )}
            </div>

            {/* Photo Info */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{lightboxPhoto.filename}</p>
                  <p className="text-sm opacity-75">
                    {lightboxIndex + 1} de {galleryData.photos.length}
                  </p>
                </div>
                
                {!gallery.selection_completed && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddComment(lightboxPhoto);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Comentar</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePhotoSelect(lightboxPhoto.id);
                      }}
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                        selectedPhotos.includes(lightboxPhoto.id)
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-800 hover:bg-purple-100'
                      }`}
                    >
                      <Heart className="h-4 w-4" />
                      <span>
                        {selectedPhotos.includes(lightboxPhoto.id) ? 'Selecionada' : 'Selecionar'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {commentingPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Adicionar Comentário</h3>
                <button
                  onClick={() => setCommentingPhoto(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4">
                <img
                  src={commentingPhoto.thumbnail || commentingPhoto.url}
                  alt={commentingPhoto.filename}
                  className="w-full h-32 object-cover rounded-lg"
                />
                <p className="text-sm text-gray-600 mt-2 text-center">{commentingPhoto.filename}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suas instruções para esta foto:
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ex: Clarear um pouco, remover objeto do fundo, etc."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setCommentingPhoto(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveComment}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selection Completed Message */}
      {gallery.selection_completed && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-green-800 mb-2">Seleção Confirmada!</h2>
            <p className="text-green-700">
              Sua seleção de {selectedPhotos.length} fotos foi enviada com sucesso. 
              Você receberá suas fotos editadas em breve!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}