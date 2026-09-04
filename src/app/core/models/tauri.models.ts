export interface SystemInfo {
  os: string;
  arch: string;
  rust_version: string;
  tauri_version: string;
  hostname: string;
  memory_info: string;
}

export interface AppStateInfo {
  counter: number;
  active_theme: string;
  uptime_seconds: number;
  total_invocations: number;
}

export interface EventPayload {
  message: string;
  timestamp: string;
  status: string;
}

export interface WindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isFocused: boolean;
  isDecorated: boolean;
}

export interface IPCLogEntry {
  id: string;
  timestamp: string;
  command: string;
  type: 'invoke' | 'event' | 'response' | 'error';
  payload?: any;
  durationMs?: number;
}
