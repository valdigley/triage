import React from 'react';
import { Check, MessageSquare, Expand } from 'lucide-react';
import { Photo } from '../../types';

interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;
  position: string;
  size: string;
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
  canComment = true
}: PhotoCardProps) {
  const getWatermarkClasses = () => {
    if (!watermarkSettings?.enabled) return '';
    
    const { position, size } = watermarkSettings;
    
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
        sizeClasses = 'text-sm';
        break;
      case 'large':
        sizeClasses = 'text-xl';
        break;
      case 'medium':
      default:
        sizeClasses = 'text-base';
        break;
    }
    
    return `${positionClasses} ${sizeClasses} text-white font-bold select-none`;
  };

  return (
    <div className={`relative group cursor-pointer ${className}`}>
      {/* Main Photo Container */}
      <div 
        className="relative w-full h-full overflow-hidden rounded-lg border-2 transition-all duration-200 hover:shadow-lg"
        style={{
          borderColor: isSelected ? '#7c3aed' : '#e5e7eb'
        }}
        onClick={() => {
          // No mobile, sempre seleciona se possível. No desktop, chama onViewFullSize
          if (window.innerWidth < 640) { // sm breakpoint
            if (canSelect) onToggleSelection();
          } else {
            onViewFullSize();
          }
        }}
      >
        {/* Photo */}
        <img
          src={photo.thumbnail || photo.url}
          alt={photo.filename}
          className="w-full h-full object-cover transition-transform duration-200 sm:group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/300x200/f0f0f0/666?text=${encodeURIComponent(photo.filename)}`;
          }}
        />

        {/* Watermark */}
        {watermarkSettings?.enabled && (
          <div
            className={`absolute ${getWatermarkClasses()} pointer-events-none z-10`}
            style={{ opacity: watermarkSettings.opacity }}
          >
            {watermarkSettings.text}
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
      </div>

      {/* Expand Button - Hover Overlay */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          // No mobile, seleciona. No desktop, abre lightbox
          if (window.innerWidth < 640) {
            if (canSelect) onToggleSelection();
          } else {
            onViewFullSize();
          }
        }}
        className="absolute inset-0 bg-black bg-opacity-0 sm:hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 sm:group-hover:opacity-100 rounded-lg"
      >
        <div className="hidden sm:block bg-white bg-opacity-90 rounded-full p-2">
          <Expand className="h-5 w-5 text-gray-800" />
        </div>
      </button>

      {/* Comment Button */}
      {canComment && onAddComment && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddComment();
          }}
          className="absolute bottom-2 right-2 bg-gray-600 bg-opacity-80 text-white rounded-full p-1.5 opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:bg-blue-600"
          title="Adicionar comentário"
        >
          <MessageSquare className="h-3 w-3" />
        </button>
      )}

      {/* Selection Status */}
      {canSelect && (
        <div className="absolute bottom-2 left-2 opacity-0 sm:group-hover:opacity-100 transition-all duration-200">
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            isSelected 
              ? 'bg-purple-600 text-white' 
              : 'bg-white bg-opacity-90 text-gray-800'
          }`}>
            {isSelected ? 'Selecionada' : 'Selecionar'}
          </div>
        </div>
      )}
    </div>
  );
}