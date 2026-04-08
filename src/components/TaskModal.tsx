import React, { useState } from 'react';
import { X, Terminal, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Task } from '../types';
import { PathInput } from './PathInput';

interface TaskModalProps {
  editingTask: Partial<Task> | null;
  setEditingTask: (task: any) => void;
  setIsModalOpen: (open: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
  authToken: string | null;
  onAuthError: () => void;
}

const CRON_EXAMPLES = {
  'Every 2 hours': '0 */2 * * *',
  'Every day at 3 AM': '0 3 * * *',
  'Every Monday at 9 AM': '0 9 * * 1',
  'Every 30 minutes': '*/30 * * * *',
  'Every 6 hours': '0 */6 * * *',
};

export const TaskModal: React.FC<TaskModalProps> = ({
  editingTask,
  setEditingTask,
  setIsModalOpen,
  handleSubmit,
  authToken,
  onAuthError
}) => {
  const [cronError, setCronError] = useState<string | null>(null);
  const [cronValid, setCronValid] = useState<boolean | null>(null);

  const validateCron = async (cronExpr: string) => {
    if (!cronExpr) {
      setCronValid(null);
      setCronError(null);
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;

      const res = await fetch('/api/validate-cron', {
        method: 'POST',
        headers,
        body: JSON.stringify({ cron: cronExpr }),
      });

      const data = await res.json();
      
      if (data.valid) {
        setCronValid(true);
        setCronError(null);
      } else {
        setCronValid(false);
        setCronError(data.error || 'Invalid cron expression');
      }
    } catch (e) {
      setCronValid(false);
      setCronError('Error validating cron expression');
    }
  };

  const handleCronChange = (value: string) => {
    setEditingTask((prev: any) => ({ ...prev, cron: value }));
    validateCron(value);
  };

  if (!editingTask) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0">
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
                <PathInput
                  value={editingTask.command || ''}
                  onChange={(val) => setEditingTask((prev: any) => ({ ...prev, command: val }))}
                  authToken={authToken}
                  onAuthError={onAuthError}
                  placeholder="/data/scripts/backup.sh"
                />
              )}
            </div>

            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cron Schedule</label>
                <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="text-[10px] font-bold text-emerald-600 hover:underline">Crontab Guru ↗</a>
              </div>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  required
                  type="text"
                  placeholder="0 * * * *"
                  className={`w-full pl-12 pr-5 py-3 rounded-2xl bg-gray-50 border transition-all font-mono text-sm outline-none focus:bg-white focus:ring-4 ${
                    cronError 
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/10' 
                      : cronValid === true
                      ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/10'
                      : 'border-gray-100 focus:border-emerald-500 focus:ring-emerald-500/10'
                  }`}
                  value={editingTask.cron || ''}
                  onChange={(e) => handleCronChange(e.target.value)}
                />
              </div>

              {cronError && (
                <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-700 font-medium">{cronError}</div>
                </div>
              )}

              {cronValid === true && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="text-xs text-emerald-700 font-medium">Valid cron expression</div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Common Examples:</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CRON_EXAMPLES).map(([label, cron]) => (
                    <button
                      key={cron}
                      type="button"
                      onClick={() => handleCronChange(cron)}
                      className="text-left px-3 py-2 text-xs font-mono bg-white border border-gray-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 transition-colors truncate"
                      title={cron}
                    >
                      <div className="text-gray-600 truncate">{label}</div>
                      <div className="text-gray-400 text-[9px] truncate">{cron}</div>
                    </button>
                  ))}
                </div>
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
              disabled={cronError !== null && editingTask.cron}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingTask.id ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
