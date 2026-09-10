/**
 * Unified Calendar Event model for calendar providers (e.g. Google Calendar, Outlook Calendar)
 */
export interface UnifiedCalendarEvent {
  id: string;
  sourceId: string;
  providerId: string;
  connectionId?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  isAllDay: boolean;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  organizer?: {
    name: string;
    email: string;
  };
  attendeesCount?: number;
  meetUrl?: string;
  webUrl?: string;
  metadata?: Record<string, unknown>;
}
