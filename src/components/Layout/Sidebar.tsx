import React from 'react';
import { 
  Calendar, 
  Users, 
  Camera, 
  CreditCard, 
  Settings, 
  BarChart3,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../hooks/useSettings';

function LogoDisplay() {
  const { settings } = useSettings();
  
  if (settings?.studio_logo_url) {
    return (
      <img 
        src={settings.studio_logo_url} 
        alt="Logo do Estúdio" 
        className="h-24 w-24 object-contain rounded"
        onError={(e) => {
          // Fallback para ícone da câmera se a logo não carregar
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = document.createElement('div');
          fallback.innerHTML = '<svg class="h-24 w-24 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>';
          target.parentNode?.appendChild(fallback);
        }}
      />
    );
  }
  
  return <Camera className="h-24 w-24 text-purple-600" />;
}

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'appointments', label: 'Agendamentos', icon: Calendar },
  { id: 'galleries', label: 'Galerias', icon: Camera },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'payments', label: 'Pagamentos', icon: CreditCard },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({ currentView, onViewChange, onLogout, isOpen, onToggle }: SidebarProps) {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg h-full flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      {/* Mobile close button */}
      <div className="lg:hidden absolute top-4 right-4">
        <button
          onClick={onToggle}
          className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex justify-center">
            <LogoDisplay />
          </div>
          <h1 className="text-lg lg:text-xl font-bold text-gray-800 dark:text-white">Triagem</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">By Valdigley Santos</p>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    onViewChange(item.id);
                    onToggle(); // Close sidebar on mobile after selection
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    currentView === item.id
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors"
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
        
        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 transition-colors font-medium"
        >
          <LogOut className="h-5 w-5" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}