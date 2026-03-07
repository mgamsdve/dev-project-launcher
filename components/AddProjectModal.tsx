"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProjectConfig } from "@/types/project";

interface BrowseEntry {
  name: string;
  path: string;
  projectType: string | null;
  detectedCommand: string | null;
  detectedPort: number | null;
}

interface BrowseResult {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
  selfProjectType: string | null;
  selfDetectedCommand: string | null;
  selfDetectedPort: number | null;
}

interface Props {
  mode: "add" | "edit";
  initialProject?: ProjectConfig;
  onClose: () => void;
  onSave: () => void;
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  node: { label: "Node.js", cls: "bg-green-500/20 text-green-300" },
  rust: { label: "Rust", cls: "bg-orange-500/20 text-orange-300" },
  python: { label: "Python", cls: "bg-blue-500/20 text-blue-300" },
  dotnet: { label: ".NET", cls: "bg-purple-500/20 text-purple-300" },
};

export default function AddProjectModal({ mode, initialProject, onClose, onSave }: Props) {
  // ── Browser state ────────────────────────────────────────────
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState("");
  const pathInputRef = useRef<HTMLInputElement>(null);

  // ── Form state ───────────────────────────────────────────────
  const [name, setName] = useState(initialProject?.name ?? "");
  const [projectPath, setProjectPath] = useState(initialProject?.path ?? "");
  const [command, setCommand] = useState(initialProject?.command ?? "");
  const [port, setPort] = useState(String(initialProject?.port ?? "3000"));
  const [description, setDescription] = useState(initialProject?.description ?? "");

  // tracks whether the user has manually edited the name field
  const nameTouchedRef = useRef(!!initialProject?.name);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Browse ───────────────────────────────────────────────────
  const browse = useCallback(async (p: string) => {
    setBrowseLoading(true);
    setBrowseError(null);
    setPathInput(p);
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Browse failed");
      setBrowseResult(data as BrowseResult);
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : "Browse failed");
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "add") browse("");
  }, [mode, browse]);

  // When the user navigates into a new directory, auto-fill the form
  // from that directory's detected project info, unless user has manually typed.
  function selectDir(p: string, detectedCommand: string | null, dirName: string, detectedPort: number | null) {
    setProjectPath(p);
    if (detectedCommand) setCommand(detectedCommand);
    if (detectedPort) setPort(String(detectedPort));
    if (!nameTouchedRef.current) setName(dirName);
  }

  function handleSelectCurrent() {
    if (!browseResult) return;
    const dirName = browseResult.path.split("/").filter(Boolean).pop() ?? "";
    selectDir(browseResult.path, browseResult.selfDetectedCommand, dirName, browseResult.selfDetectedPort);
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const body =
        mode === "edit"
          ? {
              originalName: initialProject!.name,
              name: name.trim(),
              path: projectPath.trim(),
              command: command.trim(),
              port: parseInt(port, 10),
              description: description.trim() || undefined,
            }
          : {
              name: name.trim(),
              path: projectPath.trim(),
              command: command.trim(),
              port: parseInt(port, 10),
              description: description.trim() || undefined,
            };

      const res = await fetch("/api/projects", {
        method: mode === "add" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSave();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    name.trim() !== "" &&
    projectPath.trim() !== "" &&
    command.trim() !== "" &&
    parseInt(port, 10) >= 1 &&
    parseInt(port, 10) <= 65535 &&
    !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="relative flex w-full max-w-4xl flex-col rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
        style={{ maxHeight: "88vh" }}
      >
        {/* ── Title bar ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">
            {mode === "add" ? "Add project" : `Edit — ${initialProject?.name}`}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* ── Left: filesystem browser (add mode only) ── */}
          {mode === "add" && (
            <div className="flex w-72 shrink-0 flex-col border-r border-white/10">
              {/* Path input / breadcrumb */}
              <div className="shrink-0 border-b border-white/10 px-3 py-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    browse(pathInput);
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    ref={pathInputRef}
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    className="min-w-0 flex-1 rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Path…"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                  >
                    Go
                  </button>
                </form>
              </div>

              {/* Entries list */}
              <div className="flex-1 overflow-y-auto p-2">
                {browseLoading && (
                  <div className="flex justify-center py-8">
                    <svg className="h-5 w-5 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                  </div>
                )}

                {browseError && (
                  <p className="px-2 py-2 text-xs text-red-400">{browseError}</p>
                )}

                {!browseLoading && browseResult && (
                  <ul className="space-y-0.5">
                    {/* Parent */}
                    {browseResult.parent && (
                      <li>
                        <button
                          onClick={() => browse(browseResult.parent!)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                          <span>Parent</span>
                        </button>
                      </li>
                    )}

                    {/* Subdirectories */}
                    {browseResult.entries.map((entry) => (
                      <li key={entry.path}>
                        <div
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition ${
                            projectPath === entry.path
                              ? "bg-blue-600/25 text-white"
                              : "text-slate-300 hover:bg-white/5"
                          }`}
                        >
                          {/* Folder / navigate */}
                          <button
                            onClick={() => browse(entry.path)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                            title="Navigate into"
                          >
                            <svg
                              className={`h-3.5 w-3.5 shrink-0 ${entry.projectType ? "text-yellow-400" : "text-slate-500"}`}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                            </svg>
                            <span className="truncate">{entry.name}</span>
                          </button>

                          {/* Badge + Select */}
                          {entry.projectType && TYPE_BADGE[entry.projectType] && (
                            <button
                              onClick={() =>
                                selectDir(entry.path, entry.detectedCommand, entry.name, entry.detectedPort)
                              }
                              title="Select as project root"
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition hover:ring-1 hover:ring-white/30 ${TYPE_BADGE[entry.projectType].cls}`}
                            >
                              {TYPE_BADGE[entry.projectType].label}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}

                    {browseResult.entries.length === 0 && (
                      <li className="px-2 py-4 text-center text-xs italic text-slate-500">
                        No subdirectories
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* "Use current directory" */}
              <div className="shrink-0 border-t border-white/10 p-2">
                <button
                  onClick={handleSelectCurrent}
                  disabled={!browseResult}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-600 disabled:opacity-40"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Select current directory
                  {browseResult?.selfProjectType && TYPE_BADGE[browseResult.selfProjectType] && (
                    <span className={`rounded px-1 text-[10px] ${TYPE_BADGE[browseResult.selfProjectType].cls}`}>
                      {TYPE_BADGE[browseResult.selfProjectType].label}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Right: form ── */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-4">
              {/* Path */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Path
                </label>
                {mode === "add" ? (
                  <div
                    className={`rounded-lg border px-3 py-2 font-mono text-xs ${
                      projectPath
                        ? "border-white/10 bg-slate-800 text-slate-200"
                        : "border-white/5 bg-slate-800/40 italic text-slate-500"
                    }`}
                  >
                    {projectPath || "Select a directory from the browser →"}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={projectPath}
                    onChange={(e) => setProjectPath(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Display name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    nameTouchedRef.current = true;
                    setName(e.target.value);
                  }}
                  placeholder="My API Server"
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Command */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Start command <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npm run dev"
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Auto-detected from project type. Saved to projects.json.
                </p>
              </div>

              {/* Port */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Port <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  min={1}
                  max={65535}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 font-mono text-xs text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional short description"
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {saveError && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {saveError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-xs text-slate-400 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "add" ? "Add project" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
