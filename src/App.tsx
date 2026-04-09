import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Task, Log } from './types';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Logs } from './components/Logs';
import { Editor } from './components/Editor';
import { HardLinkManager } from './components/HardLinkManager';
import { TransferManager } from './components/TransferManager';
import { AuthModal } from './components/AuthModal';
import { TaskModal } from './components/TaskModal';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'editor' | 'hardlink' | 'transfer'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('task_auth_token'));
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Editor State
  const [editorPath, setEditorPath] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [editorMessage, setEditorMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      
      const res = await fetch('/api/tasks', { headers });
      if (res.status === 401) {
        setIsAuthModalOpen(true);
        return;
      }
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    } finally {
      setIsLoading(false);
    }
  }, [authToken]);

  const fetchLogs = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      
      const res = await fetch('/api/logs', { headers });
      if (res.status === 401) {
        setIsAuthModalOpen(true);
        return;
      }
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch logs', e);
    }
  }, [authToken]);

  useEffect(() => {
    fetchTasks();
    fetchLogs();
    const interval = setInterval(() => {
      fetchTasks();
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchLogs]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (data.success) {
        const token = data.token || '';
        setAuthToken(token);
        localStorage.setItem('task_auth_token', token);
        setIsAuthModalOpen(false);
        setLoginForm({ username: '', password: '' });
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (e) {
      setLoginError('Login failed. Please try again.');
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem('task_auth_token');
    setIsAuthModalOpen(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      
      const method = editingTask.id ? 'PUT' : 'POST';
      const url = editingTask.id ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(editingTask),
      });
      
      if (res.status === 401) {
        setIsAuthModalOpen(true);
        return;
      }
      
      setIsModalOpen(false);
      fetchTasks();
    } catch (e) {
      console.error('Failed to save task', e);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      
      const res = await fetch(`/api/tasks/${id}`, { 
        method: 'DELETE',
        headers
      });
      
      if (res.status === 401) {
        setIsAuthModalOpen(true);
        return;
      }
      
      fetchTasks();
    } catch (e) {
      console.error('Failed to delete task', e);
    }
  };

  const handleRunTask = async (id: string) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      
      const res = await fetch(`/api/tasks/${id}/run`, { 
        method: 'POST',
        headers
      });
      
      if (res.status === 401) {
        setIsAuthModalOpen(true);
        return;
      }
      
      fetchLogs();
    } catch (e) {
      console.error('Failed to run task', e);
    }
  };

  const handleReadFile = async (path: string) => {
    if (!path) return;
    setIsEditorLoading(true);
    setEditorMessage(null);
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`, { headers });
      if (res.status === 401) {
        setIsAuthModalOpen(true);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setEditorMessage({ type: 'error', text: data.error });
      } else {
        setEditorContent(data.content);
        setEditorPath(path);
      }
    } catch (e) {
      setEditorMessage({ type: 'error', text: 'Failed to read file' });
    } finally {
      setIsEditorLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editorPath) return;
    setIsEditorLoading(true);
    setEditorMessage(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Basic ${authToken}`;
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers,
        body: JSON.stringify({ path: editorPath, content: editorContent }),
      });
      if (res.status === 401) {
        setIsAuthModalOpen(true);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setEditorMessage({ type: 'error', text: data.error });
      } else {
        setEditorMessage({ type: 'success', text: 'File saved successfully' });
        setTimeout(() => setEditorMessage(null), 3000);
      }
    } catch (e) {
      setEditorMessage({ type: 'error', text: 'Failed to save file' });
    } finally {
      setIsEditorLoading(false);
    }
  };

  if (isAuthModalOpen) {
    return (
      <AuthModal 
        loginForm={loginForm as any}
        setLoginForm={setLoginForm}
        handleLogin={handleLogin}
        loginError={loginError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks or commands..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl text-sm transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' && (
            <Dashboard 
              tasks={tasks}
              logs={logs}
              searchQuery={searchQuery}
              handleRunTask={handleRunTask}
              handleDeleteTask={handleDeleteTask}
              setEditingTask={setEditingTask}
              setIsModalOpen={setIsModalOpen}
              handleReadFile={handleReadFile}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'logs' && (
            <Logs logs={logs} fetchLogs={fetchLogs} authToken={authToken} />
          )}

          {activeTab === 'editor' && (
            <Editor 
              editorPath={editorPath}
              setEditorPath={setEditorPath}
              editorContent={editorContent}
              setEditorContent={setEditorContent}
              isEditorLoading={isEditorLoading}
              editorMessage={editorMessage}
              handleSaveFile={handleSaveFile}
              handleReadFile={handleReadFile}
              authToken={authToken}
              onAuthError={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'hardlink' && (
            <HardLinkManager 
              authToken={authToken}
              onAuthError={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'transfer' && (
            <TransferManager 
              authToken={authToken}
              onAuthError={() => setIsAuthModalOpen(true)}
            />
          )}
        </div>
      </main>

      {isModalOpen && (
        <TaskModal 
          editingTask={editingTask}
          setEditingTask={setEditingTask}
          setIsModalOpen={setIsModalOpen}
          handleSubmit={handleSubmitTask}
          authToken={authToken}
          onAuthError={() => setIsAuthModalOpen(true)}
        />
      )}
    </div>
  );
}
