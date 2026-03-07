"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import LogsPanel from "@/components/LogsPanel";
import AddProjectModal from "@/components/AddProjectModal";
import { ProjectConfig, ProjectState } from "@/types/project";

const POLL_INTERVAL_MS = 4_000;

export default function Home() {
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLogsProject, setActiveLogsProject] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectConfig | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ProjectState[] = await res.json();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    pollRef.current = setInterval(fetchProjects, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchProjects]);

  async function handleStart(name: string) {
    setProjects((prev) =>
      prev.map((p) => (p.name === name ? { ...p, status: "starting" } : p))
    );
    try {
      await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      console.error("[start] fetch error:", err);
    }
    setTimeout(fetchProjects, 800);
  }

  async function handleStop(name: string) {
    setProjects((prev) =>
      prev.map((p) => (p.name === name ? { ...p, status: "stopped", pid: undefined } : p))
    );
    try {
      await fetch("/api/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      console.error("[stop] fetch error:", err);
    }
    setTimeout(fetchProjects, 800);
  }

  async function handleRemove(name: string) {
    try {
      await fetch(`/api/projects?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("[remove] fetch error:", err);
    }
    fetchProjects();
  }

  function handleEdit(name: string) {
    const project = projects.find((p) => p.name === name);
    if (!project) return;
    setEditingProject({
      name: project.name,
      path: project.path,
      command: project.command,
      port: project.port,
      description: project.description ?? undefined,
    });
  }

  function handleModalSave() {
    setShowAddModal(false);
    setEditingProject(null);
    fetchProjects();
  }

  const runningCount = projects.filter(
    (p) => p.status === "running" || p.status === "starting"
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header
        runningCount={runningCount}
        totalCount={projects.length}
        onRefresh={fetchProjects}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              <span className="text-sm">Loading projects…</span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-400">Error: {error}</p>
            <button
              onClick={fetchProjects}
              className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-500"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                {projects.length} project{projects.length !== 1 ? "s" : ""} configured
                {runningCount > 0 && (
                  <span className="ml-2 text-green-400">· {runningCount} running</span>
                )}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 active:scale-95"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
                <p className="text-slate-400">
                  No projects yet. Click{" "}
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
                  >
                    Add project
                  </button>{" "}
                  to get started.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.name}
                    project={project}
                    onStart={handleStart}
                    onStop={handleStop}
                    onShowLogs={setActiveLogsProject}
                    onEdit={handleEdit}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Real-time logs drawer */}
      <LogsPanel
        projectName={activeLogsProject}
        onClose={() => setActiveLogsProject(null)}
      />

      {/* Add project modal */}
      {showAddModal && (
        <AddProjectModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSave={handleModalSave}
        />
      )}

      {/* Edit project modal */}
      {editingProject && (
        <AddProjectModal
          mode="edit"
          initialProject={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
