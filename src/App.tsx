import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useSessionVerification } from './hooks/useSessionVerification';
import { ThemeProvider } from './contexts/ThemeContext';
import { BookingForm } from './components/Booking/BookingForm';
import { AdminDashboard } from './components/Dashboard/AdminDashboard';
import { ClientGallery } from './components/Gallery/ClientGallery';
import { LoginForm } from './components/Auth/LoginForm';
import { SessionRedirect } from './components/Auth/SessionRedirect';

function App() {
  const { 
    isVerifying, 
    isAuthenticated: sessionAuthenticated, 
    invalidateSession 
  } = useSessionVerification();
  
  const [supabaseAuthenticated, setSupabaseAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão do Supabase
    const checkSupabaseAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSupabaseAuthenticated(!!session);
      } catch (error) {
        console.warn('Falha na verificação de sessão Supabase:', error);
        setSupabaseAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkSupabaseAuth();

    // Escutar mudanças de autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSupabaseAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Aguardar verificação de sessão compartilhada
  useEffect(() => {
    if (!isVerifying) {
      setLoading(false);
    }
  }, [isVerifying]);

  const handleLogin = () => {
    setSupabaseAuthenticated(true);
  };

  const handleLogout = async () => {
    // Invalidar sessão compartilhada
    await invalidateSession();
    
    // Logout do Supabase
    await supabase.auth.signOut();
    setSupabaseAuthenticated(false);
  };

  // Determinar se está autenticado (sessão compartilhada OU Supabase)
  const isAuthenticated = sessionAuthenticated || supabaseAuthenticated;

  if (loading || isVerifying) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {isVerifying ? 'Verificando sessão...' : 'Carregando...'}
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
              <AdminDashboard onLogout={handleLogout} />
            ) : (
              sessionAuthenticated === false && supabaseAuthenticated === false ? (
                <SessionRedirect />
              ) : (
                <LoginForm onLogin={handleLogin} />
              )
            )
          } 
        />
        <Route path="/agendamento" element={<BookingForm />} />
        <Route path="/gallery/:token" element={<ClientGallery />} />
        
        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </ThemeProvider>
  );
}

export default App;