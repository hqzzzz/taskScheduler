import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FolderOpen, 
  File, 
  Search, 
  ArrowRight, 
  RefreshCw, 
  ChevronLeft, 
  ArrowUpDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Scissors,
  Clipboard,
  X,
  Clock,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { FileInfo, TransferTask } from '../types';
import { cn } from '../lib/utils';
import { PathInput } from './PathInput';

interface PaneProps {
  title: string;
  path: string;
  onPathChange: (path: string) => void;
  authToken: string | null;
  onAuthError: () => void;
  clipboard: { type: 'copy' | 'move', paths: string[] } | null;
  setClipboard: (cb: { type: 'copy' | 'move', paths: string[] } | null) => void;
  onStartTransfer: (type: 'copy' | 'move', sources: string[], target: string) => void;
}

const FilePane: React.FC<PaneProps> = ({ 
  title, 
  path, 
  onPathChange, 
  authToken,
  onAuthError,
  clipboard,
  setClipboard,
  onStartTransfer
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'mtime'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}&filter=${encodeURIComponent(filter)}`, { headers });
      if (res.status === 401) {
        onAuthError();
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setFiles(data);
      }
    } catch (e) {
      console.error('Failed to fetch files', e);
    } finally {
      setLoading(false);
    }
  }, [path, authToken, onAuthError, filter]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filteredFiles = files
    .filter(f => f.name.toLowerCase().includes(filter.toLowerCase()) || f.hasMatches)
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') comparison = a.name.localeCompare(b.name);
      if (sortBy === 'size') comparison = a.size - b.size;
      if (sortBy === 'mtime') comparison = new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleFileClick = (e: React.MouseEvent, file: FileInfo) => {
    const newSelected = new Set(selectedPaths);
    if (e.ctrlKey || e.metaKey) {
      if (newSelected.has(file.path)) newSelected.delete(file.path);
      else newSelected.add(file.path);
    } else if (e.shiftKey && selectedPaths.size > 0) {
      const lastSelected = Array.from(selectedPaths).pop()!;
      const lastIdx = filteredFiles.findIndex(f => f.path === lastSelected);
      const currentIdx = filteredFiles.findIndex(f => f.path === file.path);
      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        for (let i = start; i <= end; i++) newSelected.add(filteredFiles[i].path);
      }
    } else {
      newSelected.clear();
      newSelected.add(file.path);
    }
    setSelectedPaths(newSelected);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const parentPath = path.split('/').slice(0, -1).join('/') || '/';

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative" onContextMenu={handleContextMenu}>
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-600" />
            {title}
          </h3>
          <button onClick={fetchFiles} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => onPathChange(parentPath)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <PathInput value={path} onChange={onPathChange} authToken={authToken} onAuthError={onAuthError} className="flex-1" />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-emerald-500"
            />
          </div>
          <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
            <tr>
              <th className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase cursor-pointer" onClick={() => setSortBy('name')}>Name</th>
              <th className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase cursor-pointer text-right" onClick={() => setSortBy('size')}>Size</th>
              <th className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase cursor-pointer text-right" onClick={() => setSortBy('mtime')}>Modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {path !== '/' && (
              <tr className="hover:bg-emerald-50/50 transition-colors cursor-pointer" onDoubleClick={() => onPathChange(parentPath)}>
                <td className="px-4 py-2" colSpan={3}>
                  <div className="flex items-center gap-2 text-emerald-600 font-bold">
                    <FolderOpen className="w-4 h-4" />
                    <span className="text-sm">... 返回上一级</span>
                  </div>
                </td>
              </tr>
            )}
            {filteredFiles.map((file, idx) => (
              <tr 
                key={idx} 
                onClick={(e) => handleFileClick(e, file)}
                className={cn(
                  "hover:bg-emerald-50/50 transition-colors group cursor-default",
                  selectedPaths.has(file.path) ? "bg-emerald-50" : ""
                )}
                onDoubleClick={() => file.isDir && onPathChange(file.path)}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {file.isDir ? <FolderOpen className="w-4 h-4 text-emerald-500" /> : <File className="w-4 h-4 text-gray-400" />}
                    <span className="text-sm text-gray-700 truncate max-w-[150px]" title={file.name}>{file.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="text-xs text-gray-400 font-mono">{file.isDir ? '--' : formatSize(file.size)}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="text-[10px] text-gray-400">{format(new Date(file.mtime), 'MM/dd HH:mm')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <div 
          className="fixed z-[100] bg-white border border-gray-200 rounded-xl shadow-2xl py-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button 
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-3 transition-colors disabled:opacity-50"
            disabled={selectedPaths.size === 0}
            onClick={() => {
              setClipboard({ type: 'copy', paths: Array.from(selectedPaths) });
              closeContextMenu();
            }}
          >
            <Copy className="w-4 h-4 text-emerald-600" />
            Copy
          </button>
          <button 
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-3 transition-colors disabled:opacity-50"
            disabled={selectedPaths.size === 0}
            onClick={() => {
              setClipboard({ type: 'move', paths: Array.from(selectedPaths) });
              closeContextMenu();
            }}
          >
            <Scissors className="w-4 h-4 text-emerald-600" />
            Cut
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button 
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-3 transition-colors disabled:opacity-50"
            disabled={!clipboard}
            onClick={() => {
              if (clipboard) {
                onStartTransfer(clipboard.type, clipboard.paths, path);
                setClipboard(null);
              }
              closeContextMenu();
            }}
          >
            <Clipboard className="w-4 h-4 text-emerald-600" />
            Paste
          </button>
        </div>
      )}
    </div>
  );
};

export const TransferManager: React.FC<{ authToken: string | null, onAuthError: () => void }> = ({ authToken, onAuthError }) => {
  const [leftPath, setLeftPath] = useState(localStorage.getItem('tm_left_path') || '/data');
  const [rightPath, setRightPath] = useState(localStorage.getItem('tm_right_path') || '/data/transfer');
  const [clipboard, setClipboard] = useState<{ type: 'copy' | 'move', paths: string[] } | null>(null);
  const [transfers, setTransfers] = useState<TransferTask[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchTransfers = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      const res = await fetch('/api/transfers', { headers });
      if (res.status === 401) {
        onAuthError();
        return;
      }
      const data = await res.json();
      setTransfers(data);
    } catch (e) {
      console.error('Failed to fetch transfers', e);
    }
  }, [authToken, onAuthError]);

  useEffect(() => {
    fetchTransfers();
    const interval = setInterval(fetchTransfers, 2000);
    return () => clearInterval(interval);
  }, [fetchTransfers]);

  useEffect(() => {
    localStorage.setItem('tm_left_path', leftPath);
  }, [leftPath]);

  useEffect(() => {
    localStorage.setItem('tm_right_path', rightPath);
  }, [rightPath]);

  const handleStartTransfer = async (type: 'copy' | 'move', sources: string[], target: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, sources, target }),
      });
      
      if (res.status === 401) {
        onAuthError();
        return;
      }
      
      const data = await res.json();
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setMessage({ type: 'success', text: `Transfer started: ${type}` });
        fetchTransfers();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to start transfer' });
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      await fetch(`/api/transfers/${id}`, { method: 'DELETE', headers });
      fetchTransfers();
    } catch (e) {}
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">File Transfer Manager</h2>
          <p className="text-gray-500 text-sm">Copy or move files between directories with real-time progress tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <div className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-right-4",
              message.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
            )}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <FilePane 
          title="Source Pane" 
          path={leftPath} 
          onPathChange={setLeftPath}
          authToken={authToken}
          onAuthError={onAuthError}
          clipboard={clipboard}
          setClipboard={setClipboard}
          onStartTransfer={handleStartTransfer}
        />
        
        <div className="flex flex-col justify-center gap-4 text-gray-300">
          <ArrowRight className="w-8 h-8" />
        </div>

        <FilePane 
          title="Target Pane" 
          path={rightPath} 
          onPathChange={setRightPath}
          authToken={authToken}
          onAuthError={onAuthError}
          clipboard={clipboard}
          setClipboard={setClipboard}
          onStartTransfer={handleStartTransfer}
        />
      </div>

      {transfers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden shrink-0 max-h-[300px] flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              Active & Recent Transfers
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transfers.map(task => (
              <div key={task.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      task.type === 'copy' ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {task.type === 'copy' ? <Copy className="w-4 h-4" /> : <Scissors className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        {task.type.toUpperCase()}
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full uppercase",
                          task.status === 'running' ? "bg-emerald-100 text-emerald-700 animate-pulse" :
                          task.status === 'completed' ? "bg-gray-100 text-gray-600" :
                          task.status === 'failed' ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-400"
                        )}>
                          {task.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[400px]">
                        {task.sources.length} items → {task.target}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTransfer(task.id)} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {task.speed}
                    </div>
                    <div>{task.progress}%</div>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        task.status === 'failed' ? "bg-rose-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Started: {format(new Date(task.startTime), 'HH:mm:ss')}
                  </div>
                  {task.endTime && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Finished: {format(new Date(task.endTime), 'HH:mm:ss')}
                    </div>
                  )}
                  {task.error && (
                    <div className="flex items-center gap-1 text-rose-500">
                      <AlertCircle className="w-3 h-3" />
                      Error occurred
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
