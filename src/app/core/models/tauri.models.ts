export interface IPCLogEntry {
  id: string;
  timestamp: string;
  command: string;
  type: 'invoke' | 'event' | 'response' | 'error';
  payload?: any;
  durationMs?: number;
}
