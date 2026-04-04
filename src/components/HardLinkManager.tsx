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
import { PathInput } from './PathInput';

interface PaneProps {
  title: string;
  path: string;
  onPathChange: (path: string) => void;
  onFilesDrop?: (sourcePaths: string[], filter: string, typeFilter: string) => void;
  allowDelete?: boolean;
  onDelete?: (path: string) => void;
  authToken: string | null;
  onAuthError: () => void;
}

const FilePane: React.FC<PaneProps> = ({ 
  title, 
  path, 
  onPathChange, 
  onFilesDrop, 
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
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

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
    .filter(f => {
      const matchesName = f.name.toLowerCase().includes(filter.toLowerCase());
      const hasMatches = f.hasMatches;
      
      if (typeFilter === 'all') return matchesName || hasMatches;
      if (typeFilter === 'video') return (matchesName && ['.mp4', '.mkv', '.avi', '.mov'].includes(f.ext)) || hasMatches;
      if (typeFilter === 'image') return (matchesName && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(f.ext)) || hasMatches;
      if (typeFilter === 'dir') return (matchesName && f.isDir) || hasMatches;
      return matchesName || hasMatches;
    })
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
      if (newSelected.has(file.path)) {
        newSelected.delete(file.path);
      } else {
        newSelected.add(file.path);
      }
    } else if (e.shiftKey && selectedPaths.size > 0) {
      // Basic shift selection logic
      const lastSelected = Array.from(selectedPaths).pop()!;
      const lastIdx = filteredFiles.findIndex(f => f.path === lastSelected);
      const currentIdx = filteredFiles.findIndex(f => f.path === file.path);
      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        for (let i = start; i <= end; i++) {
          newSelected.add(filteredFiles[i].path);
        }
      }
    } else {
      newSelected.clear();
      newSelected.add(file.path);
    }
    setSelectedPaths(newSelected);
  };

  const handleDragStart = (e: React.DragEvent, file: FileInfo) => {
    let pathsToDrag = [file.path];
    if (selectedPaths.has(file.path)) {
      pathsToDrag = Array.from(selectedPaths);
    }
    
    e.dataTransfer.setData('sourcePaths', JSON.stringify(pathsToDrag));
    e.dataTransfer.setData('sourceFilter', filter);
    e.dataTransfer.setData('sourceTypeFilter', typeFilter);
    // For visual feedback
    const dragImg = document.createElement('div');
    dragImg.className = 'bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg';
    dragImg.innerText = `Linking ${pathsToDrag.length} item(s)`;
    document.body.appendChild(dragImg);
    e.dataTransfer.setDragImage(dragImg, 0, 0);
    setTimeout(() => document.body.removeChild(dragImg), 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sourcePathsStr = e.dataTransfer.getData('sourcePaths');
    const sourceFilter = e.dataTransfer.getData('sourceFilter');
    const sourceTypeFilter = e.dataTransfer.getData('sourceTypeFilter');
    if (sourcePathsStr && onFilesDrop) {
      try {
        const paths = JSON.parse(sourcePathsStr);
        onFilesDrop(paths, sourceFilter, sourceTypeFilter);
      } catch (e) {
        console.error('Failed to parse dropped paths', e);
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const parentPath = path.split('/').slice(0, -1).join('/') || '/';

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
            onClick={() => onPathChange(parentPath)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <PathInput 
            value={path}
            onChange={onPathChange}
            authToken={authToken}
            onAuthError={onAuthError}
            className="flex-1"
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
            {path !== '/' && (
              <tr 
                className="hover:bg-emerald-50/50 transition-colors cursor-pointer"
                onDoubleClick={() => onPathChange(parentPath)}
              >
                <td className="px-4 py-2" colSpan={allowDelete ? 4 : 3}>
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
                draggable={true}
                onDragStart={(e) => handleDragStart(e, file)}
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

  const handleCreateLinks = async (sourcePaths: string[], filter: string, typeFilter: string) => {
    setIsLinking(true);
    setMessage(null);
    let successCount = 0;
    let failCount = 0;
    
    for (const sourcePath of sourcePaths) {
      const fileName = sourcePath.split('/').pop();
      const targetPath = `${rightPath}/${fileName}`;
      
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Basic ${authToken}`;
        
        const res = await fetch('/api/fs/link', {
          method: 'POST',
          headers,
          body: JSON.stringify({ source: sourcePath, target: targetPath, filter, typeFilter }),
        });
        
        if (res.status === 401) {
          onAuthError();
          return;
        }
        
        const data = await res.json();
        if (data.error) {
          failCount++;
        } else {
          successCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    if (successCount > 0) {
      setMessage({ type: 'success', text: `Successfully linked ${successCount} item(s)${failCount > 0 ? `, ${failCount} failed` : ''}` });
    } else if (failCount > 0) {
      setMessage({ type: 'error', text: `Failed to link ${failCount} item(s)` });
    }
    
    setTimeout(() => setMessage(null), 3000);
    setIsLinking(false);
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
          onFilesDrop={handleCreateLinks}
          allowDelete={true}
          onDelete={handleDeleteLink}
          authToken={authToken}
          onAuthError={onAuthError}
        />
      </div>
    </div>
  );
};
