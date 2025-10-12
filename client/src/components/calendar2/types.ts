export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  category?: string;
  location?: string;
  description?: string;
}

export interface TimeSlot {
  hour: number;
  minute: number;
}

export interface DragState {
  eventId: string;
  startY: number;
  initialStartTime: Date;
  initialEndTime: Date;
  type: 'move' | 'resize-top' | 'resize-bottom';
}
