import { UnifiedTask, TaskStatus } from '../models/unified-task.model';
import { BaseCapabilityFilter } from './capability.types';

export interface TaskFilter extends BaseCapabilityFilter {
  status?: TaskStatus[];
  assignedToMe?: boolean;
  projectId?: string;
}

/**
 * Full detail for a single task — used to power a detail view. Providers
 * that don't ship extended metadata can just echo back the base fields.
 */
export interface UnifiedTaskDetail {
  task: UnifiedTask;
  /** Plain-text description body (ADF, Markdown, HTML flattened to text). */
  descriptionText: string;
  /** Reporter/author, if the provider exposes one. */
  reporter?: { name: string; email?: string; avatarUrl?: string };
}

/**
 * A workflow transition available on the current task, as reported by the
 * provider. `id` is the provider-native identifier passed back to
 * transitionTask; `label` is safe to render in the UI.
 */
export interface TaskTransition {
  id: string;
  label: string;
  /** Normalized target status if the provider tells us. */
  toStatus?: TaskStatus;
  /** Provider-native status name for display. */
  toStatusRaw?: string;
}

/**
 * TaskProvider capability contract.
 * Implemented by Jira, GitHub, Linear, Asana, etc.
 */
export interface TaskProvider {
  /**
   * Fetch normalized tasks from the provider.
   */
  fetchTasks(connectionId: string, filter?: TaskFilter): Promise<UnifiedTask[]>;

  /**
   * Optional: update task status on the remote provider.
   */
  updateTaskStatus?(connectionId: string, taskId: string, status: TaskStatus): Promise<UnifiedTask>;

  /**
   * Optional: create a new task on the remote provider.
   */
  createTask?(connectionId: string, task: Partial<UnifiedTask>): Promise<UnifiedTask>;

  /**
   * Optional: load extended detail (description, reporter, etc.) for a task.
   */
  fetchTaskDetail?(connectionId: string, taskId: string): Promise<UnifiedTaskDetail>;

  /**
   * Optional: list the workflow transitions the current user can apply.
   */
  fetchTransitions?(connectionId: string, taskId: string): Promise<TaskTransition[]>;

  /**
   * Optional: apply one of the transitions returned by fetchTransitions.
   */
  transitionTask?(connectionId: string, taskId: string, transitionId: string): Promise<void>;
}
