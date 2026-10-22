/**
 * PlanPulse - Core Client Application Logic
 * Kanban Drag-and-Drop, WebSockets Live Collaboration, Task Modals & Comments
 */

const App = {
  user: null,
  token: localStorage.getItem('planpulse_token') || null,
  projects: [],
  activeProject: null,
  tasks: [],
  users: [],
  socket: null,
  activeTaskId: null
};

// ==========================================
// 1. TOAST NOTIFICATIONS
// ==========================================
function showToast(message, icon = 'ℹ️') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// 2. AUTHENTICATION LOGIC
// ==========================================
async function checkAuth() {
  if (!App.token) {
    const explicitlyLoggedOut = localStorage.getItem('planpulse_logged_out') === 'true';
    if (!explicitlyLoggedOut) {
      // Auto demo sign in as Sarah Chen (Tech Lead) for seamless instant experience
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'sarah@planpulse.io', password: 'password123' })
        });
        const data = await res.json();
        if (data.success && data.token) {
          App.token = data.token;
          App.user = data.user;
          localStorage.setItem('planpulse_token', data.token);
          updateUserSidebar();
          initWebSocket();
          await loadTeamMembers();
          await loadProjects();
          loadNotifications();
          return;
        }
      } catch (e) {
        console.warn('Auto demo sign-in error:', e);
      }
    }
    updateUserSidebar();
    openAuthModal();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${App.token}` }
    });
    const data = await res.json();

    if (data.success && data.user) {
      App.user = data.user;
      updateUserSidebar();
      initWebSocket();
      await loadTeamMembers();
      await loadProjects();
      loadNotifications();
    } else {
      logout(false);
    }
  } catch (err) {
    console.warn('Auth check error:', err);
    updateUserSidebar();
    openAuthModal();
  }
}

function updateUserSidebar() {
  const userElem = document.getElementById('sidebarUserArea');
  if (!userElem) return;

  if (App.user) {
    userElem.innerHTML = `
      <div class="sidebar-user">
        <img src="${App.user.avatar_url}" alt="${App.user.name}" class="user-avatar" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=user'">
        <div class="user-meta">
          <div class="user-name">${App.user.name}</div>
          <div class="user-role">${App.user.role || 'Member'}</div>
        </div>
        <button class="btn-logout" onclick="logout()" title="Sign Out">🚪</button>
      </div>
    `;
  } else {
    userElem.innerHTML = `
      <div style="padding: 1rem 1.25rem; border-top: 1px solid #1e293b;">
        <button class="btn-primary" style="width: 100%; justify-content: center; font-size: 0.8rem;" onclick="openAuthModal('login')">
          Sign In
        </button>
      </div>
    `;
  }
}

function openAuthModal(tab = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('active');
  switchAuthTab(tab);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('tabLoginBtn');
  const tabReg = document.getElementById('tabRegBtn');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
    tabLogin.style.color = 'var(--primary)';
    tabReg.style.color = 'var(--text-muted)';
  } else {
    loginForm.style.display = 'none';
    regForm.style.display = 'block';
    tabLogin.style.color = 'var(--text-muted)';
    tabReg.style.color = 'var(--primary)';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.success) {
      App.token = data.token;
      App.user = data.user;
      localStorage.setItem('planpulse_token', data.token);
      localStorage.removeItem('planpulse_logged_out');
      showToast(data.message, '👋');
      closeAuthModal();
      checkAuth();
    } else {
      showToast(data.message || 'Login failed', '❌');
    }
  } catch (err) {
    showToast('Network error during login.', '⚠️');
  }
}

async function handleRegister(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value.trim();

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();

    if (data.success) {
      App.token = data.token;
      App.user = data.user;
      localStorage.setItem('planpulse_token', data.token);
      localStorage.removeItem('planpulse_logged_out');
      showToast('Account created! Welcome to PlanPulse.', '🎉');
      closeAuthModal();
      checkAuth();
    } else {
      showToast(data.message || 'Registration failed', '❌');
    }
  } catch (err) {
    showToast('Network error registering account.', '⚠️');
  }
}

function logout(notify = true) {
  App.user = null;
  App.token = null;
  App.activeProject = null;
  localStorage.removeItem('planpulse_token');
  localStorage.setItem('planpulse_logged_out', 'true');
  if (App.socket) App.socket.close();
  updateUserSidebar();
  renderProjectsSidebar();
  renderKanbanBoard();
  if (notify) showToast('Signed out.', 'ℹ️');
  openAuthModal('login');
}

function fillDemoAccount(email) {
  switchAuthTab('login');
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = 'password123';
}

// ==========================================
// 3. WEBSOCKET REAL-TIME SYNC
// ==========================================
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  try {
    App.socket = new WebSocket(wsUrl);

    App.socket.onopen = () => {
      console.log('⚡ Connected to PlanPulse real-time WebSocket');
      const badge = document.getElementById('liveStatusBadge');
      if (badge) badge.style.display = 'inline-flex';
    };

    App.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleRealTimeEvent(data);
      } catch (e) {
        console.warn('WS parse error:', e);
      }
    };

    App.socket.onclose = () => {
      console.log('WS closed, reconnecting in 3s...');
      setTimeout(initWebSocket, 3000);
    };
  } catch (e) {
    console.warn('WebSocket init error:', e);
  }
}

function handleRealTimeEvent({ type, payload }) {
  if (!App.activeProject) return;

  switch (type) {
    case 'TASK_CREATED':
      if (payload.projectId === App.activeProject.id) {
        App.tasks.push(payload.task);
        renderKanbanBoard();
        showToast(`New task added: "${payload.task.title}"`, '📌');
      }
      break;

    case 'TASK_MOVED':
      if (payload.projectId === App.activeProject.id) {
        const task = App.tasks.find(t => t.id === payload.taskId);
        if (task) {
          task.status = payload.status;
          task.position = payload.position;
          renderKanbanBoard();
          showToast(`Task moved by ${payload.movedBy}`, '⚡');
        }
      }
      break;

    case 'TASK_UPDATED':
      if (payload.projectId === App.activeProject.id) {
        const idx = App.tasks.findIndex(t => t.id === payload.task.id);
        if (idx !== -1) {
          App.tasks[idx] = payload.task;
          renderKanbanBoard();
        }
        if (App.activeTaskId === payload.task.id) {
          loadTaskDetails(payload.task.id);
        }
      }
      break;

    case 'TASK_DELETED':
      if (payload.projectId === App.activeProject.id) {
        App.tasks = App.tasks.filter(t => t.id !== payload.taskId);
        renderKanbanBoard();
        if (App.activeTaskId === payload.taskId) {
          closeTaskModal();
        }
      }
      break;

    case 'COMMENT_ADDED':
      if (App.activeTaskId === payload.taskId) {
        loadTaskDetails(payload.taskId);
      }
      const task = App.tasks.find(t => t.id === payload.taskId);
      if (task) {
        task.comments_count = (task.comments_count || 0) + 1;
        renderKanbanBoard();
      }
      break;

    case 'PROJECT_CREATED':
      loadProjects(false);
      break;
  }
}

// ==========================================
// 4. PROJECTS LOGIC
// ==========================================
async function loadProjects(autoSelectFirst = true) {
  try {
    const res = await fetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${App.token}` }
    });
    const data = await res.json();

    if (data.success && data.projects) {
      App.projects = data.projects;
      renderProjectsSidebar();

      if (autoSelectFirst && data.projects.length > 0 && !App.activeProject) {
        selectProject(data.projects[0].id);
      }
    }
  } catch (err) {
    console.warn('Error loading projects:', err);
  }
}

function renderProjectsSidebar() {
  const container = document.getElementById('projectsListContainer');
  if (!container) return;

  container.innerHTML = App.projects.map(p => `
    <div class="project-item ${App.activeProject && App.activeProject.id === p.id ? 'active' : ''}" onclick="selectProject(${p.id})">
      <div class="project-dot" style="background-color: ${p.color || '#6366f1'};"></div>
      <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.title}</span>
      <span style="font-size: 0.75rem; color: #64748b;">${p.task_count || 0}</span>
    </div>
  `).join('');
}

async function selectProject(projectId) {
  const project = App.projects.find(p => p.id === projectId);
  if (!project) return;

  App.activeProject = project;
  renderProjectsSidebar();

  const titleElem = document.getElementById('currentProjectTitle');
  if (titleElem) {
    titleElem.innerHTML = `
      <span class="project-dot" style="background-color: ${project.color}; width: 12px; height: 12px;"></span>
      <span>${project.title}</span>
    `;
  }

  await loadProjectTasks(projectId);
}

async function loadTeamMembers() {
  try {
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${App.token}` }
    });
    const data = await res.json();
    if (data.success && data.users) {
      App.users = data.users;
      populateAssigneeDropdowns();
    }
  } catch (err) {
    console.warn('Error loading team members:', err);
  }
}

function populateAssigneeDropdowns() {
  const selects = [document.getElementById('newTaskAssignee'), document.getElementById('editTaskAssignee')];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = `
      <option value="">Unassigned</option>
      ${App.users.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join('')}
    `;
  });
}

async function handleCreateProject(e) {
  e.preventDefault();
  const title = document.getElementById('newProjectTitle').value.trim();
  const description = document.getElementById('newProjectDesc').value.trim();
  const color = document.getElementById('newProjectColor').value;

  if (!title) return;

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${App.token}`
      },
      body: JSON.stringify({ title, description, color })
    });
    const data = await res.json();

    if (data.success && data.project) {
      document.getElementById('newProjectTitle').value = '';
      document.getElementById('newProjectDesc').value = '';
      closeModal('projectModal');
      showToast('Project board created!', '🎉');
      await loadProjects(false);
      selectProject(data.project.id);
    }
  } catch (err) {
    showToast('Failed to create project.', '⚠️');
  }
}

// ==========================================
// 5. KANBAN BOARD & TASKS LOGIC
// ==========================================
async function loadProjectTasks(projectId) {
  try {
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      headers: { 'Authorization': `Bearer ${App.token}` }
    });
    const data = await res.json();

    if (data.success && data.tasks) {
      App.tasks = data.tasks;
      renderKanbanBoard();
    }
  } catch (err) {
    console.warn('Error loading tasks:', err);
  }
}

function renderKanbanBoard() {
  const columns = {
    todo: document.getElementById('cards-todo'),
    in_progress: document.getElementById('cards-in_progress'),
    in_review: document.getElementById('cards-in_review'),
    done: document.getElementById('cards-done')
  };

  const counts = {
    todo: document.getElementById('count-todo'),
    in_progress: document.getElementById('count-in_progress'),
    in_review: document.getElementById('count-in_review'),
    done: document.getElementById('count-done')
  };

  // Reset columns
  Object.values(columns).forEach(col => { if (col) col.innerHTML = ''; });

  const columnItems = { todo: [], in_progress: [], in_review: [], done: [] };

  App.tasks.forEach(task => {
    if (columnItems[task.status]) {
      columnItems[task.status].push(task);
    } else {
      columnItems['todo'].push(task);
    }
  });

  // Update counters
  Object.keys(counts).forEach(status => {
    if (counts[status]) counts[status].textContent = columnItems[status].length;
  });

  // Populate cards
  Object.keys(columns).forEach(status => {
    const col = columns[status];
    if (!col) return;

    if (columnItems[status].length === 0) {
      col.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-light); font-size: 0.8rem;">
          No tasks in this column
        </div>
      `;
      return;
    }

    col.innerHTML = columnItems[status].map(task => `
      <div class="task-card" draggable="true" data-id="${task.id}" onclick="openTaskModal(${task.id})" ondragstart="handleDragStart(event, ${task.id})">
        <div class="card-top-row">
          <span class="priority-badge priority-${task.priority}">${task.priority}</span>
          ${task.label ? `<span class="card-label">${task.label}</span>` : ''}
        </div>

        <div class="card-title">${task.title}</div>

        <div class="card-bottom-row">
          <div class="card-meta-left">
            ${task.due_date ? `<span>📅 ${formatDueDate(task.due_date)}</span>` : ''}
            <span>💬 ${task.comments_count || 0}</span>
          </div>
          ${task.assignee_name ? `
            <img src="${task.assignee_avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + task.assignee_name}" alt="${task.assignee_name}" class="assignee-avatar" title="Assigned to ${task.assignee_name}">
          ` : `
            <span style="font-size: 0.7rem; color: var(--text-light);">Unassigned</span>
          `}
        </div>
      </div>
    `).join('');
  });
}

function formatDueDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Drag and drop handlers
let draggedTaskId = null;

function handleDragStart(e, taskId) {
  draggedTaskId = taskId;
  e.dataTransfer.setData('text/plain', taskId);
  e.target.classList.add('dragging');
}

document.addEventListener('dragend', (e) => {
  if (e.target.classList) e.target.classList.remove('dragging');
});

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e, targetStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  const taskId = draggedTaskId || parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (!taskId) return;

  const task = App.tasks.find(t => t.id === taskId);
  if (!task || task.status === targetStatus) return;

  // Optimistic UI update
  task.status = targetStatus;
  renderKanbanBoard();

  try {
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${App.token}`
      },
      body: JSON.stringify({ status: targetStatus })
    });
    const data = await res.json();
    if (!data.success) {
      loadProjectTasks(App.activeProject.id);
    }
  } catch (err) {
    loadProjectTasks(App.activeProject.id);
  }
}

// ==========================================
// 6. TASK MODAL & COMMENTS
// ==========================================
let quickAddColumnStatus = 'todo';

function openQuickAddTask(status = 'todo') {
  if (!App.token || !App.user) {
    showToast('Please sign in with a demo account first.', '🔒');
    openAuthModal('login');
    return;
  }

  if (!App.activeProject) {
    if (App.projects && App.projects.length > 0) {
      selectProject(App.projects[0].id);
    } else {
      showToast('Please create a project board first.', '📁');
      openModal('projectModal');
      return;
    }
  }

  quickAddColumnStatus = status;
  const statusInput = document.getElementById('newTaskStatus');
  if (statusInput) statusInput.value = status;
  openModal('newTaskModal');

  setTimeout(() => {
    const titleInput = document.getElementById('newTaskTitle');
    if (titleInput) titleInput.focus();
  }, 100);
}

async function handleCreateTask(e) {
  if (e) e.preventDefault();

  if (!App.token || !App.user) {
    showToast('Please sign in to add tasks.', '🔒');
    openAuthModal('login');
    return;
  }

  if (!App.activeProject) {
    if (App.projects && App.projects.length > 0) {
      selectProject(App.projects[0].id);
    } else {
      showToast('Please select or create a project board first.', '📁');
      openModal('projectModal');
      return;
    }
  }

  const titleInput = document.getElementById('newTaskTitle');
  const descInput = document.getElementById('newTaskDesc');
  const statusInput = document.getElementById('newTaskStatus');
  const priorityInput = document.getElementById('newTaskPriority');
  const assigneeInput = document.getElementById('newTaskAssignee');
  const dueDateInput = document.getElementById('newTaskDueDate');
  const labelInput = document.getElementById('newTaskLabel');

  const title = titleInput ? titleInput.value.trim() : '';
  const description = descInput ? descInput.value.trim() : '';
  const status = statusInput ? statusInput.value : 'todo';
  const priority = priorityInput ? priorityInput.value : 'medium';
  const assignedTo = assigneeInput ? assigneeInput.value : '';
  const dueDate = dueDateInput ? dueDateInput.value : '';
  const label = labelInput ? labelInput.value.trim() : '';

  if (!title) {
    showToast('Please enter a task title.', '⚠️');
    if (titleInput) titleInput.focus();
    return;
  }

  const submitBtn = document.getElementById('btnSubmitCreateTask') || document.querySelector('#createTaskForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding Task...';
  }

  try {
    const res = await fetch(`/api/projects/${App.activeProject.id}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${App.token}`
      },
      body: JSON.stringify({ title, description, status, priority, assignedTo, dueDate, label })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const form = document.getElementById('createTaskForm');
      if (form) form.reset();
      closeModal('newTaskModal');
      showToast('Task added to board!', '📌');
      await loadProjectTasks(App.activeProject.id);
      await loadProjects(false);
    } else {
      showToast(data.message || 'Failed to create task.', '❌');
      if (res.status === 401 || res.status === 403) {
        openAuthModal('login');
      }
    }
  } catch (err) {
    console.error('Task creation error:', err);
    showToast('Network error while adding task.', '⚠️');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Task';
    }
  }
}

async function openTaskModal(taskId) {
  App.activeTaskId = taskId;
  openModal('taskDetailModal');
  loadTaskDetails(taskId);
}

async function loadTaskDetails(taskId) {
  try {
    const res = await fetch(`/api/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${App.token}` }
    });
    const data = await res.json();

    if (data.success && data.task) {
      const task = data.task;
      document.getElementById('detailTaskTitle').value = task.title;
      document.getElementById('detailTaskDesc').value = task.description || '';
      document.getElementById('detailTaskStatus').value = task.status;
      document.getElementById('detailTaskPriority').value = task.priority;
      document.getElementById('editTaskAssignee').value = task.assigned_to || '';
      document.getElementById('detailTaskDueDate').value = task.due_date || '';
      document.getElementById('detailTaskLabel').value = task.label || '';

      renderComments(task.comments || []);
    }
  } catch (err) {
    console.warn('Error loading task details:', err);
  }
}

function renderComments(comments) {
  const container = document.getElementById('taskCommentsContainer');
  if (!container) return;

  if (comments.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-light); font-size: 0.8rem; padding: 1rem;">No comments yet. Start the conversation!</div>`;
    return;
  }

  container.innerHTML = comments.map(c => `
    <div class="comment-bubble">
      <div class="comment-meta">
        <strong style="color: var(--text-main);">${c.author_name}</strong>
        <span>•</span>
        <span>${formatCommentTime(c.created_at)}</span>
      </div>
      <div>${c.content}</div>
    </div>
  `).join('');
}

function formatCommentTime(dateStr) {
  const d = new Date(dateStr.replace(' ', 'T'));
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function handleSaveTaskDetails() {
  if (!App.activeTaskId) return;

  const title = document.getElementById('detailTaskTitle').value.trim();
  const description = document.getElementById('detailTaskDesc').value.trim();
  const priority = document.getElementById('detailTaskPriority').value;
  const assignedTo = document.getElementById('editTaskAssignee').value;
  const dueDate = document.getElementById('detailTaskDueDate').value;
  const label = document.getElementById('detailTaskLabel').value.trim();

  try {
    const res = await fetch(`/api/tasks/${App.activeTaskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${App.token}`
      },
      body: JSON.stringify({ title, description, priority, assignedTo, dueDate, label })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Task details updated.', '💾');
      loadProjectTasks(App.activeProject.id);
    }
  } catch (err) {
    showToast('Failed to save task.', '⚠️');
  }
}

async function handleDeleteCurrentTask() {
  if (!App.activeTaskId || !confirm('Are you sure you want to delete this task?')) return;

  try {
    const res = await fetch(`/api/tasks/${App.activeTaskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${App.token}` }
    });
    const data = await res.json();
    if (data.success) {
      closeTaskModal();
      showToast('Task deleted.', '🗑️');
      loadProjectTasks(App.activeProject.id);
    }
  } catch (err) {
    showToast('Failed to delete task.', '⚠️');
  }
}

async function handleAddComment() {
  if (!App.activeTaskId) return;
  const input = document.getElementById('newCommentInput');
  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await fetch(`/api/tasks/${App.activeTaskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${App.token}`
      },
      body: JSON.stringify({ content })
    });
    const data = await res.json();

    if (data.success) {
      input.value = '';
      loadTaskDetails(App.activeTaskId);
    }
  } catch (err) {
    showToast('Failed to post comment.', '⚠️');
  }
}

function closeTaskModal() {
  App.activeTaskId = null;
  closeModal('taskDetailModal');
}

// ==========================================
// 7. NOTIFICATIONS
// ==========================================
async function loadNotifications() {
  try {
    const res = await fetch('/api/notifications', {
      headers: { 'Authorization': `Bearer ${App.token}` }
    });
    const data = await res.json();

    if (data.success && data.notifications) {
      const badge = document.getElementById('notifBadge');
      if (badge) {
        if (data.unreadCount > 0) {
          badge.textContent = data.unreadCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      const list = document.getElementById('notificationsList');
      if (list) {
        if (data.notifications.length === 0) {
          list.innerHTML = `<div style="text-align: center; color: var(--text-light); font-size: 0.8rem; padding: 1.5rem;">No notifications</div>`;
          return;
        }

        list.innerHTML = data.notifications.map(n => `
          <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); background: ${n.is_read ? 'transparent' : 'var(--primary-light)'}; border-radius: var(--radius-sm); font-size: 0.85rem;">
            <div style="font-weight: 700; color: var(--text-main); margin-bottom: 2px;">${n.title}</div>
            <div style="color: var(--text-muted);">${n.message}</div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.warn('Error loading notifications:', err);
  }
}

function toggleNotificationsDrawer() {
  const drawer = document.getElementById('notificationsDrawer');
  if (!drawer) return;
  drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';

  if (drawer.style.display === 'block') {
    fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${App.token}` }
    }).then(() => {
      const badge = document.getElementById('notifBadge');
      if (badge) badge.style.display = 'none';
    });
  }
}

// Helpers
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// ==========================================
// 8. INITIALIZATION
// ==========================================
function initializeApp() {
  checkAuth();

  // Project form
  const projForm = document.getElementById('createProjectForm');
  if (projForm) projForm.addEventListener('submit', handleCreateProject);

  // Task form
  const taskForm = document.getElementById('createTaskForm');
  if (taskForm) taskForm.addEventListener('submit', handleCreateTask);

  // Auth forms
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const regForm = document.getElementById('registerForm');
  if (regForm) regForm.addEventListener('submit', handleRegister);

  // Close modals on background click (except auth modal if user is not logged in)
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (overlay.id === 'authModal' && !App.token) return;
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
