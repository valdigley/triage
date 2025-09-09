// ==========================================
// COMPONENTES REACT UNIFICADOS - VALDIGLEY SANTOS
// ==========================================
// Componentes padronizados para todos os sistemas
// Mantém funcionalidades, padroniza visual

import React from 'react';

// ==========================================
// INTERFACES
// ==========================================

interface VSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

interface VSCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

interface VSLogoProps {
  title: string;
  subtitle?: string;
  icon?: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

interface VSHeaderProps {
  logo: VSLogoProps;
  navigation?: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
  }>;
  actions?: React.ReactNode;
  theme?: 'triagem' | 'drive' | 'contratos' | 'formatura';
  onMobileMenuToggle?: () => void;
}

interface VSStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  onClick?: () => void;
}

interface VSPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

interface VSSidebarProps {
  logo: VSLogoProps;
  navigation: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
  }>;
  footer?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

// ==========================================
// COMPONENTE: VS BUTTON
// ==========================================

export function VSButton({ 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  icon, 
  children, 
  className = '', 
  disabled,
  ...props 
}: VSButtonProps) {
  const baseClasses = 'vs-btn';
  const variantClasses = `vs-btn-${variant}`;
  const sizeClasses = size !== 'md' ? `vs-btn-${size}` : '';
  
  const classes = [baseClasses, variantClasses, sizeClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button 
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <div className="vs-loading" />}
      {!loading && icon && icon}
      {children}
    </button>
  );
}

// ==========================================
// COMPONENTE: VS CARD
// ==========================================

export function VSCard({ children, className = '', hover = true }: VSCardProps) {
  const classes = ['vs-modern-card', hover ? 'vs-hover-lift' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

export function VSCardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`vs-card-header ${className}`}>
      {children}
    </div>
  );
}

export function VSCardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`vs-card-body ${className}`}>
      {children}
    </div>
  );
}

export function VSCardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`vs-card-footer ${className}`}>
      {children}
    </div>
  );
}

// ==========================================
// COMPONENTE: VS LOGO UNIFICADA
// ==========================================

export function VSLogo({ title, subtitle, icon, logoUrl, size = 'md', onClick }: VSLogoProps) {
  const [imageError, setImageError] = React.useState(false);
  
  const sizeClasses = {
    sm: { container: 'w-8 h-8', title: 'text-base', subtitle: 'text-xs', icon: 'text-sm' },
    md: { container: 'w-12 h-12', title: 'text-xl', subtitle: 'text-sm', icon: 'text-lg' },
    lg: { container: 'w-14 h-14', title: 'text-2xl', subtitle: 'text-base', icon: 'text-xl' }
  };

  const sizes = sizeClasses[size];

  const handleClick = onClick ? { onClick, role: 'button', tabIndex: 0 } : {};

  return (
    <div className={`vs-unified-logo ${onClick ? 'vs-cursor-pointer' : ''}`} {...handleClick}>
      <div className={`vs-logo-container ${sizes.container}`}>
        {logoUrl && !imageError ? (
          <img 
            src={logoUrl} 
            alt={title}
            className="vs-logo-image"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={`vs-logo-fallback ${sizes.icon}`}>
            {icon || '📸'}
          </div>
        )}
      </div>
      <div className="vs-logo-text">
        <div className={`vs-logo-title ${sizes.title}`}>{title}</div>
        {subtitle && <div className={`vs-logo-subtitle ${sizes.subtitle}`}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: VS HEADER UNIFICADO
// ==========================================

export function VSHeader({ logo, navigation, actions, theme = 'triagem', onMobileMenuToggle }: VSHeaderProps) {
  return (
    <header className={`vs-unified-header vs-theme-${theme}`}>
      <div className="vs-header-content">
        {/* Mobile Menu Button */}
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="vs-mobile-menu-btn lg:hidden"
            aria-label="Abrir menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <VSLogo {...logo} />
        
        {navigation && navigation.length > 0 && (
          <nav className="vs-nav-horizontal hidden lg:flex">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`vs-nav-item ${item.active ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}
        
        {actions && (
          <div className="vs-header-actions">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

// ==========================================
// COMPONENTE: VS STAT CARD
// ==========================================

export function VSStatCard({ title, value, icon, trend, color = 'blue', onClick }: VSStatCardProps) {
  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    red: 'text-red-400'
  };

  const trendColorClasses = {
    blue: 'text-blue-300',
    green: 'text-green-300',
    purple: 'text-purple-300',
    orange: 'text-orange-300',
    red: 'text-red-300'
  };

  const handleClick = onClick ? { onClick, role: 'button', tabIndex: 0 } : {};

  return (
    <div className={`vs-stat-card ${onClick ? 'vs-cursor-pointer' : ''} vs-fade-in`} {...handleClick}>
      <div className="vs-stat-content">
        <div className="vs-stat-info">
          <h3>{title}</h3>
          <div className="vs-stat-value">{value}</div>
          {trend && (
            <div className={`vs-stat-trend ${trendColorClasses[color]}`}>
              {trend}
            </div>
          )}
        </div>
        <div className="vs-stat-icon">
          <div className={colorClasses[color]}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: VS PAGE HEADER
// ==========================================

export function VSPageHeader({ title, subtitle, actions }: VSPageHeaderProps) {
  return (
    <div className="vs-page-header vs-slide-up">
      <div className="vs-page-title">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="vs-page-subtitle">{subtitle}</p>}
        </div>
        {actions && (
          <div className="vs-flex vs-gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: VS SIDEBAR
// ==========================================

export function VSSidebar({ logo, navigation, footer, isOpen, onToggle }: VSSidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      <div className={`vs-unified-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="vs-sidebar-header">
          <VSLogo {...logo} size="lg" />
        </div>
        
        <nav className="vs-sidebar-nav">
          <ul>
            {navigation.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    item.onClick?.();
                    onToggle(); // Close on mobile
                  }}
                  className={item.active ? 'active' : ''}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        
        {footer && (
          <div className="vs-sidebar-footer">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

// ==========================================
// COMPONENTE: VS LAYOUT PRINCIPAL
// ==========================================

interface VSLayoutProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  theme?: 'triagem' | 'drive' | 'contratos' | 'formatura';
  hasSidebar?: boolean;
}

export function VSLayout({ header, sidebar, children, theme = 'triagem', hasSidebar = false }: VSLayoutProps) {
  return (
    <div className={`vs-theme-${theme} min-h-screen`}>
      {header}
      
      <div className="vs-flex">
        {sidebar}
        
        <main className={`vs-main-content ${hasSidebar ? 'with-sidebar' : ''}`}>
          <div className="vs-content-area">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: VS EMPTY STATE
// ==========================================

export function VSEmptyState({ 
  icon, 
  title, 
  description, 
  action 
}: { 
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="vs-empty-state vs-fade-in">
      <div className="vs-empty-icon">
        {icon}
      </div>
      <h3 className="vs-empty-title">{title}</h3>
      {description && (
        <p className="vs-empty-description">{description}</p>
      )}
      {action && action}
    </div>
  );
}

// ==========================================
// COMPONENTE: VS STATUS BADGE
// ==========================================

export function VSStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: string; label: string }> = {
    pending: { variant: 'warning', label: 'Pendente' },
    confirmed: { variant: 'success', label: 'Confirmado' },
    completed: { variant: 'info', label: 'Concluído' },
    cancelled: { variant: 'error', label: 'Cancelado' },
    approved: { variant: 'success', label: 'Aprovado' },
    rejected: { variant: 'error', label: 'Rejeitado' },
    active: { variant: 'success', label: 'Ativo' },
    inactive: { variant: 'error', label: 'Inativo' }
  };

  const config = statusConfig[status] || { variant: 'info', label: status };

  return (
    <span className={`vs-badge vs-badge-${config.variant}`}>
      {config.label}
    </span>
  );
}

// ==========================================
// HOOK: VS THEME
// ==========================================

export function useVSTheme() {
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vs-darkMode');
      if (saved !== null) {
        return JSON.parse(saved);
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vs-darkMode', JSON.stringify(isDarkMode));
      
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);
  const setDarkMode = (isDark: boolean) => setIsDarkMode(isDark);

  return { isDarkMode, toggleDarkMode, setDarkMode };
}

// ==========================================
// COMPONENTE: VS THEME TOGGLE
// ==========================================

export function VSThemeToggle() {
  const { isDarkMode, toggleDarkMode } = useVSTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className="vs-theme-toggle"
      title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
    >
      {isDarkMode ? '☀️' : '🌙'}
    </button>
  );
}

// ==========================================
// COMPONENTE: VS TABLE
// ==========================================

interface VSTableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export function VSTable({ headers, children, className = '' }: VSTableProps) {
  return (
    <div className={`vs-table-container ${className}`}>
      <table className="vs-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// COMPONENTE: VS INPUT
// ==========================================

interface VSInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  help?: string;
  icon?: React.ReactNode;
}

export function VSInput({ 
  label, 
  error, 
  help, 
  icon, 
  className = '', 
  ...props 
}: VSInputProps) {
  const inputClasses = ['vs-input', error ? 'border-red-500' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="vs-form-group">
      {label && (
        <label className="vs-form-label">
          {label}
        </label>
      )}
      
      <div className="vs-relative">
        {icon && (
          <div className="vs-absolute left-3 top-3 text-gray-400">
            {icon}
          </div>
        )}
        <input 
          className={`${inputClasses} ${icon ? 'pl-10' : ''}`}
          {...props}
        />
      </div>
      
      {error && (
        <div className="vs-form-error">{error}</div>
      )}
      
      {help && !error && (
        <div className="vs-form-help">{help}</div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: VS MODAL
// ==========================================

interface VSModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function VSModal({ isOpen, onClose, title, children, size = 'md' }: VSModalProps) {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg', 
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="vs-modal-backdrop" onClick={onClose}>
      <div 
        className={`vs-modal ${sizeClasses[size]} w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <VSCard>
          {title && (
            <VSCardHeader>
              <div className="vs-flex vs-items-center vs-justify-between">
                <h3 className="vs-text-lg vs-font-semibold">{title}</h3>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </VSCardHeader>
          )}
          <VSCardBody>
            {children}
          </VSCardBody>
        </VSCard>
      </div>
    </div>
  );
}

// ==========================================
// TEMPLATES PRONTOS POR SISTEMA
// ==========================================

// Template para Triagem
export function TriagemTemplate({ 
  children, 
  logoUrl, 
  currentView, 
  onViewChange, 
  onLogout,
  sidebarOpen,
  onSidebarToggle 
}: {
  children: React.ReactNode;
  logoUrl?: string;
  currentView?: string;
  onViewChange?: (view: string) => void;
  onLogout?: () => void;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}) {
  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: <span>📊</span> },
    { id: 'appointments', label: 'Agendamentos', icon: <span>📅</span> },
    { id: 'galleries', label: 'Galerias', icon: <span>📸</span> },
    { id: 'clients', label: 'Clientes', icon: <span>👥</span> },
    { id: 'payments', label: 'Pagamentos', icon: <span>💳</span> },
    { id: 'settings', label: 'Configurações', icon: <span>⚙️</span> },
  ].map(item => ({
    ...item,
    active: currentView === item.id,
    onClick: () => onViewChange?.(item.id)
  }));

  return (
    <VSLayout
      theme="triagem"
      hasSidebar={true}
      header={
        <VSHeader
          logo={{
            title: "Triagem",
            subtitle: "By Valdigley Santos",
            icon: "📸",
            logoUrl: logoUrl
          }}
          actions={
            <div className="vs-flex vs-gap-3">
              <VSThemeToggle />
              <a href="/agendamento" className="vs-btn vs-btn-primary">
                Novo Agendamento
              </a>
            </div>
          }
          theme="triagem"
          onMobileMenuToggle={onSidebarToggle}
        />
      }
      sidebar={
        <VSSidebar
          logo={{
            title: "Triagem",
            subtitle: "By Valdigley Santos",
            icon: "📸",
            logoUrl: logoUrl
          }}
          navigation={navigation}
          footer={
            <div className="space-y-2">
              <VSThemeToggle />
              {onLogout && (
                <VSButton 
                  variant="danger" 
                  onClick={onLogout}
                  className="w-full"
                >
                  <span>🚪</span>
                  Sair
                </VSButton>
              )}
            </div>
          }
          isOpen={sidebarOpen || false}
          onToggle={onSidebarToggle || (() => {})}
        />
      }
    >
      {children}
    </VSLayout>
  );
}

// Template para Drive
export function DriveTemplate({ children, logoUrl }: { children: React.ReactNode; logoUrl?: string }) {
  return (
    <VSLayout
      theme="drive"
      header={
        <VSHeader
          logo={{
            title: "DriVal",
            subtitle: "Gerenciamento de Fotos",
            icon: "📁",
            logoUrl: logoUrl
          }}
          actions={
            <div className="vs-flex vs-gap-3">
              <VSThemeToggle />
              <VSButton variant="primary">
                Nova Galeria
              </VSButton>
              <VSButton variant="secondary">
                Sair
              </VSButton>
            </div>
          }
          theme="drive"
        />
      }
    >
      {children}
    </VSLayout>
  );
}

// Template para Contratos
export function ContratosTemplate({ children, logoUrl }: { children: React.ReactNode; logoUrl?: string }) {
  return (
    <VSLayout
      theme="contratos"
      header={
        <VSHeader
          logo={{
            title: "Sistema de Controle Fotográfico",
            subtitle: "Bem-vindo, Valdigley Santos",
            icon: "📋",
            logoUrl: logoUrl
          }}
          actions={
            <div className="vs-flex vs-gap-3">
              <VSThemeToggle />
              <VSButton variant="success">
                Novo Contrato
              </VSButton>
              <VSButton variant="primary">
                Link para Cliente
              </VSButton>
              <VSButton variant="secondary">
                Sair
              </VSButton>
            </div>
          }
          theme="contratos"
        />
      }
    >
      {children}
    </VSLayout>
  );
}

// Template para Formatura
export function FormaturaTemplate({ children, logoUrl }: { children: React.ReactNode; logoUrl?: string }) {
  const navigation = [
    { id: 'dashboard', label: 'Dashboard', active: true },
    { id: 'formandos', label: 'Formandos' },
    { id: 'turmas', label: 'Turmas' },
    { id: 'pacotes', label: 'Pacotes' },
    { id: 'sessoes', label: 'Sessões' },
    { id: 'pagamentos', label: 'Pagamentos' },
    { id: 'relatorios', label: 'Relatórios' }
  ];

  return (
    <VSLayout
      theme="formatura"
      header={
        <VSHeader
          logo={{
            title: "Foto Formatura",
            subtitle: "Gestão de Formaturas",
            icon: "🎓",
            logoUrl: logoUrl
          }}
          navigation={navigation}
          actions={
            <div className="vs-flex vs-gap-3">
              <VSThemeToggle />
              <VSButton variant="secondary">
                Sair
              </VSButton>
            </div>
          }
          theme="formatura"
        />
      }
    >
      {children}
    </VSLayout>
  );
}

// ==========================================
// EXPORT DEFAULT
// ==========================================

export default {
  VSButton,
  VSCard,
  VSCardHeader,
  VSCardBody,
  VSCardFooter,
  VSLogo,
  VSHeader,
  VSStatCard,
  VSPageHeader,
  VSSidebar,
  VSLayout,
  VSEmptyState,
  VSStatusBadge,
  VSThemeToggle,
  VSTable,
  VSInput,
  VSModal,
  useVSTheme,
  
  // Templates prontos
  TriagemTemplate,
  DriveTemplate,
  ContratosTemplate,
  FormaturaTemplate
};