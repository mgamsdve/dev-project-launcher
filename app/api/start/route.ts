import { NextRequest, NextResponse } from "next/server";
import { getProjectByName } from "@/lib/projects";
import { startProject } from "@/lib/processManager";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).name !== "string"
  ) {
    return NextResponse.json({ error: 'Body must include a "name" string field' }, { status: 400 });
  }

  const name = ((body as Record<string, unknown>).name as string).trim();

  // Security: only allow projects explicitly defined in projects.json
  const project = getProjectByName(name);
  if (!project) {
    return NextResponse.json({ error: `Project "${name}" not found in projects.json` }, { status: 404 });
  }

  const result = await startProject(project);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
