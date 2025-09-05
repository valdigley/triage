import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Download, Info } from 'lucide-react';
import { Photo } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { Button } from '../UI/Button';
import { downloadFile, formatFileSize } from '../../utils/fileUtils';

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function PhotoLightbox({ photos, currentIndex, isOpen, onClose, onNavigate }: PhotoLightboxProps) {
  const { state, dispatch } = useAppContext();
  const { clientSession } = state;
  const [showInfo, setShowInfo] = useState(false);
  
  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) {
            onNavigate(currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (currentIndex < photos.length - 1) {
            onNavigate(currentIndex + 1);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !currentPhoto) return null;

  const isFavorite = clientSession?.favorites.includes(currentPhoto.id) || false;

  const handleFavoriteToggle = () => {
    dispatch({ type: 'TOGGLE_FAVORITE', payload: { photoId: currentPhoto.id } });
  };

  const handleDownload = () => {
    downloadFile(currentPhoto.url, currentPhoto.filename, currentPhoto.r2Key, state.currentGallery?.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black to-transparent p-4">
        <div className="flex justify-between items-center">
          <div className="text-white">
            <p className="text-sm opacity-80">
              {currentIndex + 1} de {photos.length}
            </p>
            <p className="font-medium">{currentPhoto.filename}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfo(!showInfo)}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <Info size={20} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFavoriteToggle}
              className={`text-white hover:bg-white hover:bg-opacity-20 ${
                isFavorite ? 'text-red-400' : ''
              }`}
            >
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <Download size={20} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20"
            >
              <X size={20} />
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {currentIndex > 0 && (
        <button
          onClick={() => onNavigate(currentIndex - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-all duration-200"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {currentIndex < photos.length - 1 && (
        <button
          onClick={() => onNavigate(currentIndex + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-all duration-200"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Photo */}
      <div className="flex items-center justify-center h-full p-16">
        <img
          src={currentPhoto.url}
          alt={currentPhoto.filename}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 text-white">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="opacity-80">Arquivo:</p>
                <p className="font-medium">{currentPhoto.filename}</p>
              </div>
              <div>
                <p className="opacity-80">Tamanho:</p>
                <p className="font-medium">{formatFileSize(currentPhoto.size)}</p>
              </div>
              {currentPhoto.metadata && (
                <>
                  <div>
                    <p className="opacity-80">Dimensões:</p>
                    <p className="font-medium">
                      {currentPhoto.metadata.width} × {currentPhoto.metadata.height}
                    </p>
                  </div>
                  {currentPhoto.metadata.camera && (
                    <div>
                      <p className="opacity-80">Câmera:</p>
                      <p className="font-medium">{currentPhoto.metadata.camera}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}