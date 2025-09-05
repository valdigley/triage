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
  canSelect: boolean;
  onToggleSelection: () => void;
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
  canSelect,
  onToggleSelection,
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
          className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/400x600/f0f0f0/666?text=${encodeURIComponent(photo.filename)}`;
          }}
        />

        {/* Watermark */}
        {renderWatermark()}

        {/* Diagonal Preview Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div 
            className="text-white font-bold select-none transform rotate-45 opacity-40"
            style={{
              fontSize: 'clamp(0.75rem, 4vw, 2rem)',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
            }}
          >
            Preview
          </div>
        </div>

        {/* Diagonal Photo Name Preview */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div 
            className="text-white font-bold select-none transform rotate-45 opacity-40"
            style={{
              fontSize: 'clamp(0.75rem, 4vw, 2rem)',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
            }}
          >
            Preview
          </div>
        </div>

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
        {/* Expand Button - Top right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewFullSize();
          }}
          className="absolute top-2 right-2 bg-gray-800 bg-opacity-80 text-white rounded-full p-1.5 hover:bg-gray-900 transition-all duration-200"
          title="Ampliar foto"
        >
          <Expand className="h-3 w-3" />
        </button>

        {/* Selection Button - Bottom right, always visible */}
        {canSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection();
            }}
            className={`absolute bottom-2 right-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg ${
              isSelected 
                ? 'bg-purple-600 text-white border-2 border-purple-600' 
                : 'bg-white text-gray-800 hover:bg-gray-50 border-2 border-gray-300 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center space-x-1">
              {isSelected && <Check className="h-3 w-3" />}
              <span>{isSelected ? 'Selecionada' : 'Selecionar'}</span>
            </div>
          </button>
        )}
      </div>

      {/* Photo Info */}
      <div className="p-3 bg-white dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {photo.filename}
        </p>
        
        {/* Mobile Comment Button - Only show if comments enabled */}
        {canComment && onAddComment && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddComment();
            }}
            className="mt-2 w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center space-x-2"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{hasComment ? 'Editar Comentário' : 'Adicionar Comentário'}</span>
          </button>
        )}
      </div>
    </div>
  );
}