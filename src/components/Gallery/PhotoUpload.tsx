import React, { useState, useCallback } from 'react';
import { Upload, X, Image, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWhatsApp } from '../../hooks/useWhatsApp';

// Função para redimensionar imagem
const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.8): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new window.Image();
    
    img.onload = () => {
      // Calcular dimensões mantendo proporção
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Desenhar imagem redimensionada
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    
    img.src = URL.createObjectURL(file);
  });
};

interface PhotoUploadProps {
  galleryId: string;
  onUploadComplete: () => void;
  onUploadProgress?: (progress: number) => void;
  gallery?: any; // Gallery data with appointment info
  gallery?: any; // Gallery data with appointment info
}

interface UploadFile {
  file: File;
  id: string;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export function PhotoUpload({ galleryId, onUploadComplete, onUploadProgress, gallery }: PhotoUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotos, setDeletingPhotos] = useState<Set<string>>(new Set());
  const { sendGalleryLink } = useWhatsApp();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB max
      return isValidType && isValidSize;
    });

    const uploadFiles: UploadFile[] = validFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      preview: URL.createObjectURL(file),
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...uploadFiles]);
  };

  const deletePhoto = async (photoId: string, storagePath: string, thumbnailPath: string) => {
    setDeletingPhotos(prev => new Set(prev).add(photoId));
    
    try {
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('photos')
        .remove([storagePath]);
      
      if (deleteError) throw deleteError;
      
      // Delete thumbnail from storage
      const { error: thumbDeleteError } = await supabase.storage
        .from('photos')
        .remove([thumbnailPath]);
      
      if (thumbDeleteError) console.warn('Erro ao deletar thumbnail:', thumbDeleteError);
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('photos_triage')
        .delete()
        .eq('id', photoId);
      
      if (dbError) throw dbError;
      
      // Update gallery photo count
      const { data: photos } = await supabase
        .from('photos_triage')
        .select('id')
        .eq('gallery_id', galleryId);

      await supabase
        .from('galleries_triage')
        .update({ 
          photos_uploaded: photos?.length || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', galleryId);
      
      onUploadComplete();
      
    } catch (error) {
      console.error('Erro ao deletar foto:', error);
      alert('Erro ao deletar foto. Tente novamente.');
    } finally {
      setDeletingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoId);
        return newSet;
      });
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    let completedUploads = 0;

    try {
      for (const uploadFile of files) {
        if (uploadFile.status !== 'pending') continue;

        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'uploading', progress: 0 }
            : f
        ));

        try {
          // Upload para Supabase Storage
          const fileExt = uploadFile.file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `galleries/${galleryId}/${fileName}`;
          
          // Upload arquivo original
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, progress: 30 }
              : f
          ));
          
          const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(filePath, uploadFile.file);
          
          if (uploadError) throw uploadError;
          
          // Criar thumbnail
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, progress: 60 }
              : f
          ));
          
          const thumbnailBlob = await resizeImage(uploadFile.file, 400, 300, 0.7);
          const thumbnailPath = `galleries/${galleryId}/thumbs/${fileName}`;
          
          const { error: thumbError } = await supabase.storage
            .from('photos')
            .upload(thumbnailPath, thumbnailBlob);
          
          if (thumbError) throw thumbError;
          
          // Obter URLs públicas
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, progress: 80 }
              : f
          ));
          
          const { data: urlData } = supabase.storage
            .from('photos')
            .getPublicUrl(filePath);
          
          const { data: thumbUrlData } = supabase.storage
            .from('photos')
            .getPublicUrl(thumbnailPath);
          
          // Create photo record
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, progress: 90 }
              : f
          ));
          
          const { error } = await supabase
            .from('photos_triage')
            .insert({
              gallery_id: galleryId,
              filename: uploadFile.file.name,
              url: urlData.publicUrl,
              thumbnail: thumbUrlData.publicUrl,
              size: uploadFile.file.size,
              metadata: {
                storage_path: filePath,
                thumbnail_path: thumbnailPath,
                size: uploadFile.file.size,
                type: uploadFile.file.type,
                lastModified: uploadFile.file.lastModified
              }
            });

          if (error) throw error;

          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'success', progress: 100 }
              : f
          ));

          completedUploads++;
          
        } catch (error) {
          console.error('Erro no upload:', error);
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'error', error: 'Falha no upload' }
              : f
          ));
        }
      }

      // Update gallery photo count
      const { data: photos } = await supabase
        .from('photos_triage')
        .select('id')
        .eq('gallery_id', galleryId);

      await supabase
        .from('galleries_triage')
        .update({ 
          photos_uploaded: photos?.length || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', galleryId);

      // Check if we should send WhatsApp message automatically
      const totalPhotos = photos?.length || 0;
      const minimumPhotos = gallery?.appointment?.minimum_photos || 5;
      
      if (totalPhotos >= minimumPhotos && gallery?.appointment?.client) {
        try {
          console.log(`Agendando notificação da galeria: ${totalPhotos} fotos >= ${minimumPhotos} mínimas`);
          
          // Schedule gallery ready notification
          await scheduleGalleryNotification(gallery);
          
          console.log('Notificação da galeria agendada automaticamente');
        } catch (error) {
          console.error('Erro ao agendar notificação da galeria:', error);
        }
      }
      if (completedUploads > 0) {
        onUploadComplete();
      }

    } finally {
      setIsUploading(false);
    }
  };

  const scheduleGalleryNotification = async (gallery: any) => {
    try {
      // Get settings
      const { data: settings } = await supabase
        .from('settings')
        .select('delivery_days, studio_address, studio_maps_url, price_commercial_hour')
        .single();

      if (!settings) {
        throw new Error('Settings not found');
      }

      // Get session type details
      const { data: sessionType } = await supabase
        .from('session_types')
        .select('*')
        .eq('name', gallery.appointment.session_type)
        .single();

      const clientName = gallery.appointment.client?.name || 'Cliente';
      const clientPhone = gallery.appointment.client?.phone || '';
      const galleryLink = `${window.location.origin}/gallery/${gallery.gallery_token}`;

      // Format currency
      const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(amount);
      };

      const appointmentDate = new Date(gallery.appointment.scheduled_date);

      const variables = {
        client_name: clientName,
        gallery_link: galleryLink,
        delivery_days: (settings.delivery_days || 7).toString(),
        amount: formatCurrency(gallery.appointment.total_amount),
        session_type: sessionType?.label || gallery.appointment.session_type,
        appointment_date: appointmentDate.toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        appointment_time: appointmentDate.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        studio_address: settings.studio_address || '',
        studio_maps_url: settings.studio_maps_url || '',
        price_per_photo: formatCurrency(settings.price_commercial_hour || 30),
        minimum_photos: (gallery.appointment.minimum_photos || 5).toString()
      };

      // Get gallery ready template
      const { data: template } = await supabase
        .from('notification_templates')
        .select('message_template')
        .eq('type', 'gallery_ready')
        .eq('is_active', true)
        .single();

      if (template) {
        // Process template with variables
        let message = template.message_template;
        Object.entries(variables).forEach(([key, value]) => {
          message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        // Schedule gallery ready notification (immediate)
        await supabase
          .from('notification_queue')
          .insert({
            appointment_id: gallery.appointment.id,
            template_type: 'gallery_ready',
            recipient_phone: clientPhone,
            recipient_name: clientName,
            message,
            scheduled_for: new Date().toISOString()
          });

        // Schedule selection reminder (6 days after gallery creation)
        const selectionReminder = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
        const reminderTemplate = await supabase
          .from('notification_templates')
          .select('message_template')
          .eq('type', 'selection_reminder')
          .eq('is_active', true)
          .single();

        if (reminderTemplate.data) {
          let reminderMessage = reminderTemplate.data.message_template;
          Object.entries(variables).forEach(([key, value]) => {
            reminderMessage = reminderMessage.replace(new RegExp(`{{${key}}}`, 'g'), value);
          });

          await supabase
            .from('notification_queue')
            .insert({
              appointment_id: gallery.appointment.id,
              template_type: 'selection_reminder',
              recipient_phone: clientPhone,
              recipient_name: clientName,
              message: reminderMessage,
              scheduled_for: selectionReminder.toISOString()
            });
        }
      }

      return true;
    } catch (error) {
      console.error('Error scheduling gallery notifications:', error);
      return false;
    }
  };

  const clearCompleted = () => {
    setFiles(prev => {
      const toRemove = prev.filter(f => f.status === 'success' || f.status === 'error');
      toRemove.forEach(f => URL.revokeObjectURL(f.preview));
      return prev.filter(f => f.status === 'pending' || f.status === 'uploading');
    });
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'uploading':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />;
      default:
        return <Image className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-purple-400 bg-purple-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          id="photo-upload"
          disabled={isUploading}
        />
        
        <label htmlFor="photo-upload" className="cursor-pointer">
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-600 mb-2">
            Arraste as fotos aqui ou clique para selecionar
          </p>
          <p className="text-sm text-gray-500">
            Suporte para JPG, PNG, WEBP • Máximo 10MB por foto
          </p>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-800">
              Fotos para Upload ({files.length})
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={clearCompleted}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Limpar Concluídos
              </button>
              <button
                onClick={uploadFiles}
                disabled={isUploading || files.every(f => f.status !== 'pending')}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? 'Enviando...' : 'Enviar Fotos'}
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {files.map((uploadFile) => (
              <div key={uploadFile.id} className="flex items-center space-x-4 p-3 border border-gray-200 rounded-lg">
                <img
                  src={uploadFile.preview}
                  alt={uploadFile.file.name}
                  className="w-12 h-12 object-cover rounded"
                />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {uploadFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {uploadFile.error && (
                    <p className="text-xs text-red-500 mt-1">{uploadFile.error}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {getStatusIcon(uploadFile.status)}
                  
                  {uploadFile.status === 'pending' && (
                    <button
                      onClick={() => removeFile(uploadFile.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}