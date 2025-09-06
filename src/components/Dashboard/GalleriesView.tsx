import React, { useState } from 'react';
import { Camera, Upload, Eye, Trash2, Clock, CheckCircle, AlertCircle, Send, ExternalLink } from 'lucide-react';
import { useGalleries } from '../../hooks/useGalleries';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { PhotoUpload } from '../Gallery/PhotoUpload';
import { Gallery, Photo } from '../../types';

export function GalleriesView() {
  const { galleries, loading, updateGalleryStatus, deleteGallery } = useGalleries();
  const { sendGalleryLink } = useWhatsApp();
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState<string | null>(null);

  const handleSendGalleryLink = async (gallery: Gallery) => {
    if (!gallery.appointment?.client) {
      alert('Dados do cliente não encontrados');
      return;
    }

    setSendingLink(gallery.id);
    try {
      const success = await sendGalleryLink(
        gallery.appointment.client.name,
        gallery.appointment.client.phone,
        gallery.gallery_token,
        gallery.link_expires_at
      );

      if (success) {
        alert('Link da galeria enviado via WhatsApp!');
      } else {
        const galleryUrl = `${window.location.origin}/gallery/${gallery.gallery_token}`;
        const shouldCopy = confirm(`Falha no WhatsApp. Deseja copiar o link da galeria?\n\n${galleryUrl}`);
        if (shouldCopy) {
          navigator.clipboard.writeText(galleryUrl);
          alert('Link copiado para a área de transferência!');
        }
      }
    } catch (error) {
      console.error('Erro ao enviar link:', error);
      alert('Erro ao enviar link da galeria');
    } finally {
      setSendingLink(null);
    }
  };

  const getStatusBadge = (status: Gallery['status']) => {
    const statusConfig = {
      pending: { label: 'Aguardando', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      started: { label: 'Em Seleção', className: 'bg-blue-100 text-blue-800', icon: Eye },
      completed: { label: 'Concluída', className: 'bg-green-100 text-green-800', icon: CheckCircle }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </span>
    );
  };

  const isExpired = (expirationDate: string) => {
    return new Date() > new Date(expirationDate);
  };

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Galerias</h1>
      </div>

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
              {galleries.map((gallery) => (
                <tr key={gallery.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {gallery.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {gallery.appointment?.client?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {gallery.photos_uploaded} / {gallery.photos_selected?.length || 0} selecionadas
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(gallery.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${isExpired(gallery.link_expires_at) ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                      {new Date(gallery.link_expires_at).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedGallery(gallery)}
                        className="text-purple-600 hover:text-purple-900 transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowUpload(gallery.id)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Upload de fotos"
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSendGalleryLink(gallery)}
                        disabled={sendingLink === gallery.id}
                        className="text-green-600 hover:text-green-900 transition-colors disabled:text-gray-400"
                        title="Enviar link via WhatsApp"
                      >
                        {sendingLink === gallery.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir a galeria "${gallery.name}"?`)) {
                            deleteGallery(gallery.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Excluir galeria"
                      >
                        <Trash2 className="h-4 w-4" />
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
        {galleries.map((gallery) => (
          <div key={gallery.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {gallery.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {gallery.appointment?.client?.name}
                </p>
              </div>
              <div className="ml-3">
                {getStatusBadge(gallery.status)}
              </div>
            </div>

            {/* Gallery Info */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fotos</label>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {gallery.photos_uploaded} enviadas
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Selecionadas</label>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {gallery.photos_selected?.length || 0}
                </p>
              </div>
            </div>

            {/* Expiration */}
            <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <label className="text-xs font-medium text-blue-600 dark:text-blue-400">Expira em</label>
              <p className={`text-sm font-bold ${isExpired(gallery.link_expires_at) ? 'text-red-600' : 'text-blue-800 dark:text-blue-300'}`}>
                {new Date(gallery.link_expires_at).toLocaleDateString('pt-BR')}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedGallery(gallery)}
                className="bg-purple-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center space-x-1"
              >
                <Eye className="h-4 w-4" />
                <span>Detalhes</span>
              </button>
              
              <button
                onClick={() => setShowUpload(gallery.id)}
                className="bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
              >
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </button>
              
              <button
                onClick={() => handleSendGalleryLink(gallery)}
                disabled={sendingLink === gallery.id}
                className="bg-green-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 transition-colors flex items-center justify-center space-x-1"
              >
                {sendingLink === gallery.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Enviar Link</span>
              </button>
              
              <button
                onClick={() => {
                  if (confirm(`Tem certeza que deseja excluir a galeria "${gallery.name}"?`)) {
                    deleteGallery(gallery.id);
                  }
                }}
                className="bg-red-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center space-x-1"
              >
                <Trash2 className="h-4 w-4" />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {galleries.length === 0 && (
        <div className="text-center py-12">
          <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Nenhuma galeria encontrada</p>
        </div>
      )}

      {/* Gallery Details Modal */}
      {selectedGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Detalhes da Galeria
                </h3>
                <button
                  onClick={() => setSelectedGallery(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Eye className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nome</label>
                  <p className="text-base text-gray-900 dark:text-white">{selectedGallery.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Cliente</label>
                  <p className="text-base text-gray-900 dark:text-white">{selectedGallery.appointment?.client?.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedGallery.status)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Fotos Enviadas</label>
                  <p className="text-base text-gray-900 dark:text-white">{selectedGallery.photos_uploaded}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Fotos Selecionadas</label>
                  <p className="text-base text-gray-900 dark:text-white">{selectedGallery.photos_selected?.length || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Expira em</label>
                  <p className={`text-base ${isExpired(selectedGallery.link_expires_at) ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {new Date(selectedGallery.link_expires_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Link da Galeria</label>
                <div className="mt-1 flex items-center space-x-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/gallery/${selectedGallery.gallery_token}`}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/gallery/${selectedGallery.gallery_token}`;
                      navigator.clipboard.writeText(url);
                      alert('Link copiado!');
                    }}
                    className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Copiar
                  </button>
                  <a
                    href={`/gallery/${selectedGallery.gallery_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Abrir</span>
                  </a>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSelectedGallery(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Upload de Fotos
                </h3>
                <button
                  onClick={() => setShowUpload(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Eye className="h-6 w-6" />
                </button>
              </div>

              <PhotoUpload
                galleryId={showUpload}
                onUploadComplete={() => {
                  setShowUpload(null);
                  // Refresh galleries list would be called here
                }}
                gallery={galleries.find(g => g.id === showUpload)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}