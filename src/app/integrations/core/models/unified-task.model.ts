/**
 * Unified Task model representing a normalized task/issue across all task providers
 * (e.g., Jira, GitHub, Linear, Asana, Todoist, etc.)
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';

export interface UnifiedTask {
  id: string; // Unique global ID e.g. "jira:PROJ-123"
  sourceId: string; // Original ID from provider e.g. "PROJ-123"
  providerId: string; // Provider ID e.g. "jira"
  connectionId?: string; // Connection/account ID
  title: string;
  description?: string;
  status: TaskStatus;
  statusRaw?: string; // Original status name e.g. "In Code Review"
  priority: TaskPriority;
  priorityRaw?: string; // Original priority e.g. "Major"
  dueDate?: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  webUrl?: string; // Direct link to open in web browser
  assignee?: {
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  labels?: string[];
  project?: {
    id: string;
    name: string;
    key?: string;
  };
  metadata?: Record<string, unknown>; // Provider-specific custom fields
}
