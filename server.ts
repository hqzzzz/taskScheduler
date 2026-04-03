import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.set('trust proxy', true);
const PORT = Number(process.env.PORT) || 3000;
const APP_USERNAME = process.env.APP_USERNAME || 'admin';
const APP_PASSWORD = process.env.APP_PASSWORD || 'password123';

// IP Blocking Logic
const failedAttempts = new Map<string, number>();
const blockedIps = new Set<string>();

const ipBlockMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (blockedIps.has(ip)) {
    return res.status(403).json({ error: 'Your IP has been blocked due to too many failed login attempts. Please restart the service to unblock.' });
  }
  next();
};

// Ensure /data directory exists for persistent storage
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

app.use(express.json());
app.use(ipBlockMiddleware);

// Simple Auth Middleware
const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!APP_USERNAME || !APP_PASSWORD) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader === `Basic ${Buffer.from(`${APP_USERNAME}:${APP_PASSWORD}`).toString('base64')}`) {
    return next();
  }
  
  res.status(401).json({ error: 'Unauthorized' });
};

// Login endpoint to check credentials
app.post('/api/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { username, password } = req.body;

  if (!APP_USERNAME || !APP_PASSWORD) {
    return res.json({ success: true, noAuth: true });
  }
  
  if (username === APP_USERNAME && password === APP_PASSWORD) {
    failedAttempts.delete(ip); // Reset on success
    const token = Buffer.from(`${username}:${password}`).toString('base64');
    res.json({ success: true, token });
  } else {
    const attempts = (failedAttempts.get(ip) || 0) + 1;
    failedAttempts.set(ip, attempts);
    
    if (attempts >= 5) {
      blockedIps.add(ip);
      return res.status(403).json({ success: false, error: 'Too many failed attempts. Your IP has been blocked.' });
    }
    
    res.status(401).json({ success: false, error: `Invalid credentials. ${5 - attempts} attempts remaining.` });
  }
});

// Protect all other API routes
app.use('/api/tasks', authMiddleware);
app.use('/api/logs', authMiddleware);
app.use('/api/fs', authMiddleware);

// Helper to read/write JSON files
const readJson = (file: string) => {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return [];
  }
};

const writeJson = (file: string, data: any) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

interface Task {
  id: string;
  name: string;
  type: 'shell' | 'node' | 'python';
  mode: 'code' | 'file';
  command: string;
  cron: string;
  status: 'active' | 'inactive';
  lastRun?: string;
  nextRun?: string;
}

interface Log {
  id: string;
  taskId: string;
  taskName: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'success' | 'error';
  output: string;
  duration?: number;
}

// Scheduler state
const scheduledTasks = new Map<string, any>();

const executeTask = async (task: Task) => {
  const logId = uuidv4();
  const startTime = new Date().toISOString();
  
  const newLog: Log = {
    id: logId,
    taskId: task.id,
    taskName: task.name,
    startTime,
    status: 'running',
    output: '',
  };

  const logs = readJson(LOGS_FILE);
  logs.unshift(newLog);
  writeJson(LOGS_FILE, logs.slice(0, 1000)); // Keep last 1000 logs

  console.log(`Executing task: ${task.name} (${task.id})`);

  let fullCommand = task.command;
  if (task.mode === 'code') {
    if (task.type === 'node') fullCommand = `node -e "${task.command.replace(/"/g, '\\"')}"`;
    if (task.type === 'python') fullCommand = `python3 -c "${task.command.replace(/"/g, '\\"')}"`;
  } else {
    // File mode
    if (task.type === 'node') fullCommand = `node "${task.command}"`;
    if (task.type === 'python') fullCommand = `python3 "${task.command}"`;
    // shell mode is already just the command
  }

  const start = Date.now();
  
  exec(fullCommand, { 
    encoding: 'utf8', 
    env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } 
  }, (error, stdout, stderr) => {
    const end = Date.now();
    const endTime = new Date().toISOString();
    const duration = end - start;
    const output = stdout + (stderr ? `\nError: ${stderr}` : '') + (error ? `\nExec Error: ${error.message}` : '');
    
    const logs = readJson(LOGS_FILE);
    const logIndex = logs.findIndex((l: Log) => l.id === logId);
    if (logIndex !== -1) {
      logs[logIndex] = {
        ...logs[logIndex],
        endTime,
        status: error ? 'error' : 'success',
        output,
        duration,
      };
      writeJson(LOGS_FILE, logs);
    }

    // Update task last run
    const tasks = readJson(TASKS_FILE);
    const taskIndex = tasks.findIndex((t: Task) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex].lastRun = startTime;
      writeJson(TASKS_FILE, tasks);
    }
  });
};

const scheduleTask = (task: Task) => {
  if (task.status === 'inactive') return;
  
  try {
    const scheduled = cron.schedule(task.cron, () => executeTask(task));
    scheduledTasks.set(task.id, scheduled);
  } catch (e) {
    console.error(`Failed to schedule task ${task.name}:`, e);
  }
};

const reloadScheduler = () => {
  scheduledTasks.forEach(t => t.stop());
  scheduledTasks.clear();
  const tasks = readJson(TASKS_FILE);
  tasks.forEach((task: Task) => scheduleTask(task));
};

// API Routes
app.get('/api/tasks', (req, res) => {
  res.json(readJson(TASKS_FILE));
});

app.post('/api/tasks', (req, res) => {
  const tasks = readJson(TASKS_FILE);
  const newTask: Task = {
    ...req.body,
    id: uuidv4(),
    status: req.body.status || 'active',
  };
  tasks.push(newTask);
  writeJson(TASKS_FILE, tasks);
  scheduleTask(newTask);
  res.json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const tasks = readJson(TASKS_FILE);
  const index = tasks.findIndex((t: Task) => t.id === req.params.id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...req.body };
    writeJson(TASKS_FILE, tasks);
    reloadScheduler();
    res.json(tasks[index]);
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  let tasks = readJson(TASKS_FILE);
  tasks = tasks.filter((t: Task) => t.id !== req.params.id);
  writeJson(TASKS_FILE, tasks);
  reloadScheduler();
  res.json({ success: true });
});

app.post('/api/tasks/:id/run', (req, res) => {
  const tasks = readJson(TASKS_FILE);
  const task = tasks.find((t: Task) => t.id === req.params.id);
  if (task) {
    executeTask(task);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

app.get('/api/logs', (req, res) => {
  res.json(readJson(LOGS_FILE));
});

app.delete('/api/logs', (req, res) => {
  writeJson(LOGS_FILE, []);
  res.json({ success: true });
});

// File system autocomplete API
app.get('/api/fs/ls', (req, res) => {
  const queryPath = (req.query.path as string) || '/';
  const normalizedPath = path.isAbsolute(queryPath) ? queryPath : path.join(process.cwd(), queryPath);
  
  // Get directory and partial filename
  const dir = queryPath.endsWith('/') ? normalizedPath : path.dirname(normalizedPath);
  const base = queryPath.endsWith('/') ? '' : path.basename(normalizedPath);

  try {
    if (!fs.existsSync(dir)) return res.json([]);
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) return res.json([]);

    const files = fs.readdirSync(dir, { withFileTypes: true });
    const suggestions = files
      .filter(f => f.name.startsWith(base))
      .map(f => ({
        name: f.name,
        path: path.join(dir, f.name),
        isDir: f.isDirectory()
      }))
      .slice(0, 50); // Increased limit
    res.json(suggestions);
  } catch (e) {
    res.json([]);
  }
});

// Read file content
app.get('/api/fs/read', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });
  
  const normalizedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  
  try {
    if (!fs.existsSync(normalizedPath)) return res.status(404).json({ error: 'File not found' });
    const stats = fs.statSync(normalizedPath);
    if (stats.isDirectory()) return res.status(400).json({ error: 'Cannot read a directory' });
    
    // Limit file size to 1MB for safety
    if (stats.size > 1024 * 1024) return res.status(400).json({ error: 'File too large (max 1MB)' });
    
    const content = fs.readFileSync(normalizedPath, 'utf-8');
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Write file content
app.post('/api/fs/write', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });
  
  const normalizedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  
  try {
    // Ensure directory exists
    const dir = path.dirname(normalizedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(normalizedPath, content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// Enhanced file listing with stats
app.get('/api/fs/list', (req, res) => {
  const queryPath = (req.query.path as string) || '/';
  const normalizedPath = path.isAbsolute(queryPath) ? queryPath : path.join(process.cwd(), queryPath);

  try {
    if (!fs.existsSync(normalizedPath)) return res.status(404).json({ error: 'Directory not found' });
    const stats = fs.statSync(normalizedPath);
    if (!stats.isDirectory()) return res.status(400).json({ error: 'Not a directory' });

    const files = fs.readdirSync(normalizedPath, { withFileTypes: true });
    const result = files.map(f => {
      const fullPath = path.join(normalizedPath, f.name);
      try {
        const s = fs.statSync(fullPath);
        return {
          name: f.name,
          path: fullPath,
          isDir: f.isDirectory(),
          size: s.size,
          mtime: s.mtime,
          ext: path.extname(f.name).toLowerCase()
        };
      } catch (e) {
        return {
          name: f.name,
          path: fullPath,
          isDir: f.isDirectory(),
          size: 0,
          mtime: new Date(0),
          ext: path.extname(f.name).toLowerCase()
        };
      }
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list directory' });
  }
});

// Create hard link
app.post('/api/fs/link', (req, res) => {
  const { source, target } = req.body;
  if (!source || !target) return res.status(400).json({ error: 'Source and target are required' });

  try {
    // Ensure target directory exists
    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(target)) {
      return res.status(400).json({ error: 'Target already exists' });
    }

    fs.linkSync(source, target);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create hard link' });
  }
});

// Delete file
app.delete('/api/fs/delete', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  try {
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Initialize scheduler
reloadScheduler();

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
