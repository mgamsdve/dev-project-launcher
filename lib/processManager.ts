/**
 * processManager.ts
 *
 * In-memory manager for child processes spawned for each project.
 * Only commands defined in projects.json are ever executed here —
 * no user-supplied commands are accepted (see lib/projects.ts).
 *
 * TODO: docker container support — track containers via docker SDK
 * TODO: CPU / RAM monitoring — use pidusage or systeminformation
 * TODO: auto project detection — scan common directories for package.json / Cargo.toml etc.
 * TODO: terminal emulator — attach a pty via node-pty for interactive sessions
 * TODO: project groups — group related services and start/stop together
 * TODO: environment switching — support .env.development, .env.production etc.
 */

import { spawn, ChildProcess } from "child_process";
import net from "net";
import { loadProjects, saveProjects } from "@/lib/projects";
import { ProjectConfig, ProjectStatus, RunningProcess } from "@/types/project";

const MAX_LOG_LINES = 500;

// Map from project name → running process metadata
const processes = new Map<string, RunningProcess>();

// Map from project name → SSE subscriber callbacks
const logSubscribers = new Map<string, Set<(line: string) => void>>();

function getOrCreateSubscriberSet(name: string): Set<(line: string) => void> {
  if (!logSubscribers.has(name)) {
    logSubscribers.set(name, new Set());
  }
  return logSubscribers.get(name)!;
}

function broadcast(name: string, line: string) {
  const subs = logSubscribers.get(name);
  if (subs) {
    subs.forEach((cb) => cb(line));
  }
}

function appendLog(name: string, line: string) {
  const proc = processes.get(name);
  if (proc) {
    proc.logs.push(line);
    if (proc.logs.length > MAX_LOG_LINES) {
      proc.logs.splice(0, proc.logs.length - MAX_LOG_LINES);
    }
  }
  broadcast(name, line);
}

/**
 * Returns true if nothing is listening on `port` on localhost.
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Starting from `startPort`, returns the first TCP port not currently in use.
 */
async function findFreePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortFree(port))) {
    port++;
    if (port > 65535) throw new Error("No free port found above " + startPort);
  }
  return port;
}

export async function startProject(project: ProjectConfig): Promise<{ ok: boolean; message: string }> {
  if (processes.has(project.name)) {
    const existing = processes.get(project.name)!;
    if (existing.status === "running" || existing.status === "starting") {
      return { ok: false, message: `Project "${project.name}" is already running.` };
    }
  }

  // Split the pre-validated command from projects.json into program + args.
  // The command comes exclusively from the config file — never from user input.
  const parts = project.command.split(/\s+/);
  const program = parts[0];
  const args = parts.slice(1);

  // Find the first free port starting from the configured port.
  // If another project is already occupying the same port, the next one gets
  // an incremented port and projects.json is updated so "Open" always works.
  let effectivePort: number;
  try {
    effectivePort = await findFreePort(project.port);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }

  if (effectivePort !== project.port) {
    appendLog(
      project.name,
      `[launcher] Port ${project.port} is in use — using ${effectivePort} instead`
    );
    // Persist the new port so the "Open" button and the UI reflect reality.
    try {
      const projects = loadProjects();
      const updated = projects.map((p) =>
        p.name === project.name ? { ...p, port: effectivePort } : p
      );
      saveProjects(updated);
    } catch {
      // Non-fatal: best effort
    }
  }

  let child: ChildProcess;
  try {
    child = spawn(program, args, {
      cwd: project.path,
      shell: false, // avoid shell injection; command is from trusted config only
      // Inject PORT so frameworks like Next.js, Vite, etc. pick up the configured port
      // without requiring the user to hardcode it in the command string.
      env: { ...process.env, PORT: String(effectivePort) },
      detached: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Failed to spawn process: ${msg}` };
  }

  const entry: RunningProcess = {
    process: child,
    pid: child.pid ?? 0,
    status: "starting",
    effectivePort,
    logs: [],
  };

  processes.set(project.name, entry);
  appendLog(project.name, `[launcher] Starting "${project.name}" on port ${effectivePort} (pid ${child.pid ?? "?"})`);

  child.stdout?.setEncoding("utf-8");
  child.stderr?.setEncoding("utf-8");

  child.stdout?.on("data", (data: string) => {
    const lines = data.split("\n").filter((l) => l.trim() !== "");
    lines.forEach((line) => appendLog(project.name, line));

    const proc = processes.get(project.name);
    if (proc && proc.status === "starting") {
      proc.status = "running";
    }
  });

  child.stderr?.on("data", (data: string) => {
    const lines = data.split("\n").filter((l) => l.trim() !== "");
    lines.forEach((line) => appendLog(project.name, `[stderr] ${line}`));

    const proc = processes.get(project.name);
    if (proc && proc.status === "starting") {
      proc.status = "running";
    }
  });

  child.on("error", (err) => {
    appendLog(project.name, `[launcher] Process error: ${err.message}`);
    const proc = processes.get(project.name);
    if (proc) proc.status = "error";
  });

  child.on("exit", (code, signal) => {
    appendLog(
      project.name,
      `[launcher] Process exited (code=${code ?? "?"}, signal=${signal ?? "none"})`
    );
    const proc = processes.get(project.name);
    if (proc) proc.status = "stopped";
  });

  // Promote from "starting" to "running" after a short grace period if no output yet
  setTimeout(() => {
    const proc = processes.get(project.name);
    if (proc && proc.status === "starting") {
      proc.status = "running";
    }
  }, 3000);

  return { ok: true, message: `Project "${project.name}" started.` };
}

export function stopProject(name: string): { ok: boolean; message: string } {
  const entry = processes.get(name);
  if (!entry) {
    return { ok: false, message: `Project "${name}" is not running.` };
  }

  try {
    // Kill the process group so child processes also receive the signal
    if (entry.pid && entry.pid > 0) {
      process.kill(-entry.pid, "SIGTERM");
    } else {
      entry.process.kill("SIGTERM");
    }
  } catch {
    // If process group kill fails (e.g. not a group leader), fall back to direct kill
    try {
      entry.process.kill("SIGTERM");
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2);
      return { ok: false, message: `Failed to stop process: ${msg}` };
    }
  }

  entry.status = "stopped";
  appendLog(name, `[launcher] Sent SIGTERM to "${name}"`);
  processes.delete(name);
  return { ok: true, message: `Project "${name}" stopped.` };
}

export function getStatus(name: string): ProjectStatus {
  return processes.get(name)?.status ?? "stopped";
}

export function getLogs(name: string): string[] {
  return processes.get(name)?.logs ?? [];
}

export function getPid(name: string): number | undefined {
  return processes.get(name)?.pid;
}

export function getEffectivePort(name: string): number | undefined {
  return processes.get(name)?.effectivePort;
}

/**
 * Subscribe to real-time log lines for a project.
 * Returns an unsubscribe function.
 */
export function subscribeToLogs(
  name: string,
  callback: (line: string) => void
): () => void {
  const subs = getOrCreateSubscriberSet(name);
  subs.add(callback);
  return () => {
    subs.delete(callback);
    if (subs.size === 0) {
      logSubscribers.delete(name);
    }
  };
}
