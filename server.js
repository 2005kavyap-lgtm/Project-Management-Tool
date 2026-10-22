const express = require('express');
const http = require('node:http');
const path = require('node:path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { WebSocketServer, WebSocket } = require('ws');
const dbHelper = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'planpulse-secret-key-2026';

// Initialize Database
dbHelper.initDatabase();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// JWT Token Helper
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired session. Please sign in again.' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// WEBSOCKETS REAL-TIME ENGINE
// ==========================================
const connectedClients = new Set();

wss.on('connection', (ws) => {
  connectedClients.add(ws);

  ws.on('close', () => {
    connectedClients.delete(ws);
  });

  ws.on('error', () => {
    connectedClients.delete(ws);
  });
});

// Broadcast real-time message to all active boards/clients
function broadcastEvent(type, payload) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const existingUser = dbHelper.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const newUserId = dbHelper.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      role: role || 'Product Member'
    });

    const user = dbHelper.getUserById(newUserId);
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = dbHelper.getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      role: user.role,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: safeUser
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = dbHelper.getUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving profile.' });
  }
});

app.get('/api/users', authenticateToken, (req, res) => {
  try {
    const users = dbHelper.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching team members.' });
  }
});

// ==========================================
// 2. PROJECTS ROUTES
// ==========================================
app.get('/api/projects', authenticateToken, (req, res) => {
  try {
    const projects = dbHelper.getProjectsByUser(req.user.id);
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching projects.' });
  }
});

app.get('/api/projects/:id', authenticateToken, (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const project = dbHelper.getProjectById(projectId);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project board not found.' });
    }

    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching project details.' });
  }
});

app.post('/api/projects', authenticateToken, (req, res) => {
  try {
    const { title, description, color } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Project title is required.' });
    }

    const projectId = dbHelper.createProject({
      title,
      description,
      color: color || '#6366f1',
      ownerId: req.user.id
    });

    const project = dbHelper.getProjectById(projectId);

    broadcastEvent('PROJECT_CREATED', { project, creator: req.user.name });

    res.status(201).json({
      success: true,
      message: 'Project created successfully!',
      project
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating project.' });
  }
});

// ==========================================
// 3. TASKS ROUTES
// ==========================================
app.get('/api/projects/:projectId/tasks', authenticateToken, (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const tasks = dbHelper.getTasksByProject(projectId);
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching project tasks.' });
  }
});

app.get('/api/tasks/:id', authenticateToken, (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const task = dbHelper.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching task details.' });
  }
});

app.post('/api/projects/:projectId/tasks', authenticateToken, (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { title, description, status, priority, assignedTo, dueDate, label } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }

    const project = dbHelper.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project board not found.' });
    }

    let validAssignee = null;
    if (assignedTo) {
      const parsed = parseInt(assignedTo, 10);
      if (!isNaN(parsed) && parsed > 0) {
        const u = dbHelper.getUserById(parsed);
        if (u) validAssignee = parsed;
      }
    }

    const taskId = dbHelper.createTask({
      projectId,
      title: title.trim(),
      description: description ? description.trim() : '',
      status: status || 'todo',
      priority: priority || 'medium',
      assignedTo: validAssignee,
      dueDate: dueDate || null,
      label: label ? label.trim() : '',
      createdBy: req.user.id
    });

    const task = dbHelper.getTaskById(taskId);

    // Notify assignee if assigned to someone else
    if (task && task.assigned_to && task.assigned_to !== req.user.id) {
      try {
        dbHelper.createNotification({
          userId: task.assigned_to,
          senderId: req.user.id,
          title: 'Task Assigned',
          message: `${req.user.name} assigned you to "${task.title}".`,
          taskId: task.id
        });
      } catch (notifErr) {
        console.warn('Could not create notification:', notifErr.message);
      }
    }

    broadcastEvent('TASK_CREATED', { task, projectId });

    res.status(201).json({
      success: true,
      message: 'Task created!',
      task
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, message: 'Error creating task: ' + error.message });
  }
});

// Update Task Column / Status (Kanban drag and drop or status change)
app.patch('/api/tasks/:id/status', authenticateToken, (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { status, position = 0 } = req.body;

    const validStatuses = ['todo', 'in_progress', 'in_review', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid column status.' });
    }

    dbHelper.updateTaskStatus(taskId, status, position);
    const task = dbHelper.getTaskById(taskId);

    // Broadcast WebSocket real-time event
    broadcastEvent('TASK_MOVED', {
      taskId: task.id,
      projectId: task.project_id,
      status: task.status,
      position: task.position,
      movedBy: req.user.name
    });

    res.json({ success: true, message: 'Task moved.', task });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating task status.' });
  }
});

// Update Task Details
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { title, description, priority, assignedTo, dueDate, label } = req.body;

    dbHelper.updateTaskDetails(taskId, {
      title,
      description,
      priority,
      assignedTo: assignedTo ? parseInt(assignedTo, 10) : null,
      dueDate,
      label
    });

    const task = dbHelper.getTaskById(taskId);

    broadcastEvent('TASK_UPDATED', { task, projectId: task.project_id, updatedBy: req.user.name });

    res.json({ success: true, message: 'Task updated.', task });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating task details.' });
  }
});

// Delete Task
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const task = dbHelper.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const projectId = task.project_id;
    dbHelper.deleteTask(taskId);

    broadcastEvent('TASK_DELETED', { taskId, projectId, deletedBy: req.user.name });

    res.json({ success: true, message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting task.' });
  }
});

// ==========================================
// 4. COMMENTS ROUTES
// ==========================================
app.post('/api/tasks/:taskId/comments', authenticateToken, (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content cannot be empty.' });
    }

    const comment = dbHelper.addComment(taskId, req.user.id, content);
    const task = dbHelper.getTaskById(taskId);

    // Notify assignee if someone else commented
    if (task.assigned_to && task.assigned_to !== req.user.id) {
      dbHelper.createNotification({
        userId: task.assigned_to,
        senderId: req.user.id,
        title: 'New Comment on Task',
        message: `${req.user.name} commented on "${task.title}".`,
        taskId: task.id
      });
    }

    broadcastEvent('COMMENT_ADDED', { comment, taskId, projectId: task.project_id });

    res.status(201).json({ success: true, comment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding comment.' });
  }
});

app.delete('/api/comments/:id', authenticateToken, (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    const deleted = dbHelper.deleteComment(commentId, req.user.id);

    if (!deleted) {
      return res.status(403).json({ success: false, message: 'Unauthorized or comment not found.' });
    }

    res.json({ success: true, message: 'Comment deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting comment.' });
  }
});

// ==========================================
// 5. NOTIFICATIONS ROUTES
// ==========================================
app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const notifications = dbHelper.getNotificationsByUser(req.user.id);
    const unreadCount = notifications.filter(n => !n.is_read).length;
    res.json({ success: true, unreadCount, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching notifications.' });
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, (req, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    dbHelper.markNotificationRead(notifId, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.patch('/api/notifications/read-all', authenticateToken, (req, res) => {
  try {
    dbHelper.markAllNotificationsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// Start Server on Port 4000
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 PlanPulse Project Management Server is running!`);
  console.log(`📡 Local URL: http://localhost:${PORT}`);
  console.log(`⚡ WebSocket Server active for real-time collaboration`);
  console.log(`👥 Demo Accounts:`);
  console.log(`   - sarah@planpulse.io / password123 (Tech Lead)`);
  console.log(`   - alex@planpulse.io / password123 (Senior Dev)`);
  console.log(`   - elena@planpulse.io / password123 (Lead Designer)`);
  console.log(`   - marcus@planpulse.io / password123 (DevOps)`);
  console.log(`====================================================`);
});
