import React from 'react';
import { 
  Trash2, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2 
} from 'lucide-react';
import { format } from 'date-fns';
import { Log } from '../types';
import { cn } from '../lib/utils';

interface LogsProps {
  logs: Log[];
  fetchLogs: () => void;
}

const StatusBadge = ({ status }: { status: Log['status'] }) => {
  const colors = {
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit uppercase tracking-wider', colors[status])}>
      {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === 'success' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'error' && <XCircle className="w-3 h-3" />}
      {status}
    </span>
  );
};

export const Logs: React.FC<LogsProps> = ({ logs, fetchLogs }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Execution History</h2>
          <p className="text-sm text-gray-500">Track task performance and output logs</p>
        </div>
        <button 
          onClick={async () => {
            if (confirm('Clear all logs?')) {
              await fetch('/api/logs', { method: 'DELETE' });
              fetchLogs();
            }
          }}
          className="text-xs text-rose-500 hover:text-rose-600 font-bold flex items-center gap-2 px-4 py-2 hover:bg-rose-50 rounded-xl transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Clear History
        </button>
      </div>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-400">
            <FileText className="w-12 h-12 text-gray-100 mx-auto mb-4" />
            <p className="text-sm italic">No execution logs yet. Run a task to see history.</p>
          </div>
        ) : logs.map((log) => (
          <div key={log.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/30">
              <div className="flex items-center gap-4">
                <StatusBadge status={log.status} />
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">{log.taskName}</span>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {format(new Date(log.startTime), 'MMM d, HH:mm:ss')}
                    {log.duration && ` • ${log.duration}ms`}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-[#1e1e1e]">
              <pre className="text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-40 break-all leading-relaxed">
                {log.output || 'No output recorded.'}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
