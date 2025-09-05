import React, { useState } from 'react';
import { Lock, Eye } from 'lucide-react';
import { useGalleryAccess } from '../../hooks/useGalleryAccess';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { LoadingSpinner } from '../UI/LoadingSpinner';

interface GalleryAccessProps {
  galleryId: string;
  onAccessGranted: () => void;
}

export function GalleryAccess({ galleryId, onAccessGranted }: GalleryAccessProps) {
  const { accessGranted, needsPassword, loading, verifyPassword } = useGalleryAccess(galleryId);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (accessGranted) {
      onAccessGranted();
    }
  }, [accessGranted, onAccessGranted]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password.trim()) {
      setError('Digite a senha');
      return;
    }

    if (verifyPassword(password)) {
      onAccessGranted();
    } else {
      setError('Senha incorreta');
      setPassword('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">Carregando galeria...</p>
        </div>
      </div>
    );
  }

  if (!needsPassword) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acesso Restrito</h1>
          <p className="text-gray-600 dark:text-gray-400">Esta galeria é protegida por senha</p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite a senha da galeria"
            error={error}
            icon={<Lock />}
            autoFocus
          />

          <Button type="submit" className="w-full">
            <Eye size={20} className="mr-2" />
            Acessar Galeria
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Se você não possui a senha, entre em contato com o fotógrafo
          </p>
        </div>
      </div>
    </div>
  );
}