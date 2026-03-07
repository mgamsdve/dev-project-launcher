export type ProjectStatus = "stopped" | "starting" | "running" | "error";

export interface ProjectConfig {
  name: string;
  path: string;
  command: string;
  port: number;
  description?: string;
}

export interface ProjectState {
  name: string;
  path: string;
  command: string;
  port: number;
  description?: string;
  status: ProjectStatus;
  pid?: number;
  effectivePort?: number;
  logs: string[];
}

export interface RunningProcess {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process: any;
  pid: number;
  status: ProjectStatus;
  effectivePort: number;
  logs: string[];
}
