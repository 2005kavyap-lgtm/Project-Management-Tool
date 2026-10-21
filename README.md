# ⚡ PlanPulse — Collaborative Project Management Tool

> A modern, full-stack, real-time project management and Kanban platform inspired by Asana, Linear, and Trello.

![PlanPulse Board Preview](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80)

---

## 🌟 Key Features

- **🔐 Robust User Authentication**:
  - Secure registration and login powered by **JSON Web Tokens (JWT)** and **bcryptjs** password hashing.
  - Role-based team member profiles with avatar support.
- **📁 Group Projects & Workspaces**:
  - Create and manage multiple concurrent project boards with custom theme colors.
  - Team collaboration across projects with individual ownership and membership.
- **📋 Interactive Drag-and-Drop Kanban Board**:
  - 4 Kanban workflow columns: **To Do**, **In Progress**, **In Review**, and **Done**.
  - Native HTML5 drag-and-drop mechanics with optimistic UI updates.
  - Instant position and status persistence via REST APIs.
- **🎯 Comprehensive Task Management**:
  - Color-coded priority tags (**Urgent**, **High**, **Medium**, **Low**).
  - Categorization labels (Frontend, Backend, Design, Infrastructure, etc.).
  - Assign tasks directly to specific teammates.
  - Calendar due-date tracking with formatted milestones.
- **💬 Real-Time Discussion Threads**:
  - In-task comments feed for team communication and status updates.
  - Timestamps, author identities, and live badge counters.
- **⚡ WebSocket Real-Time Synchronization (Bonus Feature)**:
  - Live bi-directional updates powered by WebSockets (`ws`).
  - Tasks created, moved, edited, or commented on instantly reflect on all connected team members' screens without refreshing.
  - Visual pulse badge indicating live real-time connection status.
- **🔔 Activity Notifications Center**:
  - In-app notification drawer alerting members to assignments and project activity.
  - Unread count badge with one-click "mark as read".

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Real-Time Communication**: WebSockets (`ws`)
- **Database**: SQLite (Node.js native `node:sqlite` DatabaseSync)
- **Security & Auth**: JWT (`jsonwebtoken`), `bcryptjs`, CORS
- **Frontend**: Vanilla HTML5, Modern CSS3 Design System, Modular JavaScript ES6+

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- npm (Node Package Manager)

### 2. Installation & Setup
```bash
# Clone the repository
git clone https://github.com/2005kavyap-lgtm/CodeAlpha-Project-Management-Tool.git
cd CodeAlpha-Project-Management-Tool

# Install dependencies
npm install

# Start the application
npm start
```

Open your browser and navigate to:
```
http://localhost:4000
```

---

## 👥 Demo Accounts (Pre-Seeded)

All demo accounts come pre-loaded with password: `password123`

| Name | Role | Email | Password |
|---|---|---|---|
| **Sarah Chen** | Tech Lead & Frontend Architect | `sarah@planpulse.io` | `password123` |
| **Alex Rivera** | Senior Full-Stack Engineer | `alex@planpulse.io` | `password123` |
| **Elena Rostova** | Lead Product Designer | `elena@planpulse.io` | `password123` |
| **Marcus Vance** | DevOps & Infrastructure | `marcus@planpulse.io` | `password123` |

> *Tip: You can also use the 1-click quick login buttons in the sign-in modal.*

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Sign in and receive JWT token
- `GET /api/auth/me` — Verify session and fetch current profile

### Projects
- `GET /api/projects` — List user's project boards
- `POST /api/projects` — Create a new project board
- `GET /api/users` — List team members for task assignment

### Tasks
- `GET /api/projects/:id/tasks` — Fetch all tasks for a project
- `POST /api/projects/:id/tasks` — Add a new task card
- `GET /api/tasks/:id` — Get task details and comments
- `PUT /api/tasks/:id` — Update title, description, priority, assignee, due date
- `PATCH /api/tasks/:id/status` — Move task between Kanban columns
- `DELETE /api/tasks/:id` — Delete a task card

### Comments & Notifications
- `POST /api/tasks/:id/comments` — Post a comment on a task
- `GET /api/notifications` — Fetch user notifications and unread count
- `PATCH /api/notifications/read-all` — Mark all notifications as read

---

## 📄 License
MIT License. Free to use and customize.
