import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Info, Download, Heart } from 'lucide-react';
import { Photo } from '../../types';

interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;
  position: string;
  size: string;
  watermark_image_url?: string;
}

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  watermarkSettings?: WatermarkSettings;
}

export function PhotoLightbox({ 
  photos, 
  currentIndex, 
  isOpen, 
  onClose, 
  onNavigate,
  watermarkSettings 
}: PhotoLightboxProps) {
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

  const renderWatermark = () => {
    if (!watermarkSettings?.enabled) return null;
    
    const { opacity } = watermarkSettings;
    
    // If there's a watermark image URL, use it; otherwise use text
    if (watermarkSettings.watermark_image_url) {
      return (
        <img
          src={watermarkSettings.watermark_image_url}
          alt="Watermark"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          style={{ opacity }}
        />
      );
    } else {
      // Fallback to text watermark
      const { position, size, text } = watermarkSettings;
      
      let positionClasses = '';
      switch (position) {
        case 'top-left':
          positionClasses = 'top-4 left-4';
          break;
        case 'top-right':
          positionClasses = 'top-4 right-4';
          break;
        case 'bottom-left':
          positionClasses = 'bottom-4 left-4';
          break;
        case 'bottom-right':
          positionClasses = 'bottom-4 right-4';
          break;
        case 'center':
        default:
          positionClasses = 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
          break;
      }
      
      let sizeClasses = '';
      switch (size) {
        case 'small':
          sizeClasses = 'text-lg sm:text-xl lg:text-2xl';
          break;
        case 'large':
          sizeClasses = 'text-3xl sm:text-4xl lg:text-5xl';
          break;
        case 'medium':
        default:
          sizeClasses = 'text-xl sm:text-2xl lg:text-3xl';
          break;
      }
      
      return (
        <div
          className={`absolute ${positionClasses} ${sizeClasses} text-white font-bold pointer-events-none z-10`}
          style={{ opacity }}
        >
          {text}
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex justify-between items-center">
          <div className="text-white text-sm">
            {currentIndex + 1} of {photos.length}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {currentIndex > 0 && (
        <button
          onClick={() => onNavigate(currentIndex - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-all duration-200"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {currentIndex < photos.length - 1 && (
        <button
          onClick={() => onNavigate(currentIndex + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center text-white transition-all duration-200"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Photo Container */}
      <div className="flex items-center justify-center h-full p-4 sm:p-8 lg:p-16">
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={currentPhoto.url}
            alt={currentPhoto.filename}
            className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
          />
          
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative max-w-[90vw] max-h-[90vh] w-auto h-auto">
              {renderWatermark()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}