import React from 'react';
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
  AlertCircle,
  FileCode
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Task, Log } from '../types';
import { cn } from '../lib/utils';

interface DashboardProps {
  tasks: Task[];
  logs: Log[];
  searchQuery: string;
  handleRunTask: (id: string) => void;
  handleDeleteTask: (id: string) => void;
  setEditingTask: (task: Partial<Task>) => void;
  setIsModalOpen: (open: boolean) => void;
  handleReadFile: (path: string) => void;
  setActiveTab: (tab: any) => void;
}

const TaskTypeBadge = ({ type }: { type: Task['type'] }) => {
  const colors = {
    shell: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    node: 'bg-green-500/10 text-green-400 border-green-500/20',
    python: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider', colors[type])}>
      {type}
    </span>
  );
};

const StatusBadge = ({ status }: { status: Log['status'] | Task['status'] }) => {
  const colors = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit uppercase tracking-wider', colors[status as keyof typeof colors])}>
      {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === 'success' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'error' && <XCircle className="w-3 h-3" />}
      {status}
    </span>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ 
  tasks, 
  logs, 
  searchQuery, 
  handleRunTask, 
  handleDeleteTask, 
  setEditingTask, 
  setIsModalOpen,
  handleReadFile,
  setActiveTab
}) => {
  const filteredTasks = tasks.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Tasks</p>
          <p className="text-4xl font-black text-gray-900">{tasks.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Active Now</p>
          <p className="text-4xl font-black text-emerald-600">{tasks.filter(t => t.status === 'active').length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Last 24h Runs</p>
          <p className="text-4xl font-black text-blue-600">
            {logs.filter(l => new Date(l.startTime).getTime() > Date.now() - 86400000).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Scheduled Tasks</h3>
          <button 
            onClick={() => {
              setEditingTask({ type: 'shell', mode: 'code', status: 'active', cron: '0 * * * *' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Task Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Schedule</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Run</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-gray-200" />
                      <p className="text-sm italic">No tasks found matching your search.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{task.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <TaskTypeBadge type={task.type} />
                        <code className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">{task.command}</code>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-3.5 h-3.5 text-gray-300" />
                      <span className="font-mono text-xs">{task.cron}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-400">
                      {task.lastRun ? formatDistanceToNow(new Date(task.lastRun), { addSuffix: true }) : 'Never'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {task.mode === 'file' && (
                        <button 
                          onClick={() => {
                            handleReadFile(task.command);
                            setActiveTab('editor');
                          }}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Open in Editor"
                        >
                          <FileCode className="w-4 h-4" />
                        </button>
                      )}
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
    </div>
  );
};
