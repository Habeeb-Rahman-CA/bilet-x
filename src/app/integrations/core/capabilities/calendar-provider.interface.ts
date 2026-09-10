import { UnifiedCalendarEvent } from '../models/unified-calendar.model';
import { BaseCapabilityFilter } from './capability.types';

export interface CalendarFilter extends BaseCapabilityFilter {
  startDate?: string; // ISO string
  endDate?: string; // ISO string
}

/**
 * CalendarProvider capability contract.
 * Implemented by Google Calendar, Outlook Calendar, Apple Calendar, etc.
 */
export interface CalendarProvider {
  fetchEvents(connectionId: string, filter?: CalendarFilter): Promise<UnifiedCalendarEvent[]>;
}
