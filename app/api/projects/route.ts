import { NextRequest, NextResponse } from "next/server";
import { loadProjects, saveProjects } from "@/lib/projects";
import { getStatus, getPid, getEffectivePort } from "@/lib/processManager";
import { ProjectConfig } from "@/types/project";

export const dynamic = "force-dynamic";

export async function GET() {
  const configs = loadProjects();
  const projects = configs.map((p) => ({
    name: p.name,
    path: p.path,
    command: p.command,
    port: p.port,
    description: p.description ?? null,
    status: getStatus(p.name),
    pid: getPid(p.name) ?? null,
    effectivePort: getEffectivePort(p.name) ?? null,
  }));
  return NextResponse.json(projects);
}

function parseAndValidateBody(body: unknown): ProjectConfig | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid body" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  const projectPath = typeof b.path === "string" ? b.path.trim() : "";
  const command = typeof b.command === "string" ? b.command.trim() : "";
  const port = Number(b.port);
  const description =
    typeof b.description === "string" ? b.description.trim() : undefined;

  if (!name) return { error: '"name" is required' };
  if (!projectPath) return { error: '"path" is required' };
  if (!command) return { error: '"command" is required' };
  if (isNaN(port) || port < 1 || port > 65535)
    return { error: '"port" must be a number between 1 and 65535' };

  return { name, path: projectPath, command, port, ...(description ? { description } : {}) };
}

/** POST /api/projects — add a new project to projects.json */
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseAndValidateBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const projects = loadProjects();
  if (projects.some((p) => p.name === parsed.name)) {
    return NextResponse.json(
      { error: `A project named "${parsed.name}" already exists` },
      { status: 409 }
    );
  }

  saveProjects([...projects, parsed]);
  return NextResponse.json({ ok: true, project: parsed });
}

/** PUT /api/projects — update an existing project in projects.json */
export async function PUT(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const originalName = typeof b.originalName === "string" ? b.originalName.trim() : "";
  if (!originalName) {
    return NextResponse.json({ error: '"originalName" is required' }, { status: 400 });
  }

  const parsed = parseAndValidateBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const projects = loadProjects();
  const idx = projects.findIndex((p) => p.name === originalName);
  if (idx === -1) {
    return NextResponse.json({ error: `Project "${originalName}" not found` }, { status: 404 });
  }

  // Prevent renaming to a name that already exists (other than itself)
  if (parsed.name !== originalName && projects.some((p) => p.name === parsed.name)) {
    return NextResponse.json(
      { error: `A project named "${parsed.name}" already exists` },
      { status: 409 }
    );
  }

  const updated = [...projects];
  updated[idx] = parsed;
  saveProjects(updated);
  return NextResponse.json({ ok: true, project: parsed });
}

/** DELETE /api/projects?name=… — remove a project from projects.json */
export async function DELETE(req: NextRequest) {
  const name = new URL(req.url).searchParams.get("name")?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: '"name" query param is required' }, { status: 400 });
  }

  const projects = loadProjects();
  if (!projects.some((p) => p.name === name)) {
    return NextResponse.json({ error: `Project "${name}" not found` }, { status: 404 });
  }

  saveProjects(projects.filter((p) => p.name !== name));
  return NextResponse.json({ ok: true });
}
