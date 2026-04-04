import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, File, Plus, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface PathInputProps {
  value: string;
  onChange: (value: string) => void;
  onFileSelect?: (path: string) => void;
  placeholder?: string;
  className?: string;
  authToken: string | null;
  onAuthError?: () => void;
  icon?: React.ReactNode;
}

export const PathInput: React.FC<PathInputProps> = ({
  value,
  onChange,
  onFileSelect,
  placeholder = "/path/to/file",
  className,
  authToken,
  onAuthError,
  icon
}) => {
  const [suggestions, setSuggestions] = useState<{ name: string, path: string, isDir: boolean }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async (path: string) => {
    if (!path) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      const res = await fetch(`/api/fs/ls?path=${encodeURIComponent(path)}`, { headers });
      if (res.status === 401) {
        onAuthError?.();
        return;
      }
      const data = await res.json();
      setSuggestions(data);
    } catch (e) {
      console.error('Failed to fetch suggestions', e);
    } finally {
      setLoading(false);
    }
  }, [authToken, onAuthError]);

  useEffect(() => {
    if (showSuggestions) {
      const timer = setTimeout(() => fetchSuggestions(value), 300);
      return () => clearTimeout(timer);
    }
  }, [value, showSuggestions, fetchSuggestions]);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type="text"
          placeholder={placeholder}
          className={cn(
            "w-full pr-10 py-2.5 rounded-xl border border-gray-200 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all",
            icon ? "pl-11" : "pl-4"
          )}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-[100] left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto py-2">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className="w-full text-left px-4 py-2 hover:bg-emerald-50 flex items-center gap-3 transition-colors"
              onClick={() => {
                const newPath = s.isDir ? (s.path.endsWith('/') ? s.path : s.path + '/') : s.path;
                onChange(newPath);
                if (s.isDir) {
                  fetchSuggestions(newPath);
                } else if (onFileSelect) {
                  onFileSelect(newPath);
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
  );
};
