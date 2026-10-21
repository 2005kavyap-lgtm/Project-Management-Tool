const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'planpulse.db');
const db = new DatabaseSync(dbPath);

function initDatabase() {
  db.exec('PRAGMA foreign_keys = ON;');

  // Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      role TEXT DEFAULT 'Product Member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Projects Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#4f46e5',
      owner_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Project Members Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Tasks Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      assigned_to INTEGER,
      due_date DATE,
      label TEXT DEFAULT '',
      created_by INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Comments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Notifications Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      task_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  seedData();
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, avatar_url, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  const u1 = insertUser.run(
    'Sarah Chen',
    'sarah@planpulse.io',
    passwordHash,
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'Frontend Architect'
  ).lastInsertRowid;

  const u2 = insertUser.run(
    'Alex Rivera',
    'alex@planpulse.io',
    passwordHash,
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    'Senior Full-Stack Engineer'
  ).lastInsertRowid;

  const u3 = insertUser.run(
    'Elena Rostova',
    'elena@planpulse.io',
    passwordHash,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'Lead Product Designer'
  ).lastInsertRowid;

  const u4 = insertUser.run(
    'Marcus Vance',
    'marcus@planpulse.io',
    passwordHash,
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    'DevOps & Infrastructure'
  ).lastInsertRowid;

  // Insert Projects
  const insertProject = db.prepare(`
    INSERT INTO projects (title, description, color, owner_id)
    VALUES (?, ?, ?, ?)
  `);

  const p1 = insertProject.run(
    'Next-Gen Mobile App 2.0',
    'Complete cross-platform redesign with real-time sync, dark mode, and biometric authentication.',
    '#6366f1',
    u1
  ).lastInsertRowid;

  const p2 = insertProject.run(
    'Cloud Infrastructure & CI/CD',
    'Container orchestration, automated staging deployment pipelines, and zero-downtime database migrations.',
    '#0ea5e9',
    u4
  ).lastInsertRowid;

  const p3 = insertProject.run(
    'Unified Design System',
    'Figma to React component token synchronization, accessible micro-interactions, and documentation site.',
    '#ec4899',
    u3
  ).lastInsertRowid;

  // Insert Project Members
  const insertMember = db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`);
  [u1, u2, u3, u4].forEach(uid => {
    insertMember.run(p1, uid, uid === u1 ? 'owner' : 'collaborator');
    insertMember.run(p2, uid, uid === u4 ? 'owner' : 'collaborator');
    insertMember.run(p3, uid, uid === u3 ? 'owner' : 'collaborator');
  });

  // Insert Tasks for Project 1
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, label, created_by, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const t1 = insertTask.run(
    p1,
    'Design accessible dark mode palette & high contrast tokens',
    'Establish WCAG AAA compliant contrast ratios for background, cards, text, and active action buttons.',
    'todo',
    'high',
    u3,
    '2026-10-25',
    'UI/UX',
    u1,
    0
  ).lastInsertRowid;

  const t2 = insertTask.run(
    p1,
    'Configure automated CI/CD pipeline with GitHub Actions',
    'Write workflows to run linter, automated unit test suites, and deploy to staging clusters.',
    'todo',
    'medium',
    u4,
    '2026-10-28',
    'DevOps',
    u1,
    1
  ).lastInsertRowid;

  const t3 = insertTask.run(
    p1,
    'Implement WebSockets for live board synchronization',
    'Broadcast real-time card moves, status changes, and new comments across all active team members simultaneously.',
    'in_progress',
    'urgent',
    u2,
    '2026-10-22',
    'Backend',
    u1,
    0
  ).lastInsertRowid;

  const t4 = insertTask.run(
    p1,
    'Build responsive Kanban drag-and-drop board layout',
    'Create smooth card movement across To Do, In Progress, In Review, and Done columns with mobile touch support.',
    'in_progress',
    'high',
    u1,
    '2026-10-23',
    'Frontend',
    u1,
    1
  ).lastInsertRowid;

  const t5 = insertTask.run(
    p1,
    'Optimize database queries with indexing for rapid loading',
    'Benchmark SQLite queries on large task boards and add composite indexes for project_id and status.',
    'in_review',
    'medium',
    u2,
    '2026-10-20',
    'Performance',
    u1,
    0
  ).lastInsertRowid;

  const t6 = insertTask.run(
    p1,
    'User authentication & JWT security validation',
    'Verify password hashing with bcrypt, issue tamper-proof tokens, and protect private API endpoints.',
    'done',
    'high',
    u1,
    '2026-10-18',
    'Security',
    u1,
    0
  ).lastInsertRowid;

  const t7 = insertTask.run(
    p1,
    'Project workspace architecture & schema definition',
    'Designed relational schemas for users, boards, tasks, comments, and real-time notification feeds.',
    'done',
    'medium',
    u2,
    '2026-10-17',
    'Architecture',
    u1,
    1
  ).lastInsertRowid;

  // Insert Comments
  const insertComment = db.prepare(`INSERT INTO comments (task_id, user_id, content, created_at) VALUES (?, ?, ?, ?)`);
  insertComment.run(t3, u1, 'Make sure we include heartbeats so inactive sockets cleanly reconnect!', '2026-10-19 10:15:00');
  insertComment.run(t3, u2, 'Added! Handled reconnect logic and instant card dispatching.', '2026-10-19 11:30:00');
  insertComment.run(t4, u3, 'Cards are looking super sleek! Love the subtle border radius and priority badge colors.', '2026-10-19 12:00:00');

  // Insert Notifications
  const insertNotif = db.prepare(`INSERT INTO notifications (user_id, sender_id, title, message, task_id) VALUES (?, ?, ?, ?, ?)`);
  insertNotif.run(u1, u2, 'Task Updated', 'Alex moved "Implement WebSockets" to In Progress.', t3);
  insertNotif.run(u1, u3, 'New Comment', 'Elena commented on "Build responsive Kanban drag-and-drop board".', t4);
  insertNotif.run(u2, u1, 'Task Assigned', 'Sarah assigned you to "Optimize database queries".', t5);

  console.log('✔ PlanPulse database initialized with sample users, projects, Kanban boards, and comments.');
}

module.exports = {
  db,
  initDatabase,

  // Users
  getUserByEmail: (email) => {
    return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  },
  getUserById: (id) => {
    return db.prepare('SELECT id, name, email, avatar_url, role, created_at FROM users WHERE id = ?').get(id);
  },
  getAllUsers: () => {
    return db.prepare('SELECT id, name, email, avatar_url, role FROM users ORDER BY name ASC').all();
  },
  createUser: ({ name, email, password_hash, avatar_url = '', role = 'Developer' }) => {
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, avatar_url, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    const res = stmt.run(name.trim(), email.trim().toLowerCase(), password_hash, avatar_url || defaultAvatar, role);
    return res.lastInsertRowid;
  },

  // Projects
  getProjectsByUser: (userId) => {
    const sql = `
      SELECT p.*, 
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ?
      ORDER BY p.id ASC
    `;
    return db.prepare(sql).all(userId);
  },
  getProjectById: (projectId) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return null;

    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_url, u.role, pm.role as project_role
      FROM users u
      JOIN project_members pm ON u.id = pm.user_id
      WHERE pm.project_id = ?
    `).all(projectId);

    return { ...project, members };
  },
  createProject: ({ title, description, color = '#6366f1', ownerId }) => {
    const stmt = db.prepare(`INSERT INTO projects (title, description, color, owner_id) VALUES (?, ?, ?, ?)`);
    const res = stmt.run(title.trim(), description ? description.trim() : '', color, ownerId);
    const projectId = res.lastInsertRowid;

    // Add owner as member
    db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')`).run(projectId, ownerId);

    // Auto-add other team members so group collaboration works out of the box
    const allUsers = db.prepare('SELECT id FROM users WHERE id != ?').all(ownerId);
    for (const u of allUsers) {
      db.prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')`).run(projectId, u.id);
    }

    return projectId;
  },

  // Tasks
  getTasksByProject: (projectId) => {
    const sql = `
      SELECT 
        t.*,
        u.name as assignee_name,
        u.avatar_url as assignee_avatar,
        (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comments_count
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = ?
      ORDER BY t.position ASC, t.id ASC
    `;
    return db.prepare(sql).all(projectId);
  },
  getTaskById: (taskId) => {
    const sql = `
      SELECT 
        t.*,
        u.name as assignee_name,
        u.avatar_url as assignee_avatar,
        u.email as assignee_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `;
    const task = db.prepare(sql).get(taskId);
    if (!task) return null;

    const comments = db.prepare(`
      SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `).all(taskId);

    return { ...task, comments };
  },
  createTask: ({ projectId, title, description = '', status = 'todo', priority = 'medium', assignedTo = null, dueDate = null, label = '', createdBy }) => {
    const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) as maxPos FROM tasks WHERE project_id = ? AND status = ?').get(projectId, status).maxPos;
    const stmt = db.prepare(`
      INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, label, created_by, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(projectId, title.trim(), description ? description.trim() : '', status, priority, assignedTo || null, dueDate || null, label ? label.trim() : '', createdBy, maxPos + 1);
    return res.lastInsertRowid;
  },
  updateTaskStatus: (taskId, newStatus, newPosition = 0) => {
    db.prepare('UPDATE tasks SET status = ?, position = ? WHERE id = ?').run(newStatus, newPosition, taskId);
  },
  updateTaskDetails: (taskId, { title, description, priority, assignedTo, dueDate, label }) => {
    const stmt = db.prepare(`
      UPDATE tasks
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          priority = COALESCE(?, priority),
          assigned_to = COALESCE(?, assigned_to),
          due_date = COALESCE(?, due_date),
          label = COALESCE(?, label)
      WHERE id = ?
    `);
    stmt.run(title, description, priority, assignedTo, dueDate, label, taskId);
  },
  deleteTask: (taskId) => {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  },

  // Comments
  addComment: (taskId, userId, content) => {
    const stmt = db.prepare(`INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)`);
    const res = stmt.run(taskId, userId, content.trim());
    return db.prepare(`
      SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(res.lastInsertRowid);
  },
  deleteComment: (commentId, userId) => {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment || comment.user_id !== userId) return false;
    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    return true;
  },

  // Notifications
  getNotificationsByUser: (userId) => {
    return db.prepare(`
      SELECT n.*, u.name as sender_name, u.avatar_url as sender_avatar
      FROM notifications n
      LEFT JOIN users u ON n.sender_id = u.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 25
    `).all(userId);
  },
  createNotification: ({ userId, senderId = null, title, message, taskId = null }) => {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, sender_id, title, message, task_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const res = stmt.run(userId, senderId, title, message, taskId);
    return res.lastInsertRowid;
  },
  markNotificationRead: (notifId, userId) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notifId, userId);
  },
  markAllNotificationsRead: (userId) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  }
};
