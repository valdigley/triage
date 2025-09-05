import React from 'react';
import { SessionType, SessionDetails } from '../../types';
import { useSessionTypes } from '../../hooks/useSessionTypes';

interface SessionDetailsFormProps {
  sessionType: SessionType;
  details: SessionDetails;
  onChange: (details: SessionDetails) => void;
}

export function SessionDetailsForm({ sessionType, details, onChange }: SessionDetailsFormProps) {
  const { getActiveSessionTypes } = useSessionTypes();
  const activeSessionTypes = getActiveSessionTypes();
  const selectedSessionType = activeSessionTypes.find(st => st.name === sessionType);

  const handleChange = (key: keyof SessionDetails, value: string | number) => {
    onChange({ ...details, [key]: value });
  };

  const renderFields = () => {
    switch (sessionType) {
      case 'aniversario':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data do Aniversário
              </label>
              <input
                type="date"
                value={details.birthday_date || ''}
                onChange={(e) => handleChange('birthday_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'gestante':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Provável do Parto
              </label>
              <input
                type="date"
                value={details.due_date || ''}
                onChange={(e) => handleChange('due_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Bebê (se já escolhido)
              </label>
              <input
                type="text"
                value={details.baby_name || ''}
                onChange={(e) => handleChange('baby_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome do bebê"
              />
            </div>
          </div>
        );

      case 'formatura':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Curso
              </label>
              <input
                type="text"
                value={details.course || ''}
                onChange={(e) => handleChange('course', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: Administração"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cor da Faixa
              </label>
              <input
                type="text"
                value={details.sash_color || ''}
                onChange={(e) => handleChange('sash_color', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: Azul, Verde, Vermelha"
              />
            </div>
          </div>
        );

      case 'comercial':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Produto/Serviço
              </label>
              <input
                type="text"
                value={details.product_service || ''}
                onChange={(e) => handleChange('product_service', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Descreva o produto ou serviço"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Finalidade
              </label>
              <select
                value={details.purpose || ''}
                onChange={(e) => handleChange('purpose', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Selecione a finalidade</option>
                <option value="website">Website</option>
                <option value="redes_sociais">Redes Sociais</option>
                <option value="catalogo">Catálogo</option>
                <option value="marketing">Material de Marketing</option>
                <option value="outros">Outros</option>
              </select>
            </div>
          </div>
        );

      case 'pre_wedding':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data do Casamento
              </label>
              <input
                type="date"
                value={details.wedding_date || ''}
                onChange={(e) => handleChange('wedding_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estilo Desejado
              </label>
              <select
                value={details.desired_style || ''}
                onChange={(e) => handleChange('desired_style', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Selecione o estilo</option>
                <option value="classico">Clássico</option>
                <option value="romantico">Romântico</option>
                <option value="moderno">Moderno</option>
                <option value="rustico">Rústico</option>
                <option value="urbano">Urbano</option>
                <option value="natureza">Natureza</option>
              </select>
            </div>
          </div>
        );

      case 'tematico':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tema Escolhido
              </label>
              <input
                type="text"
                value={details.theme || ''}
                onChange={(e) => handleChange('theme', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: Vintage, Halloween, Natal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ocasião
              </label>
              <input
                type="text"
                value={details.occasion || ''}
                onChange={(e) => handleChange('occasion', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex: Festa de família, presente especial"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!sessionType) return null;

  return (
    <div className="mt-6 p-4 border border-gray-200 rounded-lg">
      <h3 className="font-medium text-gray-800 mb-4">
        Detalhes da Sessão - {selectedSessionType?.label || sessionType}
      </h3>
      {renderFields()}
    </div>
  );
}