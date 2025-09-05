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
  return (
    <div className={`relative group cursor-pointer ${className}`}>
      {/* Main Photo Container */}
      <div 
        className="aspect-square relative overflow-hidden rounded-lg border-2 transition-all duration-200 hover:shadow-lg"
        style={{
          borderColor: isSelected ? '#7c3aed' : '#e5e7eb'
        }}
        onClick={onViewFullSize}
      >
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

        {/* Expand Button - Hover Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="bg-white bg-opacity-90 rounded-full p-2">
            <Expand className="h-5 w-5 text-gray-800" />
          </div>
        </div>
      </div>

      {/* Selection Button */}
      {canSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection();
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
      {canComment && onAddComment && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddComment();
          }}
          className="absolute bottom-2 right-2 bg-gray-600 bg-opacity-80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-600"
          title="Adicionar comentário"
        >
          <MessageSquare className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}