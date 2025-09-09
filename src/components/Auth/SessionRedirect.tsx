import React from 'react';
import { Camera, ExternalLink, Shield } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

function LogoDisplay() {
  const { settings } = useSettings();
  
  if (settings?.studio_logo_url) {
    return (
      <img 
        src={settings.studio_logo_url} 
        alt="Logo do Estúdio" 
        className="h-32 w-32 mx-auto object-contain rounded"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.innerHTML = '<svg class="h-32 w-32 mx-auto text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>';
          target.parentNode?.appendChild(fallback);
        }}
      />
    );
  }
  
  return <Camera className="h-32 w-32 mx-auto text-purple-600" />;
}

export function SessionRedirect() {
  const { settings } = useSettings();

  const redirectToMainSite = () => {
    window.location.href = 'https://fotografo.site/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-8 text-center">
          <div className="mb-4 flex justify-center">
            <LogoDisplay />
          </div>
          <h1 className="text-2xl font-bold">Triagem</h1>
          <p className="text-gray-300 mt-1">By Valdigley Santos</p>
        </div>

        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center mb-4">
            <div className="bg-orange-100 dark:bg-orange-900/20 p-4 rounded-full">
              <Shield className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Acesso Restrito
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Para acessar o sistema de triagem, você precisa estar logado no site principal.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Como acessar:
            </h3>
            <ol className="text-xs text-blue-700 dark:text-blue-300 text-left space-y-1">
              <li>1. Faça login em fotografo.site</li>
              <li>2. Acesse o menu de sistemas</li>
              <li>3. Clique em "Triagem"</li>
              <li>4. Você será redirecionado automaticamente</li>
            </ol>
          </div>

          <button
            onClick={redirectToMainSite}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
          >
            <ExternalLink className="h-5 w-5" />
            <span>Ir para fotografo.site</span>
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sistema de segurança integrado
          </p>
        </div>
      </div>
    </div>
  );
}