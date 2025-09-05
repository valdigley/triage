import React from 'react';
import { X, Download, Heart, Trash2 } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { Button } from '../UI/Button';
import { downloadMultipleFiles, formatFileSize } from '../../utils/fileUtils';

interface SelectionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SelectionPanel({ isOpen, onClose }: SelectionPanelProps) {
  const { state, dispatch } = useAppContext();
  const { currentGallery, clientSession } = state;

  if (!isOpen || !currentGallery || !clientSession) return null;

  const selectedPhotos = currentGallery.photos.filter(photo =>
    clientSession.selectedPhotos.includes(photo.id)
  );

  const totalSize = selectedPhotos.reduce((sum, photo) => sum + photo.size, 0);

  const handleDownloadSelected = async () => {
    const files = selectedPhotos.map(photo => ({
      url: photo.url,
      filename: photo.filename,
      r2Key: photo.r2Key,
    }));
    
    await downloadMultipleFiles(files, currentGallery.id);
    onClose();
  };

  const handleClearSelection = () => {
    selectedPhotos.forEach(photo => {
      dispatch({ type: 'TOGGLE_SELECTION', payload: { photoId: photo.id } });
    });
  };

  const handleRemoveFromSelection = (photoId: string) => {
    dispatch({ type: 'TOGGLE_SELECTION', payload: { photoId } });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Fotos Selecionadas ({selectedPhotos.length})
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Photos List */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedPhotos.length === 0 ? (
              <div className="text-center py-8">
                <Heart size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhuma foto selecionada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedPhotos.map((photo) => (
                  <div key={photo.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <img
                      src={photo.thumbnail}
                      alt={photo.filename}
                      className="w-12 h-12 object-cover rounded"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {photo.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(photo.size)}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handleRemoveFromSelection(photo.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedPhotos.length > 0 && (
            <div className="border-t border-gray-200 p-6 space-y-4">
              <div className="text-sm text-gray-600">
                <p>Total: {formatFileSize(totalSize)}</p>
              </div>
              
              <div className="space-y-2">
                <Button
                  onClick={handleDownloadSelected}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Baixar Selecionadas
                </Button>
                
                <Button
                  variant="secondary"
                  onClick={handleClearSelection}
                  className="w-full"
                >
                  Limpar Seleção
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}