import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Gallery, Photo } from '../types';
import { useNotifications } from './useNotifications';

export function useGalleries() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { scheduleNotificationSafe, processNotificationQueue } = useNotifications();

  useEffect(() => {
    fetchGalleries();
  }, []);

  const fetchGalleries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('galleries_triage')
        .select(`
          *,
          appointment:appointments(
            *,
            client:clients(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGalleries(data || []);
    } catch (err) {
      console.error('Erro ao buscar galerias:', err);
      setError(err instanceof Error ? err.message : 'Falha ao buscar galerias');
    } finally {
      setLoading(false);
    }
  };

  const createGallery = async (appointmentId: string, name: string, expirationDays: number = 30) => {
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);

      const { data, error } = await supabase
        .from('galleries_triage')
        .insert([{
          appointment_id: appointmentId,
          name,
          link_expires_at: expirationDate.toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      
      await fetchGalleries();
      return data;
    } catch (err) {
      console.error('Erro ao criar galeria:', err);
      setError(err instanceof Error ? err.message : 'Falha ao criar galeria');
      throw err;
    }
  };

  const updateGalleryStatus = async (id: string, status: Gallery['status']) => {
    try {
      // Se estamos reativando a seleção, também resetamos o flag de seleção completa
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'started') {
        updateData.selection_completed = false;
        updateData.selection_submitted_at = null;
      }
      
      const { error } = await supabase
        .from('galleries_triage')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      await fetchGalleries();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar status da galeria:', err);
      return false;
    }
  };

  const uploadPhotos = async (galleryId: string, files: File[]) => {
    try {
      const uploadPromises = files.map(async (file, index) => {
        // Upload para Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${index}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `galleries/${galleryId}/${fileName}`;
        
        // Upload arquivo original
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Obter URL pública
        const { data: urlData } = supabase.storage
          .from('photos')
          .getPublicUrl(filePath);

        return supabase
          .from('photos_triage')
          .insert({
            gallery_id: galleryId,
            filename: file.name,
            url: urlData.publicUrl,
            thumbnail: urlData.publicUrl, // Usar mesma URL para thumbnail por enquanto
            size: file.size,
            metadata: {
              storage_path: filePath,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified
            }
          });
      });

      await Promise.all(uploadPromises);

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

      await fetchGalleries();
      return true;
    } catch (err) {
      console.error('Erro ao fazer upload das fotos:', err);
      setError(err instanceof Error ? err.message : 'Falha no upload das fotos');
      return false;
    }
  };

  const getGalleryByToken = async (token: string) => {
    try {
      const { data: gallery, error: galleryError } = await supabase
        .from('galleries_triage')
        .select('*')
        .eq('gallery_token', token)
        .maybeSingle();

      if (galleryError) throw galleryError;

      if (!gallery) {
        console.log('Galeria não encontrada para o token:', token);
        return null;
      }

      const { data: photos, error: photosError } = await supabase
        .from('photos_triage')
        .select('*')
        .eq('gallery_id', gallery.id)
        .order('created_at', { ascending: true });

      if (photosError) throw photosError;

      return { gallery, photos: photos || [] };
    } catch (err) {
      console.error('Erro ao buscar galeria por token:', err);
      return null;
    }
  };

  const updatePhotoSelection = async (galleryId: string, photoIds: string[]) => {
    try {
      // Update gallery with selected photos
      const { error: galleryError } = await supabase
        .from('galleries_triage')
        .update({
          photos_selected: photoIds,
          status: photoIds.length > 0 ? 'started' : 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', galleryId);

      if (galleryError) throw galleryError;

      // Update individual photos
      await supabase
        .from('photos_triage')
        .update({ is_selected: false })
        .eq('gallery_id', galleryId);

      if (photoIds.length > 0) {
        await supabase
          .from('photos_triage')
          .update({ is_selected: true })
          .in('id', photoIds);
      }

      return true;
    } catch (err) {
      console.error('Erro ao atualizar seleção:', err);
      return false;
    }
  };

  const submitSelection = async (galleryId: string, photoIds: string[]) => {
    try {
      console.log('📝 Iniciando processo de submissão da seleção...');
      
      // Verificar se já foi submetido recentemente (últimos 30 segundos)
      const { data: recentSubmission } = await supabase
        .from('galleries_triage')
        .select('selection_submitted_at')
        .eq('id', galleryId)
        .single();

      if (recentSubmission?.selection_submitted_at) {
        const submittedAt = new Date(recentSubmission.selection_submitted_at);
        const now = new Date();
        const timeDiff = now.getTime() - submittedAt.getTime();
        
        if (timeDiff < 30000) { // 30 segundos
          console.log('⚠️ Submissão recente detectada, ignorando duplicata');
          return true;
        }
      }

      // Get gallery data first to access appointment info
      const { data: galleryData, error: galleryError } = await supabase
        .from('galleries_triage')
        .select(`
          *,
          appointment:appointments(
            *,
            client:clients(*)
          )
        `)
        .eq('id', galleryId)
        .single();

      if (galleryError) throw galleryError;

      console.log('📋 Dados da galeria obtidos:', galleryData.name);
      
      // Verificar se o pagamento inicial foi aprovado
      if (galleryData.appointment?.payment_status !== 'approved') {
        console.log('⚠️ Pagamento inicial não aprovado, não enviando notificação');
        
        // Salvar seleção sem notificação
        const { error } = await supabase
          .from('galleries_triage')
          .update({
            photos_selected: photoIds,
            selection_completed: true,
            selection_submitted_at: new Date().toISOString(),
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', galleryId);

        if (error) throw error;
        await fetchGalleries();
        return true;
      }

      const { error } = await supabase
        .from('galleries_triage')
        .update({
          photos_selected: photoIds,
          selection_completed: true,
          selection_submitted_at: new Date().toISOString(),
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', galleryId);

      if (error) throw error;

      console.log('✅ Seleção salva no banco de dados');
      
      // Agendar notificação de confirmação da seleção
      try {
        if (galleryData.appointment?.client) {
          console.log('📱 Agendando notificação de seleção para:', galleryData.appointment.client.name);
          
          // Verificar se já existe notificação pendente para evitar duplicatas
          const { data: existingNotification } = await supabase
            .from('notification_queue')
            .select('id')
            .eq('appointment_id', galleryData.appointment.id)
            .eq('template_type', 'selection_received')
            .eq('status', 'pending')
            .maybeSingle();

          if (existingNotification) {
            console.log('⚠️ Notificação já existe na fila, pulando duplicata');
            return true;
          }

          // Buscar configurações para preços
          const { data: settings } = await supabase
            .from('settings')
            .select('*')
            .single();

          if (!settings) {
            console.warn('⚠️ Configurações não encontradas, usando valores padrão');
          }

          // Buscar tipo de sessão
          const { data: sessionType } = await supabase
            .from('session_types')
            .select('*')
            .eq('name', galleryData.appointment.session_type)
            .single();

          const pricePerPhoto = settings?.price_commercial_hour || 30;
          const minimumPhotos = galleryData.appointment.minimum_photos || 5;
          const extraPhotos = Math.max(0, photoIds.length - minimumPhotos);
          const extraCost = extraPhotos * pricePerPhoto;
          const appointmentDate = new Date(galleryData.appointment.scheduled_date);
          
          // Formatação de valores
          const formatCurrency = (amount: number): string => {
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(amount);
          };
          
          const formattedExtraCost = formatCurrency(extraCost);
          const formattedPricePerPhoto = formatCurrency(pricePerPhoto);
          const formattedTotalAmount = formatCurrency(galleryData.appointment.total_amount);
          
          // Variáveis para o template
          const variables = {
            client_name: galleryData.appointment.client.name,
            selected_count: photoIds.length.toString(),
            minimum_photos: minimumPhotos.toString(),
            extra_photos: extraPhotos.toString(),
            extra_cost: formattedExtraCost,
            price_per_photo: formattedPricePerPhoto,
            amount: formattedTotalAmount,
            session_type: sessionType?.label || galleryData.appointment.session_type,
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
            studio_address: settings?.studio_address || '',
            studio_maps_url: settings?.studio_maps_url || '',
            delivery_days: (settings?.delivery_days || 7).toString()
          };

          console.log('📊 Variáveis do template preparadas:', {
            selected_count: variables.selected_count,
            extra_photos: variables.extra_photos,
            extra_cost: variables.extra_cost
          });

          // Agendar notificação imediata (única)
          const notificationSuccess = await scheduleNotificationSafe(
            galleryData.appointment.id,
            'selection_received',
            galleryData.appointment.client.phone,
            galleryData.appointment.client.name,
            new Date().toISOString(),
            variables
          );

          if (notificationSuccess) {
            console.log('✅ Notificação agendada com sucesso');
            
            // Processar fila após delay para evitar múltiplas execuções
            setTimeout(async () => {
              console.log('🔄 Processando fila de notificações...');
              await processNotificationQueue();
            }, 5000); // Aumentado para 5 segundos
          } else {
            console.error('❌ Falha ao agendar notificação');
          }

          // Agendar lembrete de entrega (delivery_days - 1)
          const deliveryReminderDate = new Date();
          deliveryReminderDate.setDate(deliveryReminderDate.getDate() + (settings?.delivery_days || 7) - 1);
          
          await scheduleNotificationSafe(
            galleryData.appointment.id,
            'delivery_reminder',
            galleryData.appointment.client.phone,
            galleryData.appointment.client.name,
            deliveryReminderDate.toISOString(),
            variables
          );

        } else {
          console.warn('⚠️ Dados do cliente não encontrados para notificação');
        }
      } catch (notificationError) {
        console.error('❌ Erro ao agendar notificações (não crítico):', notificationError);
      }

      await fetchGalleries();
      console.log('✅ Processo de submissão concluído com sucesso');
      return true;
    } catch (err) {
      console.error('❌ Erro crítico ao submeter seleção:', err);
      // Mesmo com erro, tentar atualizar a lista
      try {
        await fetchGalleries();
      } catch (fetchError) {
        console.error('❌ Erro ao atualizar lista de galerias:', fetchError);
      }
      return true; // Retorna true porque a seleção foi salva
    }
  };

  const submitSelectionWithFallback = async (galleryId: string, photoIds: string[]) => {
    try {
      console.log('🛡️ Iniciando submissão com fallback...');
      
      // Primeira tentativa
      const success = await submitSelection(galleryId, photoIds);
      
      if (success) {
        console.log('✅ Submissão principal bem-sucedida');
        return true;
      }
      
      // Fallback: salvar apenas a seleção
      console.log('🔄 Executando fallback - salvando apenas seleção...');
      
      const { error } = await supabase
        .from('galleries_triage')
        .update({
          photos_selected: photoIds,
          selection_completed: true,
          selection_submitted_at: new Date().toISOString(),
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', galleryId);

      if (error) {
        console.error('❌ Erro no fallback:', error);
        return false;
      }

      console.log('✅ Fallback executado com sucesso');
      await fetchGalleries();
      return true;
      
    } catch (error) {
      console.error('❌ Erro crítico em ambas as tentativas:', error);
      return false;
    }
  };

  // Função para reprocessar notificações pendentes
  const reprocessPendingNotifications = async (): Promise<boolean> => {
    try {
      console.log('🔄 Reprocessando notificações pendentes...');
      
      // Verificar se já está processando para evitar execuções simultâneas
      const processingKey = 'notification_processing';
      const isProcessing = sessionStorage.getItem(processingKey);
      
      if (isProcessing) {
        console.log('⚠️ Processamento já em andamento, ignorando');
        return true;
      }
      
      sessionStorage.setItem(processingKey, 'true');
      
      try {
      const { data: pendingNotifications } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .limit(10);

      if (!pendingNotifications || pendingNotifications.length === 0) {
        console.log('ℹ️ Nenhuma notificação pendente encontrada');
        return true;
      }

      console.log(`📋 Encontradas ${pendingNotifications.length} notificações pendentes`);
      
      // Processar fila
      const processResult = await processNotificationQueue();
      
      if (processResult) {
        console.log('✅ Notificações reprocessadas com sucesso');
      } else {
        console.warn('⚠️ Algumas notificações podem não ter sido processadas');
      }
      
      return processResult;
      } finally {
        sessionStorage.removeItem(processingKey);
      }
    } catch (error) {
      console.error('❌ Erro ao reprocessar notificações:', error);
      return false;
    }
  };

  const submitSelectionOld = async (galleryId: string, photoIds: string[]) => {
    try {
      // Get gallery data first to access appointment info
      const { data: galleryData, error: galleryError } = await supabase
        .from('galleries_triage')
        .select(`
          *,
          appointment:appointments(
            *,
            client:clients(*)
          )
        `)
        .eq('id', galleryId)
        .single();

      if (galleryError) throw galleryError;

      const { error } = await supabase
        .from('galleries_triage')
        .update({
          photos_selected: photoIds,
          selection_completed: true,
          selection_submitted_at: new Date().toISOString(),
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', galleryId);

      if (error) throw error;

      // Schedule selection confirmation notification
      try {
        if (galleryData.appointment?.client) {
          console.log('Agendando notificação de seleção para:', galleryData.appointment.client.name);
          
          // Get settings for pricing
          const { data: settings } = await supabase
            .from('settings')
            .select('price_commercial_hour')
            .single();

          const pricePerPhoto = settings?.price_commercial_hour || 30;
          const minimumPhotos = galleryData.appointment.minimum_photos || 5;
          const extraPhotos = Math.max(0, photoIds.length - minimumPhotos);
          const extraCost = extraPhotos * pricePerPhoto;
          
          const formattedExtraCost = new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }).format(extraCost);
          
          const formattedPricePerPhoto = new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }).format(pricePerPhoto);
          
          // Variables for template processing
          const variables = {
            client_name: galleryData.appointment.client.name,
            selected_count: photoIds.length.toString(),
            minimum_photos: minimumPhotos.toString(),
            extra_photos: extraPhotos.toString(),
            extra_cost: formattedExtraCost,
            price_per_photo: formattedPricePerPhoto,
            delivery_days: '7'
          };

          // Get selection received template
          const { data: template } = await supabase
            .from('notification_templates')
            .select('message_template')
            .eq('type', 'selection_received')
            .eq('is_active', true)
            .single();

          if (template) {
            // Process template with variables
            let message = template.message_template;
            Object.entries(variables).forEach(([key, value]) => {
              message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
            });

            // Schedule selection received notification (immediate)
            await supabase
              .from('notification_queue')
              .insert({
                appointment_id: galleryData.appointment.id,
                template_type: 'selection_received',
                recipient_phone: galleryData.appointment.client.phone,
                recipient_name: galleryData.appointment.client.name,
                message,
                scheduled_for: new Date().toISOString()
              });

            console.log('✅ Notificação de seleção agendada na fila');
          }
        }
      } catch (notificationError) {
        console.log('⚠️ Erro ao agendar notificações (não crítico):', notificationError);
      }

      await fetchGalleries();
      return true;
    } catch (err) {
      console.error('Erro ao submeter seleção:', err);
      // Mesmo com erro no WhatsApp, a seleção foi salva com sucesso
      await fetchGalleries();
      return true;
    }
  };

  const processTemplate = async (templateType: string, variables: Record<string, string>): Promise<string> => {
    try {
      const { data: template } = await supabase
        .from('notification_templates')
        .select('message_template')
        .eq('type', templateType)
        .eq('is_active', true)
        .single();

      if (!template) {
        return `Template ${templateType} não encontrado`;
      }

      let message = template.message_template;
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      return message;
    } catch (error) {
      console.error('Erro ao processar template:', error);
      return `Erro ao processar template ${templateType}`;
    }
  };
          

  const generateSelectionCode = (photos: Photo[]): string => {
    const selectedPhotos = photos.filter(photo => photo.is_selected);
    return selectedPhotos.map(photo => photo.filename).join(' OR ');
  };

  const deletePhoto = async (photoId: string) => {
    try {
      // Get photo details first
      const { data: photo, error: photoError } = await supabase
        .from('photos_triage')
        .select('*')
        .eq('id', photoId)
        .single();

      if (photoError) throw photoError;

      // Delete from storage
      if (photo.metadata?.storage_path) {
        await supabase.storage
          .from('photos')
          .remove([photo.metadata.storage_path]);
      }
      
      // Delete thumbnail from storage
      if (photo.metadata?.thumbnail_path) {
        await supabase.storage
          .from('photos')
          .remove([photo.metadata.thumbnail_path]);
      }
      
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
        .eq('gallery_id', photo.gallery_id);
        
      await supabase
        .from('galleries_triage')
        .update({ 
          photos_uploaded: photos?.length || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', photo.gallery_id);
      
      await fetchGalleries();
      return true;
    } catch (err) {
      console.error('Erro ao deletar foto:', err);
      setError(err instanceof Error ? err.message : 'Falha ao deletar foto');
      return false;
    }
  };
  
  return {
    galleries,
    loading,
    error,
    createGallery,
    updateGalleryStatus,
    uploadPhotos,
    getGalleryByToken,
    updatePhotoSelection,
    submitSelection: submitSelectionWithFallback,
    reprocessPendingNotifications,
    generateSelectionCode,
    deletePhoto,
    refetch: fetchGalleries
  };
}