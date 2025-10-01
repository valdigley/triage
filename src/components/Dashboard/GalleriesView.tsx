import React, { useState, useEffect } from 'react';
import { Camera, Upload, Eye, Share2, MessageCircle, Clock, Check, AlertTriangle, Plus, Trash2, UserPlus, X, Search, Phone, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/pricing';
import { useGalleries } from '../../hooks/useGalleries';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { useClients } from '../../hooks/useClients';
import { PhotoUpload } from '../Gallery/PhotoUpload';
import { Gallery, Photo } from '../../types';

export function GalleriesView() {
  const { galleries, loading, updateGalleryStatus, createGallery, deleteGallery } = useGalleries();
  const { sendGalleryLink } = useWhatsApp();
  const { clients } = useClients();
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sendingMessage, setSendingMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingPhotos, setDeletingPhotos] = useState<Set<string>>(new Set());
  const [deletingGallery, setDeletingGallery] = useState<string | null>(null);
  const [showCreateGallery, setShowCreateGallery] = useState(false);
  const [newGallery, setNewGallery] = useState({
    name: '',
    selected_client_id: '',
    client_name: '',
    client_phone: '',
    client_email: '',
    password: '',
    expiration_days: 30,
    session_type: 'tematico' as 'aniversario' | 'gestante' | 'formatura' | 'comercial' | 'pre_wedding' | 'tematico'
  });
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1: Select Client, 2: Gallery Details
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  const fetchPhotos = async (galleryId: string) => {
    try {
      const { data, error } = await supabase
        .from('photos_triage')
        .select('*')
        .eq('gallery_id', galleryId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Erro ao buscar fotos:', error);
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm(`Tem certeza que deseja deletar a foto "${photo.filename}"?`)) {
      return;
    }
    
    setDeletingPhotos(prev => new Set(prev).add(photo.id));
    
    try {
      // Delete from storage
      if (photo.metadata?.storage_path) {
        const { error: deleteError } = await supabase.storage
          .from('photos')
          .remove([photo.metadata.storage_path]);
        
        if (deleteError) console.warn('Erro ao deletar do storage:', deleteError);
      }
      
      // Delete thumbnail from storage
      if (photo.metadata?.thumbnail_path) {
        const { error: thumbDeleteError } = await supabase.storage
          .from('photos')
          .remove([photo.metadata.thumbnail_path]);
        
        if (thumbDeleteError) console.warn('Erro ao deletar thumbnail:', thumbDeleteError);
      }
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('photos_triage')
        .delete()
        .eq('id', photo.id);
      
      if (dbError) throw dbError;
      
      // Update local state
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      
      // Update gallery photo count
      if (selectedGallery) {
        const newCount = photos.length - 1;
        await supabase
          .from('galleries_triage')
          .update({ 
            photos_uploaded: newCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedGallery.id);
        
        setSelectedGallery(prev => prev ? { 
          ...prev, 
          photos_uploaded: newCount 
        } : null);
      }
      
    } catch (error) {
      console.error('Erro ao deletar foto:', error);
      alert('Erro ao deletar foto. Tente novamente.');
    } finally {
      setDeletingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photo.id);
        return newSet;
      });
    }
  };

  const handleDeleteGallery = async (gallery: Gallery) => {
    const confirmMessage = `Tem certeza que deseja excluir a galeria "${gallery.name}"?\n\n` +
                          `Esta ação irá:\n` +
                          `• Excluir todas as ${gallery.photos_uploaded} fotos da galeria\n` +
                          `• Remover todos os arquivos do storage\n` +
                          `• Excluir permanentemente a galeria\n\n` +
                          `Esta ação NÃO PODE ser desfeita!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setDeletingGallery(gallery.id);
    try {
      const success = await deleteGallery(gallery.id);
      if (success) {
        alert('Galeria excluída com sucesso!');
        // If we were viewing this gallery, go back to list
        if (selectedGallery?.id === gallery.id) {
          setSelectedGallery(null);
        }
      } else {
        alert('Erro ao excluir galeria. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao excluir galeria:', error);
      alert('Erro ao excluir galeria. Tente novamente.');
    } finally {
      setDeletingGallery(null);
    }
  };

  const handleViewGallery = (gallery: Gallery) => {
    setSelectedGallery(gallery);
    fetchPhotos(gallery.id);
  };

  const handleSendGalleryLink = async (gallery: Gallery) => {
    if (!gallery.appointment?.client) return;
    
    setSendingMessage(gallery.id);
    try {
      const success = await sendGalleryLink(
        gallery.appointment.client.name,
        gallery.appointment.client.phone,
        gallery.gallery_token,
        gallery.link_expires_at
      );
      
      if (success) {
        alert('Link da galeria enviado via WhatsApp com sucesso!');
      } else {
        alert('Erro ao enviar link. Verifique se o WhatsApp está conectado.');
      }
    } catch (error) {
      console.error('Erro ao enviar link da galeria:', error);
      alert('Erro ao enviar link da galeria.');
    } finally {
      setSendingMessage(null);
    }
  };

  const copyGalleryLink = (token: string) => {
    const link = `${window.location.origin}/gallery/${token}`;
    navigator.clipboard.writeText(link);
    alert('Link copiado para a área de transferência!');
  };

  const handleCreateManualGallery = async () => {
    if (!newGallery.name || !newGallery.selected_client_id) {
      alert('Nome da galeria e cliente são obrigatórios');
      return;
    }

    setCreating(true);
    try {
      // Use selected client
      const clientId = newGallery.selected_client_id;

      // Create manual appointment with selected session type
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert([{
          client_id: clientId,
          session_type: newGallery.session_type,
          session_details: { theme: 'Galeria Manual' },
          scheduled_date: new Date().toISOString(),
          total_amount: 0,
          minimum_photos: 5,
          status: 'confirmed',
          payment_status: 'approved',
          terms_accepted: true
        }])
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Create gallery
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + newGallery.expiration_days);

      const { data: gallery, error: galleryError } = await supabase
        .from('galleries_triage')
        .insert([{
          appointment_id: appointment.id,
          name: newGallery.name,
          password: newGallery.password || null,
          link_expires_at: expirationDate.toISOString(),
          status: 'pending'
        }])
        .select()
        .single();

      if (galleryError) throw galleryError;

      alert('Galeria criada com sucesso!');
      setShowCreateGallery(false);
      setCreateStep(1);
      setNewGallery({
        name: '',
        selected_client_id: '',
        client_name: '',
        client_phone: '',
        client_email: '',
        password: '',
        expiration_days: 30,
        session_type: 'tematico'
      });
      
      // Refresh galleries list
      window.location.reload();
    } catch (error) {
      console.error('Erro ao criar galeria:', error);
      alert('Erro ao criar galeria. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients.find(c => c.id === clientId);
    if (selectedClient) {
      setNewGallery(prev => ({
        ...prev,
        selected_client_id: clientId,
        client_name: selectedClient.name,
        client_phone: selectedClient.phone,
        client_email: selectedClient.email || ''
      }));
      setCreateStep(2);
    }
  };

  const resetCreateGallery = () => {
    setShowCreateGallery(false);
    setCreateStep(1);
    setClientSearchTerm('');
    setNewGallery({
      name: '',
      selected_client_id: '',
      client_name: '',
      client_phone: '',
      client_email: '',
      password: '',
      expiration_days: 30,
      session_type: 'tematico'
    });
  };

  const getStatusBadge = (status: Gallery['status']) => {
    const statusConfig = {
      pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      started: { label: 'Iniciado', className: 'bg-blue-100 text-blue-800', icon: Eye },
      completed: { label: 'Finalizado', className: 'bg-green-100 text-green-800', icon: Check }
    };

    const config = statusConfig[status] || { label: 'Desconhecido', className: 'bg-gray-100 text-gray-800', icon: AlertTriangle };
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </span>
    );
  };

  const filteredGalleries = galleries.filter(gallery =>
    statusFilter === 'all' || gallery.status === statusFilter
  );

  // Filter clients based on search term
  const filteredClients = clients.filter(client => {
    if (!clientSearchTerm.trim()) return true;

    const searchLower = clientSearchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.phone.toLowerCase().includes(searchLower) ||
      (client.email && client.email.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Galerias de Fotos</h1>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowCreateGallery(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Galeria</span>
          </button>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="started">Iniciado</option>
            <option value="completed">Finalizado</option>
          </select>
        </div>
      </div>

      {!selectedGallery ? (
        /* Galleries List */
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Galeria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Fotos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Selecionadas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Expira em
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredGalleries.map((gallery) => (
                    <tr key={gallery.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {gallery.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {gallery.gallery_token ? `${gallery.gallery_token.substring(0, 8)}...` : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {gallery.appointment?.client?.name || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {gallery.appointment?.client?.phone || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {gallery.photos_uploaded}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {gallery.photos_selected?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(gallery.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(gallery.link_expires_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleViewGallery(gallery)}
                            className="text-purple-600 hover:text-purple-900 transition-colors"
                            title="Ver galeria"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => copyGalleryLink(gallery.gallery_token)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Copiar link"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          {gallery.photos_uploaded > 0 && gallery.appointment?.client && (
                            <button
                              onClick={() => handleSendGalleryLink(gallery)}
                              disabled={sendingMessage === gallery.id}
                              className="text-green-600 hover:text-green-900 transition-colors disabled:opacity-50"
                              title="Enviar link via WhatsApp"
                            >
                              {sendingMessage === gallery.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                              ) : (
                                <MessageCircle className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {gallery.status === 'started' && (
                            <button
                              onClick={() => updateGalleryStatus(gallery.id, 'completed')}
                              className="text-green-600 hover:text-green-900 transition-colors"
                              title="Marcar como finalizado"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {gallery.status === 'completed' && (
                            <button
                              onClick={() => updateGalleryStatus(gallery.id, 'started')}
                              className="text-orange-600 hover:text-orange-900 transition-colors"
                              title="Reativar seleção"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteGallery(gallery)}
                            disabled={deletingGallery === gallery.id}
                            className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50"
                            title="Excluir galeria"
                          >
                            {deletingGallery === gallery.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {filteredGalleries.map((gallery) => (
             <div key={gallery.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                   <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                      {gallery.name}
                    </h3>
                   <p className="text-sm text-gray-600 dark:text-gray-300">
                      {gallery.appointment?.client?.name || 'N/A'}
                    </p>
                   <p className="text-xs text-gray-500 dark:text-gray-400">
                      {gallery.appointment?.client?.phone || 'N/A'}
                    </p>
                  </div>
                  <div className="ml-3">
                    {getStatusBadge(gallery.status)}
                  </div>
                </div>

                {/* Stats Grid */}
               <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {gallery.photos_uploaded}
                    </div>
                   <div className="text-xs text-gray-600 dark:text-gray-400">Fotos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {gallery.photos_selected?.length || 0}
                    </div>
                   <div className="text-xs text-gray-600 dark:text-gray-400">Selecionadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-orange-600">
                      {new Date(gallery.link_expires_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </div>
                   <div className="text-xs text-gray-600 dark:text-gray-400">Expira</div>
                  </div>
                </div>

                {/* Token Info */}
               <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-600 rounded text-center">
                 <span className="text-xs font-mono text-gray-600 dark:text-gray-300">
                    {gallery.gallery_token ? `${gallery.gallery_token.substring(0, 12)}...` : 'N/A'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleViewGallery(gallery)}
                    className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Ver</span>
                  </button>
                  
                  <button
                    onClick={() => copyGalleryLink(gallery.gallery_token)}
                    className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Link</span>
                  </button>
                  
                  {gallery.photos_uploaded > 0 && gallery.appointment?.client && (
                    <button
                      onClick={() => handleSendGalleryLink(gallery)}
                      disabled={sendingMessage === gallery.id}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                    >
                      {sendingMessage === gallery.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <MessageCircle className="h-4 w-4" />
                          <span>WhatsApp</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Status Actions */}
                <div className="mt-3 flex gap-2">
                  {gallery.status === 'started' && (
                    <button
                      onClick={() => updateGalleryStatus(gallery.id, 'completed')}
                      className="flex-1 bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Check className="h-4 w-4" />
                      <span>Finalizar</span>
                    </button>
                  )}
                  {gallery.status === 'completed' && (
                    <button
                      onClick={() => updateGalleryStatus(gallery.id, 'started')}
                      className="flex-1 bg-orange-100 text-orange-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Clock className="h-4 w-4" />
                      <span>Reativar</span>
                    </button>
                  )}
                </div>

                {/* Delete Button */}
                <div className="mt-3">
                  <button
                    onClick={() => handleDeleteGallery(gallery)}
                    disabled={deletingGallery === gallery.id}
                    className="w-full bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                  >
                    {deletingGallery === gallery.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Excluindo...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>Excluir Galeria</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredGalleries.length === 0 && (
            <div className="text-center py-12">
              <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {statusFilter === 'all' ? 'Nenhuma galeria encontrada' : `Nenhuma galeria com status "${statusFilter}"`}
              </p>
            </div>
          )}
        </>
      ) : (
        /* Gallery Details */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedGallery(null)}
              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
            >
              ← Voltar para Galerias
            </button>
            <div className="flex items-center space-x-3">
              {getStatusBadge(selectedGallery.status)}
              <button
                onClick={() => handleDeleteGallery(selectedGallery)}
                disabled={deletingGallery === selectedGallery.id}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {deletingGallery === selectedGallery.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Excluir Galeria</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Gallery Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Cliente</label>
                <p className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedGallery.appointment?.client?.name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Fotos Enviadas</label>
                <p className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">{selectedGallery.photos_uploaded}</p>
              </div>
              <div>
                <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Selecionadas</label>
                <p className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">{selectedGallery.photos_selected?.length || 0}</p>
              </div>
              <div className="col-span-2 lg:col-span-1">
                <label className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Link da Galeria</label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded flex-1 truncate text-gray-900 dark:text-white">
                    {selectedGallery.gallery_token ? `${selectedGallery.gallery_token.substring(0, 12)}...` : 'N/A'}
                  </code>
                  <button
                    onClick={() => selectedGallery.gallery_token && copyGalleryLink(selectedGallery.gallery_token)}
                    disabled={!selectedGallery.gallery_token}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Photo Upload */}
            <PhotoUpload
              galleryId={selectedGallery.id}
              gallery={selectedGallery}
              onUploadComplete={() => {
                fetchPhotos(selectedGallery.id);
                // Update gallery in state
                setSelectedGallery(prev => prev ? { 
                  ...prev, 
                  photos_uploaded: (prev.photos_uploaded || 0) + 1 
                } : null);
              }}
            />
          </div>

          {/* Photos Grid */}
          {photos.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
                  Fotos da Galeria ({photos.length})
                </h3>
                
                {selectedGallery.photos_selected && selectedGallery.photos_selected.length > 0 && (
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{selectedGallery.photos_selected.length}</span> fotos selecionadas pelo cliente
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      photo.is_selected
                        ? 'border-green-500 ring-2 ring-green-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={photo.thumbnail || photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback para imagem de erro
                        const target = e.target as HTMLImageElement;
                        target.src = `https://via.placeholder.com/300x200/f0f0f0/666?text=${encodeURIComponent(photo.filename)}`;
                      }}
                    />
                    
                    {/* Photo Code */}
                    <div className="absolute top-1 left-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded max-w-[80%] truncate">
                      {photo.filename}
                    </div>

                    {/* Selection Indicator */}
                    {photo.is_selected && (
                      <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}

                    {/* Client Comment Indicator */}
                    {photo.metadata?.client_comment && (
                      <div className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white rounded-full p-1" title="Cliente deixou comentário">
                        <MessageCircle className="h-3 w-3" />
                      </div>
                    )}
                    {/* Delete Button */}
                    <button
                      onClick={() => deletePhoto(photo)}
                      disabled={deletingPhotos.has(photo.id)}
                      className="absolute bottom-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 sm:p-1.5 transition-colors disabled:opacity-50"
                      title="Deletar foto"
                    >
                      {deletingPhotos.has(photo.id) ? (
                        <div className="animate-spin rounded-full h-2 w-2 sm:h-3 sm:w-3 border border-white border-t-transparent"></div>
                      ) : (
                        <Trash2 className="h-2 w-2 sm:h-3 sm:w-3" />
                      )}
                    </button>

                    {/* Extra Photo Indicator */}
                    <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">
                      Preview
                    </div>

                    {/* Client Comment Overlay */}
                    {photo.metadata?.client_comment && (
                      <div className="absolute inset-0 bg-blue-600 bg-opacity-0 hover:bg-opacity-90 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
                        <div className="text-white text-center p-2 max-w-full">
                          <div className="flex items-center justify-center mb-2">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            <span className="text-xs font-medium">Instruções do Cliente:</span>
                          </div>
                          <p className="text-sm break-words">{photo.metadata.client_comment}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Selection Code */}
              {selectedGallery.photos_selected && selectedGallery.photos_selected.length > 0 && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm sm:text-base font-medium text-gray-800 dark:text-white">Código das Fotos Selecionadas</h4>
                    <button
                      onClick={() => {
                        const selectedPhotosData = photos.filter(p => selectedGallery.photos_selected?.includes(p.id));
                        const code = selectedPhotosData.map(p => p.photo_code).join(' OR ');
                        navigator.clipboard.writeText(code);
                        alert('Código copiado!');
                      }}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs sm:text-sm flex items-center space-x-1"
                    >
                      <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Copiar</span>
                    </button>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-2 sm:p-3 rounded border border-gray-300 dark:border-gray-600 font-mono text-xs sm:text-sm break-all text-gray-900 dark:text-white">
                    {photos
                      .filter(p => selectedGallery.photos_selected?.includes(p.id))
                      .map(p => p.filename)
                      .join(' OR ')
                    }
                  </div>
                </div>
              )}

              {/* Client Comments Summary */}
              {photos.some(p => p.metadata?.client_comment) && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center mb-3">
                    <MessageCircle className="h-5 w-5 text-blue-600 mr-2" />
                    <h4 className="text-sm sm:text-base font-medium text-blue-800 dark:text-blue-200">Instruções de Ajuste do Cliente</h4>
                  </div>
                  <div className="space-y-3">
                    {photos
                      .filter(p => p.metadata?.client_comment)
                      .map(photo => (
                        <div key={photo.id} className="bg-white dark:bg-blue-800/30 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                          <div className="flex items-start space-x-3">
                            <img
                              src={photo.thumbnail || photo.url}
                              alt={photo.filename}
                              className="w-12 h-12 object-cover rounded border"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = `https://via.placeholder.com/48x48/f0f0f0/666?text=${encodeURIComponent(photo.filename.substring(0, 2))}`;
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-mono text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">
                                  {photo.filename}
                                </span>
                                {photo.is_selected && (
                                  <span className="inline-flex items-center space-x-1 text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800 px-2 py-1 rounded">
                                    <Check className="h-3 w-3" />
                                    <span>Selecionada</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-blue-800 dark:text-blue-200 break-words">
                                {photo.metadata.client_comment}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                  <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-800/50 rounded text-xs text-blue-700 dark:text-blue-300">
                    💡 <strong>Dica:</strong> Passe o mouse sobre as fotos com ícone 💬 para ver as instruções rapidamente
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Gallery Modal */}
      {showCreateGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Nova Galeria Manual</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {createStep === 1 ? 'Passo 1: Selecionar Cliente' : 'Passo 2: Detalhes da Galeria'}
                  </p>
                </div>
                <button
                  onClick={resetCreateGallery}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Step 1: Select Client */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 mb-4">
                    <p className="text-sm text-purple-800 dark:text-purple-200">
                      Selecione um cliente existente para criar a galeria. Se o cliente não existir, 
                      <button 
                        onClick={() => {
                          resetCreateGallery();
                          setShowCreateClient(true);
                        }}
                        className="text-purple-600 dark:text-purple-400 underline ml-1"
                      >
                        crie um novo cliente primeiro
                      </button>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Buscar e Selecionar Cliente
                    </label>
                    
                    {/* Search */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={clientSearchTerm}
                        onChange={(e) => setClientSearchTerm(e.target.value)}
                        placeholder="Digite o nome, telefone ou email do cliente..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Show results count */}
                    {clientSearchTerm && (
                      <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        {filteredClients.length} {filteredClients.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
                      </div>
                    )}

                    {/* Clients List */}
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                      {clients.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                          <p>Nenhum cliente cadastrado.</p>
                          <button
                            onClick={() => {
                              resetCreateGallery();
                              // Note: setShowCreateClient is not defined in this component
                              // User should navigate to clients view to create one
                            }}
                            className="text-purple-600 dark:text-purple-400 underline mt-2"
                          >
                            Ir para Clientes
                          </button>
                        </div>
                      ) : filteredClients.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                          <p>Nenhum cliente encontrado com "{clientSearchTerm}"</p>
                          <button
                            onClick={() => setClientSearchTerm('')}
                            className="text-purple-600 dark:text-purple-400 underline mt-2"
                          >
                            Limpar busca
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-600">
                          {filteredClients.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => handleClientSelect(client.id)}
                              className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 dark:text-white">{client.name}</h4>
                                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-300 mt-1">
                                    <Phone className="h-3 w-3" />
                                    <span>{client.phone}</span>
                                  </div>
                                  {client.email && (
                                    <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      <Mail className="h-3 w-3" />
                                      <span>{client.email}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-green-600">
                                    {formatCurrency(client.total_spent)}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(client.created_at).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Gallery Details */}
              {createStep === 2 && (
                <div className="space-y-4">
                  {/* Selected Client Info */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-green-800 dark:text-green-200">Cliente Selecionado</h4>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">{newGallery.client_name}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">{newGallery.client_phone}</p>
                      </div>
                      <button
                        onClick={() => setCreateStep(1)}
                        className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 text-sm underline"
                      >
                        Alterar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nome da Galeria *
                    </label>
                    <input
                      type="text"
                      value={newGallery.name}
                      onChange={(e) => setNewGallery(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Ex: Ensaio João - Janeiro 2025"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de Sessão *
                    </label>
                    <select
                      value={newGallery.session_type}
                      onChange={(e) => setNewGallery(prev => ({ ...prev, session_type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="aniversario">🎂 Aniversário</option>
                      <option value="gestante">🤱 Gestante</option>
                      <option value="formatura">🎓 Formatura</option>
                      <option value="comercial">💼 Comercial</option>
                      <option value="pre_wedding">💑 Pré-wedding</option>
                      <option value="tematico">🎨 Temático</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Senha da Galeria
                    </label>
                    <input
                      type="text"
                      value={newGallery.password}
                      onChange={(e) => setNewGallery(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Senha opcional para acesso"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Validade (dias)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={newGallery.expiration_days}
                      onChange={(e) => setNewGallery(prev => ({ ...prev, expiration_days: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                {createStep === 2 && (
                  <button
                    onClick={() => setCreateStep(1)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Voltar
                  </button>
                )}
                <button
                  onClick={resetCreateGallery}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                {createStep === 2 && (
                  <button
                    onClick={handleCreateManualGallery}
                    disabled={creating}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    {creating ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    <span>{creating ? 'Criando...' : 'Criar Galeria'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}