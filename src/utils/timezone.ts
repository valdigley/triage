const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

export function toSaoPauloDate(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;

  const saoPauloString = d.toLocaleString('en-US', {
    timeZone: SAO_PAULO_TIMEZONE,
  });

  return new Date(saoPauloString);
}

export function toSaoPauloISO(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const year = d.toLocaleString('en-US', { timeZone: SAO_PAULO_TIMEZONE, year: 'numeric' });
  const month = d.toLocaleString('en-US', { timeZone: SAO_PAULO_TIMEZONE, month: '2-digit' });
  const day = d.toLocaleString('en-US', { timeZone: SAO_PAULO_TIMEZONE, day: '2-digit' });
  const hour = d.toLocaleString('en-US', { timeZone: SAO_PAULO_TIMEZONE, hour: '2-digit', hour12: false });
  const minute = d.toLocaleString('en-US', { timeZone: SAO_PAULO_TIMEZONE, minute: '2-digit' });
  const second = d.toLocaleString('en-US', { timeZone: SAO_PAULO_TIMEZONE, second: '2-digit' });

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function formatSaoPauloDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatSaoPauloDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatSaoPauloTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getSaoPauloOffset(): number {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const spDate = new Date(now.toLocaleString('en-US', { timeZone: SAO_PAULO_TIMEZONE }));

  return (spDate.getTime() - utcDate.getTime()) / (1000 * 60);
}

export function addHoursInSaoPaulo(date: Date | string, hours: number): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const result = new Date(d.getTime() + hours * 60 * 60 * 1000);
  return result;
}
