// ==========================================
// COMPONENTES REACT - SISTEMA DE DESIGN
// ==========================================
// Componentes React padronizados para todos os projetos
// Copie este arquivo e adapte conforme necessário

import React from 'react';

// ==========================================
// INTERFACES E TIPOS
// ==========================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  onClose?: () => void;
}

interface BadgeProps {
  variant: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'neutral';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  help?: string;
  icon?: React.ReactNode;
}

// ==========================================
// COMPONENTE: BUTTON
// ==========================================

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  icon, 
  children, 
  className = '', 
  disabled,
  ...props 
}: ButtonProps) {
  const baseClasses = 'btn';
  const variantClasses = `btn-${variant}`;
  const sizeClasses = size !== 'md' ? `btn-${size}` : '';
  const loadingClasses = loading ? 'loading' : '';
  
  const classes = [baseClasses, variantClasses, sizeClasses, loadingClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button 
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="loading-spinner" />}
      {!loading && icon && icon}
      {children}
    </button>
  );
}

// ==========================================
// COMPONENTE: CARD
// ==========================================

export function Card({ children, className = '', hover = true }: CardProps) {
  const classes = ['card', hover ? 'hover-lift' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-header ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-body ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-footer ${className}`}>
      {children}
    </div>
  );
}

// ==========================================
// COMPONENTE: ALERT
// ==========================================

export function Alert({ type, children, onClose }: AlertProps) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div className={`alert alert-${type}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-lg">{icons[type]}</span>
          <div className="flex-1">{children}</div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-current opacity-70 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: BADGE
// ==========================================

export function Badge({ variant, children, size = 'md' }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : '';
  
  return (
    <span className={`badge badge-${variant} ${sizeClasses}`}>
      {children}
    </span>
  );
}

// ==========================================
// COMPONENTE: MODAL
// ==========================================

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  const sizeStyles = {
    sm: { width: '400px' },
    md: { width: '600px' },
    lg: { width: '800px' },
    xl: { width: '1000px' }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal" 
        style={sizeStyles[size]}
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          {title && (
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="heading-4">{title}</h3>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
          )}
          <CardBody>
            {children}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: INPUT
// ==========================================

export function Input({ 
  label, 
  error, 
  help, 
  icon, 
  className = '', 
  ...props 
}: InputProps) {
  const inputClasses = ['input', error ? 'input-error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-3 text-gray-400">
            {icon}
          </div>
        )}
        <input 
          className={`${inputClasses} ${icon ? 'pl-10' : ''}`}
          {...props}
        />
      </div>
      
      {error && (
        <div className="form-error">{error}</div>
      )}
      
      {help && !error && (
        <div className="form-help">{help}</div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: LOADING SPINNER
// ==========================================

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  return (
    <div className={`loading-spinner ${sizeClasses[size]}`} />
  );
}

// ==========================================
// COMPONENTE: CONTAINER
// ==========================================

export function Container({ 
  children, 
  size = 'lg',
  className = '' 
}: { 
  children: React.ReactNode; 
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeClass = size !== 'lg' ? `container-${size}` : '';
  const classes = ['container', sizeClass, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

// ==========================================
// COMPONENTE: GRID
// ==========================================

export function Grid({ 
  children, 
  cols = 1,
  gap = 6,
  className = '' 
}: { 
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5;
  gap?: 2 | 3 | 4 | 6 | 8;
  className?: string;
}) {
  const classes = [`grid`, `grid-cols-${cols}`, `gap-${gap}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {children}
    </div>
  );
}

// ==========================================
// COMPONENTE: SIDEBAR LAYOUT
// ==========================================

export function SidebarLayout({ 
  sidebar, 
  children 
}: { 
  sidebar: React.ReactNode; 
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sidebar">
        {sidebar}
      </div>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

// ==========================================
// COMPONENTE: PAGE HEADER
// ==========================================

export function PageHeader({ 
  title, 
  subtitle, 
  actions 
}: { 
  title: string; 
  subtitle?: string; 
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
      <div>
        <h1 className="heading-1">{title}</h1>
        {subtitle && <p className="text-small">{subtitle}</p>}
      </div>
      {actions && (
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          {actions}
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: EMPTY STATE
// ==========================================

export function EmptyState({ 
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
    <div className="text-center py-12">
      <div className="text-gray-400 mb-4 flex justify-center">
        {icon}
      </div>
      <h3 className="heading-4 text-gray-600 dark:text-gray-400">{title}</h3>
      {description && (
        <p className="text-small mt-2">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: STATUS BADGE
// ==========================================

export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    pending: { variant: 'warning', label: 'Pendente' },
    confirmed: { variant: 'success', label: 'Confirmado' },
    completed: { variant: 'info', label: 'Concluído' },
    cancelled: { variant: 'error', label: 'Cancelado' },
    approved: { variant: 'success', label: 'Aprovado' },
    rejected: { variant: 'error', label: 'Rejeitado' }
  };

  const config = statusConfig[status] || { variant: 'neutral', label: status };

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}

// ==========================================
// HOOK: THEME
// ==========================================

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return JSON.parse(saved);
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
      
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
// EXEMPLOS DE USO
// ==========================================

// Exemplo de página de login
export function LoginPageExample() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="heading-2 text-center">Login</h1>
          <p className="text-small text-center">Acesse sua conta</p>
        </CardHeader>
        
        <CardBody>
          <form className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              icon={<span>📧</span>}
            />
            
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              icon={<span>🔒</span>}
            />
            
            <Button 
              type="submit" 
              variant="primary" 
              loading={loading}
              className="w-full"
            >
              Entrar
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// Exemplo de dashboard
export function DashboardExample() {
  const stats = [
    { title: 'Clientes', value: '150', icon: '👥', variant: 'success' as const },
    { title: 'Sessões', value: '45', icon: '📸', variant: 'primary' as const },
    { title: 'Faturamento', value: 'R$ 15.000', icon: '💰', variant: 'info' as const },
    { title: 'Pendências', value: '3', icon: '⏰', variant: 'warning' as const }
  ];

  return (
    <Container>
      <PageHeader 
        title="Dashboard"
        subtitle="Visão geral do sistema"
        actions={
          <Button variant="primary" icon={<span>➕</span>}>
            Novo Agendamento
          </Button>
        }
      />
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.title}</div>
                </div>
                <div className="stat-icon" style={{ backgroundColor: `var(--${stat.variant}-100)` }}>
                  <span style={{ color: `var(--${stat.variant}-600)` }}>
                    {stat.icon}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="heading-4">Sessões Recentes</h3>
          </CardHeader>
          <CardBody>
            <EmptyState
              icon={<span className="text-4xl">📸</span>}
              title="Nenhuma sessão encontrada"
              description="Quando você tiver sessões, elas aparecerão aqui"
              action={
                <Button variant="primary">
                  Nova Sessão
                </Button>
              }
            />
          </CardBody>
        </Card>
        
        <Card>
          <CardHeader>
            <h3 className="heading-4">Atividade Recente</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-body">Novo cliente cadastrado</span>
                <Badge variant="success">Hoje</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body">Pagamento aprovado</span>
                <Badge variant="info">Ontem</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body">Galeria criada</span>
                <Badge variant="neutral">2 dias</Badge>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </Container>
  );
}

// ==========================================
// COMPONENTE: MODAL
// ==========================================

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
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

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg', 
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className={`modal ${sizeStyles[size]} w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          {title && (
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="heading-4">{title}</h3>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </CardHeader>
          )}
          <CardBody>
            {children}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: INPUT
// ==========================================

export function Input({ 
  label, 
  error, 
  help, 
  icon, 
  className = '', 
  ...props 
}: InputProps) {
  const inputClasses = ['input', error ? 'input-error' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-3 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
        <input 
          className={`${inputClasses} ${icon ? 'pl-10' : ''}`}
          {...props}
        />
      </div>
      
      {error && (
        <div className="form-error">{error}</div>
      )}
      
      {help && !error && (
        <div className="form-help">{help}</div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: TABLE
// ==========================================

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export function Table({ headers, children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`table ${className}`}>
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
// COMPONENTE: PROGRESS BAR
// ==========================================

export function ProgressBar({ 
  value, 
  max = 100, 
  className = '' 
}: { 
  value: number; 
  max?: number; 
  className?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={`progress ${className}`}>
      <div 
        className="progress-bar"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// ==========================================
// COMPONENTE: SKELETON
// ==========================================

export function Skeleton({ 
  width = '100%', 
  height = '1rem',
  className = '' 
}: { 
  width?: string; 
  height?: string;
  className?: string;
}) {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  );
}

// ==========================================
// EXPORT DEFAULT
// ==========================================

export default {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Alert,
  Badge,
  Modal,
  Input,
  LoadingSpinner,
  Container,
  Grid,
  SidebarLayout,
  PageHeader,
  EmptyState,
  StatusBadge,
  Table,
  ProgressBar,
  Skeleton,
  useTheme
};