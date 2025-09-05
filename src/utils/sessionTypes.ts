import { SessionType } from '../types';

export const sessionTypeLabels: Record<SessionType, string> = {
  aniversario: 'Aniversário',
  gestante: 'Gestante',
  formatura: 'Formatura',
  comercial: 'Comercial',
  pre_wedding: 'Pré-wedding',
  tematico: 'Temático'
};

export const sessionTypeDescriptions: Record<SessionType, string> = {
  aniversario: 'Celebração de aniversário com cenário personalizado',
  gestante: 'Ensaio especial para gravidez e maternidade',
  formatura: 'Registro do momento da formatura acadêmica',
  comercial: 'Fotos para produtos, serviços ou marketing',
  pre_wedding: 'Ensaio romântico antes do casamento',
  tematico: 'Sessão com tema específico personalizado'
};

export function getSessionIcon(type: SessionType): string {
  const icons: Record<SessionType, string> = {
    aniversario: '🎂',
    gestante: '🤱',
    formatura: '🎓',
    comercial: '💼',
    pre_wedding: '💑',
    tematico: '🎨'
  };
  return icons[type];
}