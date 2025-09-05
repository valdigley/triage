import React, { useState, useMemo } from 'react';
import { Heart, Download, Grid, List, Filter, ShoppingCart, Clock, Printer } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { Button } from '../UI/Button';
import { PhotoGrid } from '../Client/PhotoGrid';
import { PhotoLightbox } from './PhotoLightbox';
import { SelectionPanel } from './SelectionPanel';
import { PrintCartPanel } from './PrintCartPanel';
import { Photo, ViewMode } from '../../types';
import { formatDate, isGalleryExpired } from '../../utils/fileUtils';

export function ClientGallery() {
  const { state } = useAppContext();
  const { currentGallery, clientSession } = state;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('masonry');
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [showSelection, setShowSelection] = useState(false);
  const [showPrintCart, setShowPrintCart] = useState(false);

  if (!currentGallery) {
    return <div>Galeria não encontrada</div>;
  }

  // Buscar a foto de capa corretamente
  const coverPhoto = currentGallery.coverPhotoId 
    ? currentGallery.photos.find(p => p.id === currentGallery.coverPhotoId) || currentGallery.photos[0]
    : currentGallery.photos[0];

  const filteredPhotos = useMemo(() => {
    if (filter === 'favorites' && clientSession) {
      return currentGallery.photos.filter(photo => 
        clientSession.favorites.includes(photo.id)
      );
    }
    return currentGallery.photos;
  }, [currentGallery.photos, filter, clientSession]);

  const handlePhotoClick = (photo: Photo, index: number) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  };

  const selectedCount = clientSession?.selectedPhotos.length || 0;
  const favoritesCount = clientSession?.favorites.length || 0;
  const printCartCount = clientSession?.printCart?.length || 0;

  // Calculate days until expiration
  const getDaysUntilExpiration = () => {
    if (!currentGallery.expirationDate) return null;
    
    const now = new Date();
    const expiration = new Date(currentGallery.expirationDate);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const daysUntilExpiration = getDaysUntilExpiration();
  const isExpired = isGalleryExpired(currentGallery.expirationDate);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section with Cover Photo */}
      {coverPhoto && (
        <div className="relative h-96 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${coverPhoto.url})` }}
          />
          <div className="absolute inset-0 bg-black bg-opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          
          <div className="relative h-full flex items-end">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
              <div className="text-white">
                <h1 className="text-4xl md:text-5xl font-bold mb-2">{currentGallery.name}</h1>
                <div className="flex items-center gap-4 text-lg opacity-90">
                  <span>{currentGallery.clientName}</span>
                  <span>•</span>
                  <span>{currentGallery.photos.length} fotos</span>
                  <span>•</span>
                  <span>{formatDate(currentGallery.createdDate)}</span>
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
                {currentGallery.description && (
                  <p className="text-lg opacity-90 mt-3 max-w-2xl">{currentGallery.description}</p>
                )}
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
                {/* Filters */}
                <Button
                  variant={filter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  Todas ({currentGallery.photos.length})
                </Button>
                
                <Button
                  variant={filter === 'favorites' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('favorites')}
                  className="flex items-center gap-1"
                >
                  <Heart size={16} />
                  Favoritas ({favoritesCount})
                </Button>
              </div>

              {/* Selection Cart */}
              <div className="flex items-center gap-3">
                {/* Print Cart */}
                {printCartCount > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowPrintCart(true)}
                    className="flex items-center gap-2"
                  >
                    <Printer size={16} />
                    {printCartCount} para imprimir
                  </Button>
                )}
                
                {selectedCount > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowSelection(true)}
                    className="flex items-center gap-2"
                  >
                    <ShoppingCart size={16} />
                    {selectedCount} selecionadas
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredPhotos.length === 0 ? (
          <div className="text-center py-12">
            <Heart size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {filter === 'favorites' ? 'Nenhuma foto favorita ainda' : 'Nenhuma foto encontrada'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filter === 'favorites' 
                ? 'Marque algumas fotos como favoritas para vê-las aqui.'
                : 'Esta galeria ainda não possui fotos.'}
            </p>
          </div>
        ) : (
          <PhotoGrid
            photos={filteredPhotos}
            onPhotoClick={handlePhotoClick}
          />
        )}
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        photos={filteredPhotos}
        currentIndex={currentPhotoIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setCurrentPhotoIndex}
      />

      {/* Selection Panel */}
      <SelectionPanel
        isOpen={showSelection}
        onClose={() => setShowSelection(false)}
      />
      
      {/* Print Cart Panel */}
      <PrintCartPanel
        isOpen={showPrintCart}
        onClose={() => setShowPrintCart(false)}
      />
    </div>
  );
}