import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

type ProjectType = "node" | "rust" | "python" | "dotnet" | null;

function detectProjectType(dirPath: string): ProjectType {
  try {
    if (fs.existsSync(path.join(dirPath, "package.json"))) return "node";
    if (fs.existsSync(path.join(dirPath, "Cargo.toml"))) return "rust";
    if (
      fs.existsSync(path.join(dirPath, "requirements.txt")) ||
      fs.existsSync(path.join(dirPath, "pyproject.toml")) ||
      fs.existsSync(path.join(dirPath, "setup.py"))
    )
      return "python";
    const files = fs.readdirSync(dirPath);
    if (files.some((f) => f.endsWith(".csproj") || f.endsWith(".sln")))
      return "dotnet";
  } catch {
    // permission denied or similar — ignore
  }
  return null;
}

/**
 * Attempts to read the configured port from:
 *  1. .env / .env.local / .env.development (PORT=xxx)
 *  2. Framework-specific config files (vite.config.*, angular.json, etc.)
 *  3. package.json scripts / known framework keys
 *  4. Falls back to well-known framework defaults
 */
function detectPort(dirPath: string, type: ProjectType): number {
  // ── 1. Try .env files ──────────────────────────────────────────────────────
  const envFiles = [".env.local", ".env.development", ".env"];
  for (const envFile of envFiles) {
    try {
      const content = fs.readFileSync(path.join(dirPath, envFile), "utf-8");
      const match = content.match(/^\s*PORT\s*=\s*(\d+)/m);
      if (match) return parseInt(match[1], 10);
    } catch {
      // file may not exist
    }
  }

  if (type === "node") {
    // ── 2. Vite config (vite.config.ts/js/mjs/cjs) ──────────────────────────
    const viteConfigs = [
      "vite.config.ts",
      "vite.config.js",
      "vite.config.mjs",
      "vite.config.cjs",
    ];
    for (const cfg of viteConfigs) {
      try {
        const content = fs.readFileSync(path.join(dirPath, cfg), "utf-8");
        // server: { port: XXXX } — match across lines without the /s flag
        const match = content.match(/server\s*:\s*\{[\s\S]*?port\s*:\s*(\d+)/);
        if (match) return parseInt(match[1], 10);
        // if vite config exists but no explicit port → default 5173
        return 5173;
      } catch {
        // not a vite project
      }
    }

    // ── 3. package.json heuristics ───────────────────────────────────────────
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(dirPath, "package.json"), "utf-8")
      );

      // Explicit port key (some setups)
      if (typeof pkg.port === "number") return pkg.port;

      const deps = {
        ...((pkg.dependencies as Record<string, string>) ?? {}),
        ...((pkg.devDependencies as Record<string, string>) ?? {}),
      };

      // Vite via dependency (no config file found above)
      if (deps["vite"]) return 5173;

      // Nuxt
      if (deps["nuxt"] || deps["nuxt3"]) return 3000;

      // SvelteKit
      if (deps["@sveltejs/kit"]) return 5173;

      // Remix
      if (deps["@remix-run/node"] || deps["@remix-run/react"]) return 3000;

      // Astro
      if (deps["astro"]) return 4321;

      // Vue CLI
      if (deps["@vue/cli-service"]) return 8080;

      // Angular CLI
      if (deps["@angular/cli"]) return 4200;

      // Create React App
      if (deps["react-scripts"]) return 3000;

      // Gatsby
      if (deps["gatsby"]) return 8000;

      // Next.js
      if (deps["next"]) return 3000;

      // Express / Fastify / Hapi etc. — generic Node API
      if (
        deps["express"] ||
        deps["fastify"] ||
        deps["hapi"] ||
        deps["@hapi/hapi"] ||
        deps["koa"] ||
        deps["hono"]
      )
        return 3000;
    } catch {
      // malformed package.json
    }

    // ── 4. angular.json ──────────────────────────────────────────────────────
    try {
      const angularJson = JSON.parse(
        fs.readFileSync(path.join(dirPath, "angular.json"), "utf-8")
      );
      // Look for serve options port
      const projects = angularJson?.projects as Record<string, unknown>;
      if (projects) {
        for (const proj of Object.values(projects)) {
          const p = proj as Record<string, unknown>;
          const architect = p?.architect as Record<string, unknown> | undefined;
          const serve = architect?.serve as Record<string, unknown> | undefined;
          const options = serve?.options as Record<string, unknown> | undefined;
          const servePort = options?.port as number | undefined;
          if (servePort) return servePort;
        }
      }
    } catch {
      // not angular
    }

    return 3000; // generic Node fallback
  }

  if (type === "python") {
    // Django default
    if (fs.existsSync(path.join(dirPath, "manage.py"))) return 8000;
    // FastAPI / uvicorn convention
    try {
      const content = fs.readFileSync(
        path.join(dirPath, "requirements.txt"),
        "utf-8"
      );
      if (/fastapi|uvicorn/i.test(content)) return 8000;
      if (/flask/i.test(content)) return 5000;
    } catch {
      // no requirements.txt
    }
    try {
      const content = fs.readFileSync(
        path.join(dirPath, "pyproject.toml"),
        "utf-8"
      );
      if (/fastapi|uvicorn/i.test(content)) return 8000;
      if (/flask/i.test(content)) return 5000;
    } catch {
      // no pyproject.toml
    }
    return 8000; // Python generic fallback
  }

  if (type === "rust") return 8080;

  if (type === "dotnet") {
    // Try to read launchSettings.json
    const candidates = [
      path.join(dirPath, "Properties", "launchSettings.json"),
      // search one level down for any Properties/launchSettings.json
    ];
    for (const candidate of candidates) {
      try {
        const settings = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        const profiles = settings?.profiles as Record<
          string,
          { applicationUrl?: string }
        >;
        if (profiles) {
          for (const profile of Object.values(profiles)) {
            const url = profile.applicationUrl ?? "";
            // https://localhost:7001;http://localhost:5000
            const match = url.match(/http:\/\/localhost:(\d+)/);
            if (match) return parseInt(match[1], 10);
          }
        }
      } catch {
        // file not found or malformed
      }
    }
    return 5000; // .NET default
  }

  return 3000;
}

function detectCommand(dirPath: string, type: ProjectType): string {
  if (type === "node") {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(dirPath, "package.json"), "utf-8")
      );
      if (pkg.scripts?.dev) return "pnpm run dev";
      if (pkg.scripts?.start) return "pnpm start";
    } catch {
      // malformed package.json
    }
    return "pnpm run dev";
  }
  if (type === "rust") return "cargo run";
  if (type === "python") {
    if (fs.existsSync(path.join(dirPath, "manage.py")))
      return "python manage.py runserver";
    if (fs.existsSync(path.join(dirPath, "main.py"))) return "python main.py";
    if (fs.existsSync(path.join(dirPath, "app.py"))) return "python app.py";
    return "python main.py";
  }
  if (type === "dotnet") return "dotnet run";
  return "";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawPath = searchParams.get("path");

  // Default to home dir if no path provided
  const resolved = path.resolve(rawPath ?? os.homedir());

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const rawEntries = fs.readdirSync(resolved, { withFileTypes: true });

    const entries = rawEntries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          e.name !== "node_modules" &&
          e.name !== "target" &&
          e.name !== ".git"
      )
      .map((e) => {
        const fullPath = path.join(resolved, e.name);
        const projectType = detectProjectType(fullPath);
        return {
          name: e.name,
          path: fullPath,
          projectType,
          detectedCommand: projectType ? detectCommand(fullPath, projectType) : null,
          detectedPort: projectType ? detectPort(fullPath, projectType) : null,
        };
      })
      .sort((a, b) => {
        // Project roots first, then alphabetically
        if (a.projectType && !b.projectType) return -1;
        if (!a.projectType && b.projectType) return 1;
        return a.name.localeCompare(b.name);
      });

    const parent = path.dirname(resolved);
    const selfType = detectProjectType(resolved);

    return NextResponse.json({
      path: resolved,
      parent: parent !== resolved ? parent : null,
      entries,
      selfProjectType: selfType,
      selfDetectedCommand: selfType ? detectCommand(resolved, selfType) : null,
      selfDetectedPort: selfType ? detectPort(resolved, selfType) : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
