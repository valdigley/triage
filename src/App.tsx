import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { ThemeProvider } from './contexts/ThemeContext';
import { Sidebar } from './components/Layout/Sidebar';
import { BookingForm } from './components/Booking/BookingForm';
import { DashboardOverview } from './components/Dashboard/DashboardOverview';
import { AppointmentsView } from './components/Dashboard/AppointmentsView';
import { GalleriesView } from './components/Dashboard/GalleriesView';
import { ClientsView } from './components/Dashboard/ClientsView';
import { PaymentsView } from './components/Dashboard/PaymentsView';
import { SettingsView } from './components/Dashboard/SettingsView';
import { ClientGallery } from './components/Gallery/ClientGallery';
import { LoginForm } from './components/Auth/LoginForm';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.warn('Falha na verificação de sessão:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      // Check if there's an active session before attempting logout
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      // Always set authenticated to false regardless of logout success
      setIsAuthenticated(false);
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'appointments':
        return <AppointmentsView />;
      case 'galleries':
        return <GalleriesView />;
      case 'clients':
        return <ClientsView />;
      case 'payments':
        return <PaymentsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardOverview />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
                  <Sidebar
                    currentView={currentView}
                    onViewChange={setCurrentView}
                    onLogout={handleLogout}
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(!sidebarOpen)}
                  />
                  
                  {/* Mobile overlay */}
                  {sidebarOpen && (
                    <div 
                      className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                      onClick={() => setSidebarOpen(false)}
                    />
                  )}
                  
                  <main className="flex-1 overflow-y-auto">
                    <div className="p-4 sm:p-6 lg:p-8">
                      {renderCurrentView()}
                    </div>
                  </main>
                </div>
              ) : (
                <LoginForm onLogin={handleLogin} />
              )
            } 
          />
          <Route path="/agendamento" element={<BookingForm />} />
          <Route path="/gallery/:token" element={<ClientGallery />} />
          <Route path="/g/:token" element={<ClientGallery />} />

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;