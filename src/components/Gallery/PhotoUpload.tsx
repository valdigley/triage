import React, { useState, useCallback } from 'react';
import { Upload, X, Image, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { useNotifications } from '../../hooks/useNotifications';
import { useTenant } from '../../hooks/useTenant';
import { useToast } from '../../contexts/ToastContext';

// Função para redimensionar imagem mantendo proporção
const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number = 0.8): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new window.Image();

    img.onload = () => {
      // Calcular dimensões mantendo proporção baseado na aresta mais longa
      let { width, height } = img;

      // Se largura é maior (paisagem) ou igual
      if (width >= height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        // Se altura é maior (retrato)
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

// Função para redimensionar imagem com base na aresta mais longa
const resizeImageMaxSide = (file: File, maxLongSide: number, quality: number = 0.85): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new window.Image();

    img.onload = () => {
      let { width, height } = img;

      // Encontrar qual é a aresta mais longa
      const longestSide = Math.max(width, height);

      // Se a aresta mais longa for maior que o máximo, redimensionar
      if (longestSide > maxLongSide) {
        const scale = maxLongSide / longestSide;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;

      // Desenhar imagem redimensionada com boa qualidade
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
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
  const { sendGalleryLink, instances } = useWhatsApp();
  const { scheduleGalleryNotifications } = useNotifications();
  const toast = useToast();

  // Debug: Log quando instâncias mudarem
  React.useEffect(() => {
    console.log('📱 PhotoUpload: Instâncias WhatsApp atualizadas:', instances.length);
  }, [instances]);

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
        .from('triagem_photos')
        .delete()
        .eq('id', photoId);
      
      if (dbError) throw dbError;
      
      // Update gallery photo count
      const { data: photos } = await supabase
        .from('triagem_photos')
        .select('id')
        .eq('gallery_id', galleryId);

      await supabase
        .from('triagem_galleries')
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
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`; // Always save as jpg
          const filePath = `galleries/${galleryId}/${fileName}`;

          // Redimensionar foto principal para 1920px na aresta mais longa
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, progress: 20 }
              : f
          ));

          const resizedMainBlob = await resizeImageMaxSide(uploadFile.file, 1920, 0.85);

          // Upload foto redimensionada (1920px)
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, progress: 40 }
              : f
          ));

          const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(filePath, resizedMainBlob);

          if (uploadError) throw uploadError;

          // Criar thumbnail
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, progress: 70 }
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
          
          const { data: { user } } = await supabase.auth.getUser();
          const { data: tenantUser } = await supabase
            .from('triagem_tenant_users')
            .select('tenant_id')
            .eq('user_id', user?.id)
            .single();

          const { error } = await supabase
            .from('triagem_photos')
            .insert({
              tenant_id: tenantUser?.tenant_id,
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

      // Update gallery photo count and set preview image
      const { data: photos } = await supabase
        .from('triagem_photos')
        .select('id, url, thumbnail')
        .eq('gallery_id', galleryId)
        .order('created_at', { ascending: true });

      // Get current gallery to check if preview already set
      const { data: currentGallery } = await supabase
        .from('triagem_galleries')
        .select('preview_image_url')
        .eq('id', galleryId)
        .maybeSingle();

      const updateData: any = {
        photos_uploaded: photos?.length || 0,
        updated_at: new Date().toISOString()
      };

      // Set first photo as preview if not already set
      if (!currentGallery?.preview_image_url && photos && photos.length > 0) {
        updateData.preview_image_url = photos[0].url;
        console.log('📸 Definindo primeira foto como preview:', photos[0].url);
      }

      await supabase
        .from('triagem_galleries')
        .update(updateData)
        .eq('id', galleryId);

      // Check if we should send WhatsApp message automatically
      const totalPhotos = photos?.length || 0;
      const minimumPhotos = gallery?.appointment?.minimum_photos || 5;

      if (totalPhotos >= minimumPhotos && gallery?.appointment?.client) {
        try {
          console.log(`📸 Galeria atingiu o mínimo: ${totalPhotos} fotos >= ${minimumPhotos} mínimas`);

          // Verificar se já foi enviada notificação de galeria pronta
          const { data: existingNotifications } = await supabase
            .from('triagem_scheduled_notifications')
            .select('id, status')
            .eq('appointment_id', gallery.appointment.id)
            .eq('type', 'gallery_ready')
            .in('status', ['sent', 'pending']);

          if (existingNotifications && existingNotifications.length > 0) {
            console.log('✅ Notificação de galeria já foi enviada anteriormente');
          } else {
            const client = gallery.appointment.client;
            const clientName = client.name;
            const clientPhone = client.phone;
            const expirationDate = gallery.link_expires_at;

            // Enviar mensagem imediatamente via WhatsApp
            console.log(`📤 Enviando mensagem WhatsApp para ${clientName}...`);
            const sent = await sendGalleryLink(clientName, clientPhone, gallery.gallery_token, expirationDate);

            if (sent) {
              console.log('✅ Mensagem WhatsApp enviada com sucesso!');
              toast.success(`Notificação enviada para ${clientName}!`);
            } else {
              console.warn('⚠️ Falha ao enviar mensagem WhatsApp - verifique se há instância ativa');
              toast.warning('WhatsApp não configurado. Configure nas Configurações.');
            }

            // Também agendar notificações futuras (lembretes)
            const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
            const galleryLink = `${appUrl}/gallery/${gallery.gallery_token}`;
            await scheduleGalleryNotifications(gallery.appointment.id, galleryLink);

            console.log('📅 Notificações futuras agendadas');
          }
        } catch (error) {
          console.error('❌ Erro ao notificar cliente:', error);
        }
      }
      if (completedUploads > 0) {
        onUploadComplete();
      }

    } finally {
      setIsUploading(false);
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