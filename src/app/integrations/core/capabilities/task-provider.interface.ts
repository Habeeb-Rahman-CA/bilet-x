import { UnifiedTask, TaskStatus } from '../models/unified-task.model';
import { BaseCapabilityFilter } from './capability.types';

export interface TaskFilter extends BaseCapabilityFilter {
  status?: TaskStatus[];
  assignedToMe?: boolean;
  projectId?: string;
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
}
