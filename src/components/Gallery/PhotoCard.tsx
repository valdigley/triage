import React from 'react';
import { Check, MessageSquare, Expand, Heart, Printer, Star } from 'lucide-react';
import { Photo } from '../../types';

interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;
  position: string;
  size: string;
  watermark_image_url?: string;
}

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  isFavorite: boolean;
  isInPrintCart: boolean;
  canSelect: boolean;
  onToggleSelection: () => void;
  onToggleFavorite: () => void;
  onTogglePrintCart: () => void;
  onViewFullSize: () => void;
  hasComment?: boolean;
  watermarkSettings?: WatermarkSettings;
  className?: string;
  onAddComment?: () => void;
  canComment?: boolean;
  showCoverIndicator?: boolean;
  isCoverPhoto?: boolean;
}

export function PhotoCard({
  photo,
  isSelected,
  isFavorite,
  isInPrintCart,
  canSelect,
  onToggleSelection,
  onToggleFavorite,
  onTogglePrintCart,
  onViewFullSize,
  hasComment = false,
  watermarkSettings,
  className = '',
  onAddComment,
  canComment = true,
  showCoverIndicator = false,
  isCoverPhoto = false
}: PhotoCardProps) {
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
          positionClasses = 'top-2 left-2';
          break;
        case 'top-right':
          positionClasses = 'top-2 right-2';
          break;
        case 'bottom-left':
          positionClasses = 'bottom-2 left-2';
          break;
        case 'bottom-right':
          positionClasses = 'bottom-2 right-2';
          break;
        case 'center':
        default:
          positionClasses = 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
          break;
      }
      
      let sizeClasses = '';
      switch (size) {
        case 'small':
          sizeClasses = 'text-xs sm:text-sm';
          break;
        case 'large':
          sizeClasses = 'text-lg sm:text-xl';
          break;
        case 'medium':
        default:
          sizeClasses = 'text-sm sm:text-base';
          break;
      }
      
      return (
        <div
          className={`absolute ${positionClasses} text-white font-bold select-none pointer-events-none z-10 ${sizeClasses} drop-shadow-lg`}
          style={{ opacity }}
        >
          {text}
        </div>
      );
    }
  };

  return (
    <div className={`relative group cursor-pointer bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${className}`}>
      {/* Main Photo Container */}
      <div className="relative w-full overflow-hidden">
        {/* Photo */}
        <img
          src={photo.thumbnail || photo.url}
          alt={photo.filename}
          className="w-full h-auto transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/400x300/f0f0f0/666?text=${encodeURIComponent(photo.filename)}`;
          }}
        />

        {/* Watermark */}
        {renderWatermark()}

        {/* Cover Photo Indicator */}
        {showCoverIndicator && isCoverPhoto && (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <Star size={12} />
            Capa
          </div>
        )}

        {/* Selection Overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-purple-600 bg-opacity-30 flex items-center justify-center">
            <div className="bg-purple-600 rounded-full p-2">
              <Check className="h-5 w-5 text-white" />
            </div>
          </div>
        )}

        {/* Photo Filename */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded max-w-[calc(100%-1rem)] truncate">
          {photo.filename}
        </div>

        {/* Comment Indicator */}
        {hasComment && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
            <MessageSquare className="h-3 w-3" />
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300">
          <div className={`absolute top-2 right-2 flex gap-2 ${isCoverPhoto ? 'mt-8' : ''}`}>
            {/* Print Cart Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePrintCart();
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                isInPrintCart
                  ? 'bg-green-600 text-white'
                  : 'bg-white bg-opacity-80 text-gray-700 hover:bg-opacity-100'
              }`}
              title="Adicionar ao carrinho de impressão"
            >
              <Printer size={16} />
            </button>

            {/* Favorite Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                isFavorite
                  ? 'bg-red-500 text-white'
                  : 'bg-white bg-opacity-80 text-gray-700 hover:bg-opacity-100'
              }`}
            >
              <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewFullSize();
                }}
                className="w-8 h-8 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 flex items-center justify-center text-gray-700 transition-all duration-200"
              >
                <Expand size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Selection Button - Mobile */}
        {canSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection();
            }}
            className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium transition-all duration-200 ${
              isSelected 
                ? 'bg-purple-600 text-white' 
                : 'bg-white bg-opacity-90 text-gray-800 hover:bg-opacity-100'
            }`}
          >
            {isSelected ? 'Selecionada' : 'Selecionar'}
          </button>
        )}

        {/* Comment Button */}
        {canComment && onAddComment && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddComment();
            }}
            className="absolute bottom-2 right-2 bg-blue-600 bg-opacity-80 text-white rounded-full p-1.5 hover:bg-blue-700 transition-all duration-200"
            title="Adicionar comentário"
          >
            <MessageSquare className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Photo Info */}
      <div className="p-3">
        <p className="text-xs text-gray-500 truncate">{photo.filename}</p>
        {photo.metadata && (
          <p className="text-xs text-gray-400 mt-1">
            {(photo.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </div>
    </div>
  );
}