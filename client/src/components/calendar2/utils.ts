import { TimeSlot } from './types';

// Constants
export const PIXELS_PER_HOUR = 60;
export const MINUTES_PER_SLOT = 15;
export const SLOTS_PER_HOUR = 60 / MINUTES_PER_SLOT;
export const PIXELS_PER_SLOT = PIXELS_PER_HOUR / SLOTS_PER_HOUR;

// Convert pixel offset to time
export function pixelsToMinutes(pixels: number): number {
  return Math.round((pixels / PIXELS_PER_HOUR) * 60);
}

// Convert time to pixel offset
export function minutesToPixels(minutes: number): number {
  return (minutes / 60) * PIXELS_PER_HOUR;
}

// Snap to 15-minute intervals
export function snapToSlot(minutes: number): number {
  return Math.round(minutes / MINUTES_PER_SLOT) * MINUTES_PER_SLOT;
}

// Get time from date
export function getTimeInMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// Create date with specific time
export function setTimeInMinutes(date: Date, minutes: number): Date {
  const newDate = new Date(date);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  newDate.setHours(hours, mins, 0, 0);
  return newDate;
}

// Format time for display
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Format hour for grid
export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

// Get duration in minutes
export function getDuration(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60);
}

// Clamp minutes to valid range (0-1440)
export function clampMinutes(minutes: number): number {
  return Math.max(0, Math.min(1440, minutes));
}
