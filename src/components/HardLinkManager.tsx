import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderOpen, 
  File, 
  Search, 
  ArrowRight, 
  Trash2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { FileInfo } from '../types';
import { cn } from '../lib/utils';

interface PaneProps {
  title: string;
  path: string;
  onPathChange: (path: string) => void;
  onFileDrop?: (sourcePath: string) => void;
  allowDelete?: boolean;
  onDelete?: (path: string) => void;
  authToken: string | null;
  onAuthError: () => void;
}

const FilePane: React.FC<PaneProps> = ({ 
  title, 
  path, 
  onPathChange, 
  onFileDrop, 
  allowDelete, 
  onDelete,
  authToken,
  onAuthError
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'mtime'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`, { headers });
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
  }, [path, authToken, onAuthError]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filteredFiles = files
    .filter(f => {
      const matchesName = f.name.toLowerCase().includes(filter.toLowerCase());
      if (typeFilter === 'all') return matchesName;
      if (typeFilter === 'video') return matchesName && ['.mp4', '.mkv', '.avi', '.mov'].includes(f.ext);
      if (typeFilter === 'image') return matchesName && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(f.ext);
      if (typeFilter === 'dir') return matchesName && f.isDir;
      return matchesName;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') comparison = a.name.localeCompare(b.name);
      if (sortBy === 'size') comparison = a.size - b.size;
      if (sortBy === 'mtime') comparison = new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleDragStart = (e: React.DragEvent, file: FileInfo) => {
    if (file.isDir) return;
    e.dataTransfer.setData('sourcePath', file.path);
    e.dataTransfer.setData('fileName', file.name);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sourcePath = e.dataTransfer.getData('sourcePath');
    if (sourcePath && onFileDrop) {
      onFileDrop(sourcePath);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div 
      className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
          <button 
            onClick={() => onPathChange(path.split('/').slice(0, -1).join('/') || '/')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input 
            type="text" 
            value={path}
            onChange={(e) => onPathChange(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-emerald-500"
          />
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
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none"
          >
            <option value="all">All Files</option>
            <option value="video">Videos</option>
            <option value="image">Images</option>
            <option value="dir">Folders</option>
          </select>
          <button 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
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
              {allowDelete && <th className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredFiles.map((file, idx) => (
              <tr 
                key={idx} 
                draggable={!file.isDir}
                onDragStart={(e) => handleDragStart(e, file)}
                className="hover:bg-emerald-50/50 transition-colors group cursor-default"
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
                {allowDelete && (
                  <td className="px-4 py-2 text-right">
                    <button 
                      onClick={() => onDelete?.(file.path)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filteredFiles.length === 0 && !loading && (
              <tr>
                <td colSpan={allowDelete ? 4 : 3} className="px-4 py-8 text-center text-gray-400 text-xs italic">
                  No files found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const HardLinkManager: React.FC<{ authToken: string | null, onAuthError: () => void }> = ({ authToken, onAuthError }) => {
  const [leftPath, setLeftPath] = useState(localStorage.getItem('hl_left_path') || '/data');
  const [rightPath, setRightPath] = useState(localStorage.getItem('hl_right_path') || '/data/links');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    localStorage.setItem('hl_left_path', leftPath);
  }, [leftPath]);

  useEffect(() => {
    localStorage.setItem('hl_right_path', rightPath);
  }, [rightPath]);

  const handleCreateLink = async (sourcePath: string) => {
    const fileName = sourcePath.split('/').pop();
    const targetPath = `${rightPath}/${fileName}`;
    
    setIsLinking(true);
    setMessage(null);
    
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      
      const res = await fetch('/api/fs/link', {
        method: 'POST',
        headers,
        body: JSON.stringify({ source: sourcePath, target: targetPath }),
      });
      
      if (res.status === 401) {
        onAuthError();
        return;
      }
      
      const data = await res.json();
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setMessage({ type: 'success', text: `Linked: ${fileName}` });
        // Refresh right pane by triggering a re-render or using a ref (simpler: just wait a bit)
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to create link' });
    } finally {
      setIsLinking(false);
    }
  };

  const handleDeleteLink = async (path: string) => {
    if (!confirm('Delete this link? (Source file will remain safe)')) return;
    
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      const res = await fetch(`/api/fs/delete?path=${encodeURIComponent(path)}`, { 
        method: 'DELETE',
        headers 
      });
      if (res.status === 401) {
        onAuthError();
        return;
      }
      // Refresh will happen automatically due to state change if we had a refresh trigger
      // For now, we'll just rely on the user clicking refresh or path changing
      setMessage({ type: 'success', text: 'Link deleted' });
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hard Link Manager</h2>
          <p className="text-gray-500 text-sm">Drag files from left to right to create hard links. Organize your media without duplicating space.</p>
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
          {isLinking && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Linking...
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <FilePane 
          title="Source (Read Only)" 
          path={leftPath} 
          onPathChange={setLeftPath}
          authToken={authToken}
          onAuthError={onAuthError}
        />
        
        <div className="flex flex-col justify-center gap-4 text-gray-300">
          <ArrowRight className="w-8 h-8" />
        </div>

        <FilePane 
          title="Target (Links)" 
          path={rightPath} 
          onPathChange={setRightPath}
          onFileDrop={handleCreateLink}
          allowDelete={true}
          onDelete={handleDeleteLink}
          authToken={authToken}
          onAuthError={onAuthError}
        />
      </div>
    </div>
  );
};
