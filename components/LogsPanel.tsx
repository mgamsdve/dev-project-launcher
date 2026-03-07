"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  projectName: string | null;
  onClose: () => void;
}

export default function LogsPanel({ projectName, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const connect = useCallback((name: string) => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setLines([]);
    setConnected(false);

    const es = new EventSource(`/api/logs?name=${encodeURIComponent(name)}`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const line: string = JSON.parse(e.data);
        setLines((prev) => {
          const next = [...prev, line];
          // Keep at most 500 lines in state
          return next.length > 500 ? next.slice(next.length - 500) : next;
        });
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setConnected(false);
    };
  }, []);

  useEffect(() => {
    if (!projectName) {
      setLines([]);
      setConnected(false);
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    connect(projectName);

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [projectName, connect]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoScroll]);

  function handleClear() {
    setLines([]);
  }

  if (!projectName) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative flex w-full max-w-4xl flex-col rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
           style={{ maxHeight: "80vh" }}>
        {/* Title bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-sm font-semibold text-white">{projectName} — Logs</span>
            <span className="text-xs text-slate-500">{connected ? "live" : "disconnected"}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-blue-500"
              />
              Auto-scroll
            </label>
            <button
              onClick={handleClear}
              className="rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close logs panel"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Log output */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-xs leading-5 text-green-300">
          {lines.length === 0 ? (
            <span className="italic text-slate-500">No log output yet…</span>
          ) : (
            lines.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("[stderr]")
                    ? "text-red-400"
                    : line.startsWith("[launcher]")
                    ? "text-slate-400"
                    : "text-green-300"
                }
              >
                {line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/10 px-4 py-2 text-right text-xs text-slate-500">
          {lines.length} line{lines.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
