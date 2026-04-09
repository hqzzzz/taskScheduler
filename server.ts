import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec, spawn, execSync } from 'child_process';
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
app.use('/api/validate-cron', authMiddleware);
app.use('/api/transfers', authMiddleware);

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

interface TransferTask {
  id: string;
  type: 'copy' | 'move';
  sources: string[];
  target: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  speed: string;
  startTime: string;
  endTime?: string;
  error?: string;
}

const transfers = new Map<string, TransferTask>();

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
};

const executeNodeTransfer = async (task: TransferTask) => {
  task.status = 'running';
  task.startTime = new Date().toISOString();
  task.speed = 'Calculating...';

  try {
    // 1. Calculate total size for progress tracking
    let totalSize = 0;
    const calculateSize = (p: string) => {
      try {
        const stats = fs.statSync(p);
        if (stats.isDirectory()) {
          fs.readdirSync(p).forEach(f => calculateSize(path.join(p, f)));
        } else {
          totalSize += stats.size;
        }
      } catch (e) {}
    };
    task.sources.forEach(s => calculateSize(s));
    if (totalSize === 0) totalSize = 1;

    let transferred = 0;
    let lastTime = Date.now();
    let lastTransferred = 0;

    const copyFile = (src: string, dest: string) => {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      
      const readStream = fs.createReadStream(src);
      const writeStream = fs.createWriteStream(dest);
      
      return new Promise<void>((resolve, reject) => {
        readStream.on('data', (chunk) => {
          transferred += chunk.length;
          task.progress = Math.round((transferred / totalSize) * 100);
          
          const now = Date.now();
          if (now - lastTime >= 1000) {
            const speed = (transferred - lastTransferred) / ((now - lastTime) / 1000);
            task.speed = formatBytes(speed) + '/s';
            lastTime = now;
            lastTransferred = transferred;
          }
        });
        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        readStream.pipe(writeStream);
      });
    };

    const processItem = async (src: string, dest: string) => {
      const stats = fs.statSync(src);
      if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const file of fs.readdirSync(src)) {
          await processItem(path.join(src, file), path.join(dest, file));
        }
        if (task.type === 'move') fs.rmSync(src, { recursive: true, force: true });
      } else {
        await copyFile(src, dest);
        if (task.type === 'move') fs.unlinkSync(src);
      }
    };

    for (const source of task.sources) {
      const dest = path.join(task.target, path.basename(source));
      await processItem(source, dest);
    }

    task.status = 'completed';
    task.progress = 100;
  } catch (e: any) {
    task.status = 'failed';
    task.error = e.message;
  } finally {
    task.endTime = new Date().toISOString();
  }
};

const executeTransfer = (task: TransferTask) => {
  // Check if rsync is available
  let hasRsync = false;
  try {
    execSync('rsync --version', { stdio: 'ignore' });
    hasRsync = true;
  } catch (e) {}

  if (!hasRsync) {
    executeNodeTransfer(task);
    return;
  }

  task.status = 'running';
  task.startTime = new Date().toISOString();
  
  const args = task.type === 'copy' 
    ? ['-av', '--info=progress2', ...task.sources, task.target]
    : ['-av', '--info=progress2', '--remove-source-files', ...task.sources, task.target];

  const child = spawn('rsync', args);

  child.stdout.on('data', (data) => {
    const output = data.toString();
    // Try to parse progress from rsync output
    // Example: 1,234,567  89%  1.23MB/s    0:00:01
    const progressMatch = output.match(/(\d+)%\s+([\d.]+\w+\/s)/);
    if (progressMatch) {
      task.progress = parseInt(progressMatch[1]);
      task.speed = progressMatch[2];
    }
  });

  child.stderr.on('data', (data) => {
    task.error = (task.error || '') + data.toString();
  });

  child.on('close', (code) => {
    task.status = code === 0 ? 'completed' : 'failed';
    task.endTime = new Date().toISOString();
    if (code === 0) task.progress = 100;
    
    // If it was a move, we might need to clean up empty directories if rsync didn't
    if (task.type === 'move' && code === 0) {
      task.sources.forEach(source => {
        try {
          if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
            fs.rmSync(source, { recursive: true, force: true });
          }
        } catch (e) {}
      });
    }
  });
};

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

// Validate cron expression
app.post('/api/validate-cron', (req, res) => {
  const { cron: cronExpr } = req.body;
  if (!cronExpr) return res.status(400).json({ error: 'Cron expression is required' });
  
  try {
    cron.schedule(cronExpr, () => {});
    res.json({ valid: true });
  } catch (e: any) {
    res.status(400).json({ 
      valid: false, 
      error: e.message || 'Invalid cron expression',
      examples: {
        'Every minute': '* * * * *',
        'Every 2 hours': '0 */2 * * *',
        'Every day at 3 AM': '0 3 * * *',
        'Every Monday at 9 AM': '0 9 * * 1',
        'Every 30 minutes': '*/30 * * * *',
        'Every 6 hours': '0 */6 * * *',
        'At 10:30 AM daily': '30 10 * * *',
        'First day of month': '0 0 1 * *',
      }
    });
  }
});

// Transfer API
app.post('/api/transfers', (req, res) => {
  const { type, sources, target } = req.body;
  if (!type || !sources || !target) return res.status(400).json({ error: 'Missing parameters' });

  const id = uuidv4();
  const task: TransferTask = {
    id,
    type,
    sources,
    target,
    status: 'pending',
    progress: 0,
    speed: '0B/s',
    startTime: new Date().toISOString()
  };

  transfers.set(id, task);
  executeTransfer(task);
  res.json(task);
});

app.get('/api/transfers', (req, res) => {
  res.json(Array.from(transfers.values()).reverse());
});

app.delete('/api/transfers/:id', (req, res) => {
  transfers.delete(req.params.id);
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

// Enhanced file listing with stats and recursive filter matching
const containsMatch = (dirPath: string, filter: string, depth = 0): boolean => {
  if (depth > 2) return false; // Limit depth for performance
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const f of files) {
      if (f.name.toLowerCase().includes(filter.toLowerCase())) return true;
      if (f.isDirectory()) {
        if (containsMatch(path.join(dirPath, f.name), filter, depth + 1)) return true;
      }
    }
  } catch (e) {
    return false;
  }
  return false;
};

app.get('/api/fs/list', (req, res) => {
  const queryPath = (req.query.path as string) || '/';
  const filter = (req.query.filter as string) || '';
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
        const isDir = f.isDirectory();
        return {
          name: f.name,
          path: fullPath,
          isDir,
          size: s.size,
          mtime: s.mtime,
          ext: path.extname(f.name).toLowerCase(),
          hasMatches: isDir && filter ? containsMatch(fullPath, filter) : false
        };
      } catch (e) {
        return {
          name: f.name,
          path: fullPath,
          isDir: f.isDirectory(),
          size: 0,
          mtime: new Date(0),
          ext: path.extname(f.name).toLowerCase(),
          hasMatches: false
        };
      }
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list directory' });
  }
});

// Helper for recursive hard linking with filtering
const linkRecursive = (source: string, target: string, filter: string, typeFilter: string) => {
  try {
    const stats = fs.statSync(source);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(source);
      let linkedAny = false;
      for (const file of files) {
        const childLinked = linkRecursive(path.join(source, file), path.join(target, file), filter, typeFilter);
        if (childLinked) linkedAny = true;
      }
      return linkedAny;
    } else {
      // It's a file. Check filter if provided.
      const nameMatch = !filter || source.toLowerCase().includes(filter.toLowerCase());
      let typeMatch = true;
      if (typeFilter && typeFilter !== 'all') {
        const ext = path.extname(source).toLowerCase();
        if (typeFilter === 'video') typeMatch = ['.mp4', '.mkv', '.avi', '.mov'].includes(ext);
        else if (typeFilter === 'image') typeMatch = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        else if (typeFilter === 'dir') typeMatch = false; // Should not happen for files
      }

      if (nameMatch && typeMatch) {
        const targetDir = path.dirname(target);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        if (!fs.existsSync(target)) {
          fs.linkSync(source, target);
        }
        return true;
      }
      return false;
    }
  } catch (e) {
    console.error(`Link error for ${source}:`, e);
    return false;
  }
};

// Create hard link (supports recursive for directories)
app.post('/api/fs/link', (req, res) => {
  const { source, target, filter, typeFilter } = req.body;
  if (!source || !target) return res.status(400).json({ error: 'Source and target are required' });

  try {
    const stats = fs.statSync(source);
    if (stats.isDirectory()) {
      const linkedAny = linkRecursive(source, target, filter || '', typeFilter || 'all');
      res.json({ success: true, linkedAny });
    } else {
      // Single file link
      const targetDir = path.dirname(target);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(target)) {
        return res.status(400).json({ error: 'Target already exists' });
      }

      fs.linkSync(source, target);
      res.json({ success: true });
    }
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
