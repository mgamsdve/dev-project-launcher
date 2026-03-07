import { NextRequest, NextResponse } from "next/server";
import { getProjectByName } from "@/lib/projects";
import { getLogs, subscribeToLogs } from "@/lib/processManager";

export const dynamic = "force-dynamic";

/**
 * GET /api/logs?name=<project>
 *
 * For regular requests: returns current log buffer as JSON.
 * For SSE requests (Accept: text/event-stream): streams new log lines in real time.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ error: 'Query param "name" is required' }, { status: 400 });
  }

  // Security: only allow names defined in projects.json
  const project = getProjectByName(name);
  if (!project) {
    return NextResponse.json({ error: `Project "${name}" not found in projects.json` }, { status: 404 });
  }

  const acceptHeader = req.headers.get("accept") ?? "";
  if (!acceptHeader.includes("text/event-stream")) {
    // Plain JSON snapshot
    return NextResponse.json({ logs: getLogs(name) });
  }

  // Server-Sent Events stream
  const existingLogs = getLogs(name);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function sendLine(line: string) {
        const data = `data: ${JSON.stringify(line)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Client disconnected
        }
      }

      // Replay existing logs immediately
      existingLogs.forEach(sendLine);

      // Subscribe to future log lines
      const unsubscribe = subscribeToLogs(name, sendLine);

      // Send a heartbeat every 15 seconds to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15_000);

      // Clean up when the client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
