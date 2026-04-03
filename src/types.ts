export interface Task {
  id: string;
  name: string;
  type: 'shell' | 'node' | 'python';
  mode: 'code' | 'file';
  command: string;
  cron: string;
  status: 'active' | 'inactive';
  lastRun?: string;
}

export interface Log {
  id: string;
  taskId: string;
  taskName: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'success' | 'error';
  output: string;
  duration?: number;
}

export interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: string;
  ext: string;
}
