import React from 'react';
import { 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FolderOpen, 
  Plus, 
  File 
} from 'lucide-react';
import { FileInfo } from '../types';
import { cn } from '../lib/utils';

interface EditorProps {
  editorPath: string;
  setEditorPath: (path: string) => void;
  editorContent: string;
  setEditorContent: (content: string) => void;
  isEditorLoading: boolean;
  editorMessage: { type: 'success' | 'error', text: string } | null;
  handleSaveFile: () => void;
  handleReadFile: (path: string) => void;
  fetchPathSuggestions: (path: string) => void;
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  pathSuggestions: { name: string, path: string, isDir: boolean }[];
}

export const Editor: React.FC<EditorProps> = ({
  editorPath,
  setEditorPath,
  editorContent,
  setEditorContent,
  isEditorLoading,
  editorMessage,
  handleSaveFile,
  handleReadFile,
  fetchPathSuggestions,
  showSuggestions,
  setShowSuggestions,
  pathSuggestions
}) => {
  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">File Editor</h2>
          <p className="text-sm text-gray-500">Edit scripts and configuration files directly</p>
        </div>
        <div className="flex items-center gap-3">
          {editorMessage && (
            <div className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-right-4",
              editorMessage.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
            )}>
              {editorMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {editorMessage.text}
            </div>
          )}
          <button
            onClick={handleSaveFile}
            disabled={isEditorLoading || !editorPath}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none"
          >
            {isEditorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save File
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <FolderOpen className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="/path/to/file.js"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"
              value={editorPath}
              onChange={(e) => {
                setEditorPath(e.target.value);
                fetchPathSuggestions(e.target.value);
              }}
              onFocus={() => editorPath && fetchPathSuggestions(editorPath)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && pathSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto py-2">
                {pathSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                    onClick={() => {
                      const newPath = s.isDir ? (s.path.endsWith('/') ? s.path : s.path + '/') : s.path;
                      setEditorPath(newPath);
                      if (s.isDir) {
                        fetchPathSuggestions(newPath);
                      } else {
                        handleReadFile(newPath);
                        setShowSuggestions(false);
                      }
                    }}
                  >
                    {s.isDir ? <Plus className="w-3.5 h-3.5 text-emerald-500" /> : <File className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="text-xs font-mono text-gray-700">{s.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleReadFile(editorPath)}
            disabled={isEditorLoading || !editorPath}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Open
          </button>
        </div>
        <div className="flex-1 relative">
          <textarea
            className="absolute inset-0 w-full h-full p-8 font-mono text-sm text-gray-800 bg-white outline-none resize-none leading-relaxed"
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            placeholder="File content will appear here..."
            spellCheck={false}
          />
          {isEditorLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
