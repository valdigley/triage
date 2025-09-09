// ==========================================
// COMPONENTES REACT UNIFICADOS - VALDIGLEY SANTOS
// ==========================================
// Componentes padronizados para todos os sistemas

import React from 'react';

// ==========================================
// INTERFACES
// ==========================================

interface VSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'purple' | 'success' | 'danger' | 'secondary';
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
}

interface VSStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

interface VSPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
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
  const classes = ['vs-card', hover ? 'vs-hover-lift' : '', className]
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

// ==========================================
// COMPONENTE: VS LOGO UNIFICADA
// ==========================================

export function VSLogo({ title, subtitle, icon, logoUrl, size = 'md' }: VSLogoProps) {
  const sizeClasses = {
    sm: { icon: 'w-8 h-8', title: 'text-lg', subtitle: 'text-xs' },
    md: { icon: 'w-10 h-10', title: 'text-xl', subtitle: 'text-sm' },
    lg: { icon: 'w-12 h-12', title: 'text-2xl', subtitle: 'text-base' }
  };

  const sizes = sizeClasses[size];

  return (
    <div className="vs-logo">
      <div className={`vs-logo-icon ${sizes.icon}`}>
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt={title}
            className="w-full h-full object-contain rounded"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.parentElement?.querySelector('.fallback-icon');
              if (fallback) {
                (fallback as HTMLElement).style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div className="fallback-icon w-full h-full flex items-center justify-center" style={{ display: logoUrl ? 'none' : 'flex' }}>
          {icon || '📸'}
        </div>
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

export function VSHeader({ logo, navigation, actions, theme = 'triagem' }: VSHeaderProps) {
  return (
    <header className={`vs-header vs-theme-${theme}`}>
      <div className="vs-header-content">
        <VSLogo {...logo} />
        
        {navigation && navigation.length > 0 && (
          <nav className="vs-nav">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`vs-nav-item ${item.active ? 'active' : ''}`}
              >
                {item.icon}
                <span className="hidden md:inline">{item.label}</span>
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

export function VSStatCard({ title, value, icon, trend, color = 'blue' }: VSStatCardProps) {
  const colorClasses = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    red: 'text-red-500'
  };

  return (
    <div className="vs-stat-card">
      <div className="vs-stat-content">
        <div className="vs-stat-info">
          <h3>{title}</h3>
          <div className="vs-stat-value">{value}</div>
          {trend && (
            <div className={`text-sm mt-2 ${colorClasses[color]}`}>
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
    <div className="vs-page-header">
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

export function VSSidebar({ logo, navigation, footer, isOpen, onToggle }: VSSidebarProps) {
  return (
    <div className={`vs-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="vs-sidebar-header">
        <VSLogo {...logo} size="lg" />
      </div>
      
      <nav className="vs-sidebar-nav">
        <ul>
          {navigation.map((item) => (
            <li key={item.id}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  item.onClick?.();
                  onToggle(); // Close on mobile
                }}
                className={item.active ? 'active' : ''}
              >
                {item.icon}
                <span>{item.label}</span>
              </a>
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
  );
}

// ==========================================
// COMPONENTE: VS LAYOUT PRINCIPAL
// ==========================================

interface VSLayoutProps {
  header: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  theme?: 'triagem' | 'drive' | 'contratos' | 'formatura';
}

export function VSLayout({ header, sidebar, children, theme = 'triagem' }: VSLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className={`vs-app vs-theme-${theme}`}>
      {header}
      
      <div className="vs-flex vs-h-full">
        {sidebar && (
          <>
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            
            {/* Sidebar */}
            <div className={`vs-sidebar ${sidebarOpen ? 'open' : ''}`}>
              {sidebar}
            </div>
          </>
        )}
        
        <main className={`vs-main ${sidebar ? 'with-sidebar' : ''}`}>
          <div className="vs-content">
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
    <div className="vs-empty-state">
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
    inactive: { variant: 'neutral', label: 'Inativo' }
  };

  const config = statusConfig[status] || { variant: 'neutral', label: status };

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
    <VSButton
      variant="secondary"
      size="sm"
      onClick={toggleDarkMode}
      icon={isDarkMode ? '☀️' : '🌙'}
      title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
    >
      <span className="hidden md:inline">
        {isDarkMode ? 'Claro' : 'Escuro'}
      </span>
    </VSButton>
  );
}

// ==========================================
// COMPONENTE: VS MOBILE MENU BUTTON
// ==========================================

export function VSMobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="vs-btn vs-btn-secondary vs-btn-sm lg:hidden"
      aria-label="Abrir menu"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

// ==========================================
// TEMPLATES PRONTOS POR SISTEMA
// ==========================================

// Template para Triagem
export function TriagemLayout({ children }: { children: React.ReactNode }) {
  return (
    <VSLayout
      theme="triagem"
      header={
        <VSHeader
          logo={{
            title: "Triagem",
            subtitle: "By Valdigley Santos",
            icon: "📸"
          }}
          actions={
            <div className="vs-flex vs-gap-3">
              <VSThemeToggle />
              <VSButton variant="purple" size="sm">
                Novo Agendamento
              </VSButton>
            </div>
          }
        />
      }
    >
      {children}
    </VSLayout>
  );
}

// Template para Drive
export function DriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <VSLayout
      theme="drive"
      header={
        <VSHeader
          logo={{
            title: "DriVal",
            subtitle: "Gerenciamento de Fotos",
            icon: "📁"
          }}
          actions={
            <div className="vs-flex vs-gap-3">
              <VSThemeToggle />
              <VSButton variant="primary" size="sm">
                Nova Galeria
              </VSButton>
              <VSButton variant="secondary" size="sm">
                Sair
              </VSButton>
            </div>
          }
        />
      }
    >
      {children}
    </VSLayout>
  );
}

// Template para Contratos
export function ContratosLayout({ children }: { children: React.ReactNode }) {
  return (
    <VSLayout
      theme="contratos"
      header={
        <VSHeader
          logo={{
            title: "Sistema de Controle Fotográfico",
            subtitle: "Bem-vindo, Valdigley Santos",
            icon: "📋"
          }}
          actions={
            <div className="vs-flex vs-gap-3">
              <VSThemeToggle />
              <VSButton variant="success" size="sm">
                Novo Contrato
              </VSButton>
              <VSButton variant="primary" size="sm">
                Link para Cliente
              </VSButton>
            </div>
          }
        />
      }
    >
      {children}
    </VSLayout>
  );
}

// Template para Formatura
export function FormaturaLayout({ children }: { children: React.ReactNode }) {
  return (
    <VSLayout
      theme="formatura"
      header={
        <VSHeader
          logo={{
            title: "Foto Formatura",
            subtitle: "Gestão de Formaturas",
            icon: "🎓"
          }}
          navigation={[
            { id: 'dashboard', label: 'Dashboard', active: true },
            { id: 'formandos', label: 'Formandos' },
            { id: 'turmas', label: 'Turmas' },
            { id: 'pacotes', label: 'Pacotes' },
            { id: 'sessoes', label: 'Sessões' },
            { id: 'pagamentos', label: 'Pagamentos' },
            { id: 'relatorios', label: 'Relatórios' }
          ]}
          actions={
            <div className="vs-flex vs-gap-3">
              <VSThemeToggle />
              <VSButton variant="secondary" size="sm">
                Sair
              </VSButton>
            </div>
          }
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
  VSLogo,
  VSHeader,
  VSStatCard,
  VSPageHeader,
  VSSidebar,
  VSLayout,
  VSEmptyState,
  VSStatusBadge,
  VSThemeToggle,
  VSMobileMenuButton,
  useVSTheme,
  
  // Templates prontos
  TriagemLayout,
  DriveLayout,
  ContratosLayout,
  FormaturaLayout
};