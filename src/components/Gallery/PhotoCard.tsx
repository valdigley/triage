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
  const renderWatermark = () => {
    if (!watermarkSettings?.enabled) return null;
    
    const { position, size, opacity } = watermarkSettings;
    
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
        sizeClasses = 'w-16 h-16 text-sm';
        break;
      case 'large':
        sizeClasses = 'w-32 h-32 text-xl';
        break;
      case 'medium':
      default:
        sizeClasses = 'w-24 h-24 text-base';
        break;
    }
    
    // If there's a watermark image URL, use it; otherwise use text
    if (watermarkSettings.watermark_image_url) {
      return (
        <img
          src={watermarkSettings.watermark_image_url}
          alt="Watermark"
          className={`absolute ${positionClasses} ${sizeClasses} object-contain pointer-events-none z-10 mix-blend-normal`}
          style={{ opacity }}
        />
      );
    } else {
      // Fallback to text watermark
      return (
        <div
          className={`absolute ${positionClasses} text-white font-bold select-none pointer-events-none z-10 ${size === 'small' ? 'text-sm' : size === 'large' ? 'text-xl' : 'text-base'}`}
          style={{ opacity }}
        >
          {watermarkSettings.text}
        </div>
      );
    }
  };


  return (
    <div className={`relative group cursor-pointer w-full ${className}`}>
      {/* Main Photo Container */}
      <div
        className="relative w-full overflow-hidden rounded-lg border-2 transition-all duration-200"
        style={{
          borderColor: isSelected ? '#7c3aed' : '#e5e7eb'
        }}
        onClick={() => {
          if (canSelect) onToggleSelection();
          else onViewFullSize();
        }}
      >
        {/* Photo */}
        <img
          src={photo.url}
          alt={photo.filename}
          className="w-full h-auto object-contain touch-manipulation"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/300x200/f0f0f0/666?text=${encodeURIComponent(photo.filename)}`;
          }}
        />

        {/* Watermark */}
        {renderWatermark()}

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


      {/* Comment Button */}
      {canComment && onAddComment && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddComment();
          }}
          className="absolute bottom-2 right-2 bg-gray-600 bg-opacity-80 text-white rounded-full p-2 transition-all duration-200 hover:bg-blue-600"
          title="Adicionar comentário"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}