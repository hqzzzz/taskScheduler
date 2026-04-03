import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3000;
const TASKS_FILE = path.join(process.cwd(), 'tasks.json');
const LOGS_FILE = path.join(process.cwd(), 'logs.json');

app.use(express.json());

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
    const files = fs.readdirSync(dir, { withFileTypes: true });
    const suggestions = files
      .filter(f => f.name.startsWith(base))
      .map(f => ({
        name: f.name,
        path: path.join(dir, f.name),
        isDir: f.isDirectory()
      }))
      .slice(0, 20); // Limit to 20 suggestions
    res.json(suggestions);
  } catch (e) {
    res.json([]);
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
