import React from 'react';
import { X, Terminal, Clock, AlertCircle } from 'lucide-react';
import { Task } from '../types';

interface TaskModalProps {
  editingTask: Partial<Task> | null;
  setEditingTask: (task: any) => void;
  setIsModalOpen: (open: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  editingTask,
  setEditingTask,
  setIsModalOpen,
  handleSubmit
}) => {
  if (!editingTask) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Terminal className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              {editingTask.id ? 'Edit Task' : 'Create New Task'}
            </h2>
          </div>
          <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Task Name</label>
              <input
                required
                type="text"
                placeholder="e.g., Daily Database Backup"
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium"
                value={editingTask.name || ''}
                onChange={(e) => setEditingTask((prev: any) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Type</label>
              <select
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium appearance-none"
                value={editingTask.type}
                onChange={(e) => setEditingTask((prev: any) => ({ ...prev, type: e.target.value }))}
              >
                <option value="shell">Shell Script</option>
                <option value="node">Node.js</option>
                <option value="python">Python</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Mode</label>
              <select
                className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-medium appearance-none"
                value={editingTask.mode}
                onChange={(e) => setEditingTask((prev: any) => ({ ...prev, mode: e.target.value }))}
              >
                <option value="code">Inline Code</option>
                <option value="file">File Path</option>
              </select>
            </div>

            <div className="col-span-2 space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                {editingTask.mode === 'code' ? 'Script Content' : 'Absolute File Path'}
              </label>
              {editingTask.mode === 'code' ? (
                <textarea
                  required
                  rows={4}
                  className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-mono text-sm"
                  value={editingTask.command || ''}
                  onChange={(e) => setEditingTask((prev: any) => ({ ...prev, command: e.target.value }))}
                />
              ) : (
                <input
                  required
                  type="text"
                  placeholder="/data/scripts/backup.sh"
                  className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-mono text-sm"
                  value={editingTask.command || ''}
                  onChange={(e) => setEditingTask((prev: any) => ({ ...prev, command: e.target.value }))}
                />
              )}
            </div>

            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cron Schedule</label>
                <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="text-[10px] font-bold text-emerald-600 hover:underline">Crontab Guru</a>
              </div>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  required
                  type="text"
                  placeholder="0 * * * *"
                  className="w-full pl-12 pr-5 py-3 rounded-2xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-mono text-sm"
                  value={editingTask.cron || ''}
                  onChange={(e) => setEditingTask((prev: any) => ({ ...prev, cron: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98]"
            >
              {editingTask.id ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
