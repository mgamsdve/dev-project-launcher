import path from "path";
import fs from "fs";
import { ProjectConfig } from "@/types/project";

const PROJECTS_FILE = path.join(process.cwd(), "projects.json");

export function loadProjects(): ProjectConfig[] {
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("projects.json must be a JSON array");
    }

    return parsed.map((p, i) => {
      if (typeof p.name !== "string" || !p.name.trim()) {
        throw new Error(`Project at index ${i} is missing a valid "name"`);
      }
      if (typeof p.path !== "string" || !p.path.trim()) {
        throw new Error(`Project "${p.name}" is missing a valid "path"`);
      }
      if (typeof p.command !== "string" || !p.command.trim()) {
        throw new Error(`Project "${p.name}" is missing a valid "command"`);
      }
      if (typeof p.port !== "number" || p.port < 1 || p.port > 65535) {
        throw new Error(`Project "${p.name}" has an invalid "port"`);
      }
      return {
        name: p.name.trim(),
        path: p.path.trim(),
        command: p.command.trim(),
        port: p.port,
        description: typeof p.description === "string" ? p.description.trim() : undefined,
      } satisfies ProjectConfig;
    });
  } catch (err) {
    console.error("[projects] Failed to load projects.json:", err);
    return [];
  }
}

export function saveProjects(projects: ProjectConfig[]): void {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2) + "\n", "utf-8");
}

/**
 * Returns a single validated project config by name.
 * Returns null if the name is not found in projects.json, preventing
 * execution of arbitrary commands not defined in the config (security).
 */
export function getProjectByName(name: string): ProjectConfig | null {
  const projects = loadProjects();
  return projects.find((p) => p.name === name) ?? null;
}
