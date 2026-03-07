"use client";

import { useState } from "react";
import { ProjectState } from "@/types/project";

interface Props {
  project: ProjectState;
  onStart: (name: string) => void;
  onStop: (name: string) => void;
  onShowLogs: (name: string) => void;
  onEdit: (name: string) => void;
  onRemove: (name: string) => void;
}

const statusConfig = {
  running: {
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-400 ring-green-500/30",
    label: "Running",
  },
  stopped: {
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-400 ring-red-500/30",
    label: "Stopped",
  },
  starting: {
    dot: "bg-yellow-400 animate-pulse",
    badge: "bg-yellow-400/10 text-yellow-300 ring-yellow-400/30",
    label: "Starting…",
  },
  error: {
    dot: "bg-red-600",
    badge: "bg-red-600/10 text-red-400 ring-red-600/30",
    label: "Error",
  },
};

export default function ProjectCard({ project, onStart, onStop, onShowLogs, onEdit, onRemove }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const cfg = statusConfig[project.status] ?? statusConfig.stopped;
  const isRunning = project.status === "running" || project.status === "starting";

  function handleOpen() {
    // Use effectivePort when a conflict forced the process onto a different port
    const openPort = project.effectivePort ?? project.port;
    window.open(`http://localhost:${openPort}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/8">
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-white">{project.name}</h2>
          {project.description && (
            <p className="mt-0.5 truncate text-xs text-slate-400">{project.description}</p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cfg.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {/* Meta info */}
      <div className="mb-5 flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-3A2.25 2.25 0 008.25 5.25V9m-3 0h13.5M5.25 9v10.5A2.25 2.25 0 007.5 21.75h9a2.25 2.25 0 002.25-2.25V9" />
          </svg>
          port <span className="font-mono text-slate-300">{project.port}</span>
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="font-mono text-slate-300 truncate max-w-[160px]">{project.command}</span>
        </span>
        {project.pid && (
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
            </svg>
            pid <span className="font-mono text-slate-300">{project.pid}</span>
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {!isRunning ? (
          <button
            onClick={() => onStart(project.name)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-500 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start
          </button>
        ) : (
          <button
            onClick={() => onStop(project.name)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
            Stop
          </button>
        )}

        <button
          onClick={() => onShowLogs(project.name)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-600 active:scale-95"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          Logs
        </button>

        {isRunning && (
          <button
            onClick={handleOpen}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open
          </button>
        )}
      </div>

      {/* Edit / Remove row */}
      <div className="mt-3 flex items-center justify-end gap-1 border-t border-white/5 pt-3">
        {confirmRemove ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Remove?</span>
            <button
              onClick={() => onRemove(project.name)}
              className="rounded bg-red-600/80 px-2 py-0.5 text-xs text-white hover:bg-red-500"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onEdit(project.name)}
              title="Edit project"
              className="rounded p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
            </button>
            <button
              onClick={() => setConfirmRemove(true)}
              title="Remove project"
              className="rounded p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
