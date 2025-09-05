import { CommercialHours } from '../types';

export function calculatePrice(
  date: string,
  commercialHours: CommercialHours,
  priceCommercial: number,
  priceAfterHours: number
): number {
  const appointmentDate = new Date(date);
  const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const time = appointmentDate.toTimeString().slice(0, 5);

  // Map day names
  const dayMap: { [key: string]: keyof CommercialHours } = {
    sun: 'sunday',
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday'
  };

  const dayName = dayMap[dayOfWeek];
  const daySchedule = commercialHours[dayName];

  // Check if day is enabled and time is within commercial hours
  const isCommercialHour = 
    daySchedule.enabled && 
    time >= daySchedule.start && 
    time <= daySchedule.end;

  return isCommercialHour ? priceCommercial : priceAfterHours;
}

export function isDateTimeAvailable(
  date: string,
  existingAppointments: Array<{ scheduled_date: string }>,
  commercialHours: CommercialHours
): boolean {
  const appointmentDate = new Date(date);
  const now = new Date();

  // Check if date is in the future
  if (appointmentDate <= now) return false;

  // Check for conflicts: each session lasts 1h with 1h interval between sessions
  // So we need to check if there's any appointment within 2 hours (1h session + 1h interval)
  const hasConflict = existingAppointments.some(apt => {
    const existingDate = new Date(apt.scheduled_date);
    const timeDiff = Math.abs(appointmentDate.getTime() - existingDate.getTime());
    const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    return timeDiff < twoHours;
  });

  if (hasConflict) return false;

  // Check if studio is open (considering both enabled days and hours)
  const dayOfWeek = appointmentDate.getDay();
  const dayNames: (keyof CommercialHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];
  const daySchedule = commercialHours[dayName];

  // Check if day is enabled
  if (!daySchedule.enabled) return false;

  // Check if time is within commercial hours
  const appointmentTime = appointmentDate.toTimeString().slice(0, 5);
  const isWithinHours = appointmentTime >= daySchedule.start && appointmentTime <= daySchedule.end;

  return isWithinHours;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
}

export function generateGalleryToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}