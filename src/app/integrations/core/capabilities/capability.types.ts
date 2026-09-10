/**
 * Core capability identifiers supported by integrations.
 * Integrations declare only the capabilities they implement.
 */
export type CapabilityType = 'tasks' | 'messages' | 'calendar' | 'notifications' | 'files';

export type IntegrationCategory = 'communication' | 'tasks' | 'calendar' | 'developer' | 'productivity';

export interface BaseCapabilityFilter {
  limit?: number;
  offset?: number;
  query?: string;
}

export interface CapabilityMetadata {
  type: CapabilityType;
  displayName: string;
  description: string;
  icon: string;
}

export const CAPABILITY_METADATA: Record<CapabilityType, CapabilityMetadata> = {
  tasks: {
    type: 'tasks',
    displayName: 'Tasks & Tickets',
    description: 'Sync and manage issues, tasks, and action items',
    icon: 'check-square',
  },
  messages: {
    type: 'messages',
    displayName: 'Messages & Mail',
    description: 'Read and monitor inbox messages, emails, and threads',
    icon: 'mail',
  },
  calendar: {
    type: 'calendar',
    displayName: 'Calendar & Schedule',
    description: 'View upcoming events, meetings, and schedule',
    icon: 'calendar',
  },
  notifications: {
    type: 'notifications',
    displayName: 'Notifications & Alerts',
    description: 'Receive real-time alerts and activity updates',
    icon: 'bell',
  },
  files: {
    type: 'files',
    displayName: 'Files & Storage',
    description: 'Access cloud files and attachments',
    icon: 'folder',
  },
};
