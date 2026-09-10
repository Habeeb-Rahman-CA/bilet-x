import { BaseCapabilityFilter } from './capability.types';

export interface UnifiedFile {
  id: string;
  providerId: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  webUrl?: string;
  updatedAt: string;
}

export interface FileFilter extends BaseCapabilityFilter {
  folderId?: string;
}

/**
 * FileProvider capability contract.
 * Implemented by Google Drive, OneDrive, Dropbox, etc.
 */
export interface FileProvider {
  fetchFiles(connectionId: string, filter?: FileFilter): Promise<UnifiedFile[]>;
}
