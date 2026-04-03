import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Play, 
  Trash2, 
  Edit2, 
  Clock, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Search, 
  RefreshCw,
  MoreVertical,
  Settings,
  FileText,
  LayoutDashboard,
  Code2,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Task {
  id: string;
  name: string;
  type: 'shell' | 'node' | 'python';
  mode: 'code' | 'file';
  command: string;
  cron: string;
  status: 'active' | 'inactive';
  lastRun?: string;
}

interface Log {
  id: string;
  taskId: string;
  taskName: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'success' | 'error';
  output: string;
  duration?: number;
}

const TaskTypeBadge = ({ type }: { type: Task['type'] }) => {
  const colors = {
    shell: 'bg-blue-100 text-blue-700 border-blue-200',
    node: 'bg-green-100 text-green-700 border-green-200',
    python: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', colors[type])}>
      {type.toUpperCase()}
    </span>
  );
};

const StatusBadge = ({ status }: { status: Log['status'] | Task['status'] }) => {
  const colors = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    inactive: 'bg-gray-100 text-gray-700 border-gray-200',
    running: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    error: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 w-fit', colors[status as keyof typeof colors])}>
      {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === 'success' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'error' && <XCircle className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pathSuggestions, setPathSuggestions] = useState<{ name: string, path: string, isDir: boolean }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchPathSuggestions = useCallback(async (path: string) => {
    if (!path) {
      setPathSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/fs/ls?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setPathSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch (e) {
      setPathSuggestions([]);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch logs', e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchTasks(), fetchLogs()]);
      setIsLoading(false);
    };
    init();

    const interval = setInterval(() => {
      fetchTasks();
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchLogs]);

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    const method = editingTask.id ? 'PUT' : 'POST';
    const url = editingTask.id ? `/api/tasks/${editingTask.id}` : '/api/tasks';

    try {
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTask),
      });
      setIsModalOpen(false);
      setEditingTask(null);
      fetchTasks();
    } catch (e) {
      console.error('Failed to save task', e);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch (e) {
      console.error('Failed to delete task', e);
    }
  };

  const handleRunTask = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}/run`, { method: 'POST' });
      fetchLogs();
    } catch (e) {
      console.error('Failed to run task', e);
    }
  };

  const filteredTasks = tasks.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <p className="text-gray-500 font-medium">Loading Task Manager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 text-emerald-600 mb-8">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl text-gray-900">Task Scheduler</h1>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === 'dashboard' 
                  ? "bg-emerald-50 text-emerald-700" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === 'logs' 
                  ? "bg-emerald-50 text-emerald-700" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <FileText className="w-4 h-4" />
              Execution Logs
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-700">Scheduler Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks or commands..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-0 rounded-lg text-sm transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setEditingTask({ type: 'shell', mode: 'code', status: 'active', cron: '0 * * * *' });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm shadow-emerald-200"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-1">Total Tasks</p>
                  <p className="text-3xl font-bold text-gray-900">{tasks.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-1">Active Now</p>
                  <p className="text-3xl font-bold text-emerald-600">{tasks.filter(t => t.status === 'active').length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-1">Last 24h Runs</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {logs.filter(l => new Date(l.startTime).getTime() > Date.now() - 86400000).length}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Task Name</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Run</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="w-8 h-8 text-gray-300" />
                            <p>No tasks found matching your search.</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{task.name}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <TaskTypeBadge type={task.type} />
                              <code className="text-xs text-gray-400 font-mono truncate max-w-[200px]">{task.command}</code>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="font-mono">{task.cron}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-500">
                            {task.lastRun ? formatDistanceToNow(new Date(task.lastRun), { addSuffix: true }) : 'Never'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleRunTask(task.id)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Run Now"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingTask(task);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Execution History</h2>
                <button 
                  onClick={async () => {
                    if (confirm('Clear all logs?')) {
                      await fetch('/api/logs', { method: 'DELETE' });
                      fetchLogs();
                    }
                  }}
                  className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear History
                </button>
              </div>

              <div className="space-y-4">
                {logs.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p>No execution logs yet. Run a task to see history.</p>
                  </div>
                ) : logs.map((log) => (
                  <div key={log.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-4">
                        <StatusBadge status={log.status} />
                        <div>
                          <span className="font-bold text-gray-900">{log.taskName}</span>
                          <span className="text-xs text-gray-500 ml-3">
                            {format(new Date(log.startTime), 'MMM d, HH:mm:ss')}
                            {log.duration && ` • ${log.duration}ms`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-900">
                      <pre className="text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-40 break-all">
                        {log.output || 'No output recorded.'}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {editingTask?.id ? 'Edit Task' : 'Create New Task'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Task Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Daily Database Backup"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  value={editingTask?.name || ''}
                  onChange={(e) => setEditingTask(prev => ({ ...prev!, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Task Type</label>
                  <select
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    value={editingTask?.type || 'shell'}
                    onChange={(e) => setEditingTask(prev => ({ ...prev!, type: e.target.value as Task['type'] }))}
                  >
                    <option value="shell">Shell Script</option>
                    <option value="node">Node.js</option>
                    <option value="python">Python</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Execution Mode</label>
                  <select
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                    value={editingTask?.mode || 'code'}
                    onChange={(e) => setEditingTask(prev => ({ ...prev!, mode: e.target.value as Task['mode'] }))}
                  >
                    <option value="code">Write Code</option>
                    <option value="file">Execute File</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Schedule (Cron)</label>
                <input
                  required
                  type="text"
                  placeholder="* * * * *"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  value={editingTask?.cron || ''}
                  onChange={(e) => setEditingTask(prev => ({ ...prev!, cron: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {editingTask?.mode === 'code' ? 'Command / Code' : 'File Path'}
                </label>
                <div className="relative">
                  {editingTask?.mode === 'code' ? (
                    <textarea
                      required
                      rows={4}
                      placeholder={editingTask?.type === 'shell' ? 'ls -la' : 'console.log("Hello World");'}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"
                      value={editingTask?.command || ''}
                      onChange={(e) => setEditingTask(prev => ({ ...prev!, command: e.target.value }))}
                    />
                  ) : (
                    <div className="relative">
                      <input
                        required
                        type="text"
                        placeholder={editingTask?.type === 'shell' ? '/path/to/script.sh' : '/path/to/script.js'}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        value={editingTask?.command || ''}
                        autoComplete="off"
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingTask(prev => ({ ...prev!, command: val }));
                          fetchPathSuggestions(val);
                        }}
                        onFocus={() => editingTask?.command && fetchPathSuggestions(editingTask.command)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      />
                      {showSuggestions && pathSuggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-2">
                          {pathSuggestions.map((s, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                              onClick={() => {
                                const newPath = s.isDir ? (s.path.endsWith('/') ? s.path : s.path + '/') : s.path;
                                setEditingTask(prev => ({ ...prev!, command: newPath }));
                                if (s.isDir) {
                                  fetchPathSuggestions(newPath);
                                } else {
                                  setShowSuggestions(false);
                                }
                              }}
                            >
                              {s.isDir ? <Plus className="w-3 h-3 text-emerald-500" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                              <span className="text-sm font-mono text-gray-700">{s.path}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="status"
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  checked={editingTask?.status === 'active'}
                  onChange={(e) => setEditingTask(prev => ({ ...prev!, status: e.target.checked ? 'active' : 'inactive' }))}
                />
                <label htmlFor="status" className="text-sm font-medium text-gray-700">Enabled</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  {editingTask?.id ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
