"use client";

interface Props {
  runningCount: number;
  totalCount: number;
  onRefresh: () => void;
}

export default function Header({ runningCount, totalCount, onRefresh }: Props) {
  return (
    <header className="border-b border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">Dev Project Launcher</h1>
            <p className="text-xs text-slate-400">Local developer dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="hidden items-center gap-4 sm:flex">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>
                <span className="font-semibold text-green-400">{runningCount}</span> running
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <span>
                <span className="font-semibold text-slate-300">{totalCount}</span> total
              </span>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            title="Refresh project statuses"
            className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:bg-white/5 hover:text-white active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
