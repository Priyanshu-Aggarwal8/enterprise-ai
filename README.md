# 🚀 Enterprise AI Agent Platform

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.9+-blue?style=flat-square&logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Angular](https://img.shields.io/badge/Angular-17.3-red?style=flat-square&logo=angular)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat-square&logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [📦 Prerequisites](#-prerequisites)
- [⚙️ Installation](#️-installation)
- [🎯 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [🔧 Configuration](#-configuration)
- [🚀 Running the Application](#-running-the-application)
- [📚 API Documentation](#-api-documentation)
- [🛠️ Development](#️-development)
- [🐛 Troubleshooting](#-troubleshooting)
- [📝 License](#-license)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Agents** | Create and manage intelligent AI agents with custom capabilities |
| 🛠️ **Custom Tools** | Build and integrate custom tools with sandbox execution |
| 📄 **Document Management** | Upload, index, and search documents with vector embeddings |
| 🔐 **Enterprise Security** | Role-based access control and security policies |
| 👥 **Multi-User Support** | Collaborate with your team members |
| 🔄 **Real-time Chat** | Stream-based chat interface with agents |
| 🎨 **Modern UI** | Beautiful, responsive Angular frontend with Tailwind CSS |
| 🔌 **MCP Integration** | Model Context Protocol server support |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Enterprise AI Agent Platform                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────┐      ┌──────────────────┐   │
│  │   Angular Frontend   │      │  FastAPI Backend │   │
│  │   (Port: 4200)       │──────│  (Port: 8000)    │   │
│  │                      │      │                  │   │
│  │ • Agent Workspace    │      │ • REST API       │   │
│  │ • Chat Interface     │      │ • WebSocket      │   │
│  │ • Document Viewer    │      │ • Vector DB      │   │
│  │ • Tool Management    │      │ • Auth Service   │   │
│  └──────────────────────┘      └──────────────────┘   │
│           │                             │              │
│           └─────────────┬───────────────┘              │
│                         │                              │
│              ┌──────────▼──────────┐                   │
│              │  PostgreSQL + pgvector                  │
│              │  (Vector Database)   │                  │
│              └─────────────────────┘                   │
│                                                         │
│         ┌─────────────────────────────────┐            │
│         │   Firebase Authentication       │            │
│         └─────────────────────────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

### System Requirements
- **Node.js**: 18.x or higher
- **Python**: 3.9 or higher
- **PostgreSQL**: 13 or higher
- **npm**: 9.x or higher

### Required Services
- 🔥 **Firebase Project** (for authentication)
- 🗄️ **PostgreSQL Database** (with pgvector extension)
- 📨 **Email Service** (optional, for notifications)

---

## ⚙️ Installation

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/enterprise-ai-agent-platform.git
cd enterprise-ai-agent-platform
```

### 2️⃣ Backend Setup

#### Step 1: Create Virtual Environment

```bash
cd backend
python -m venv venv

# On Windows
.\venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

#### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

#### Step 3: Configure Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/ai_agent_db

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-client-email

# Server Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False

# Security
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# MCP Configuration
MCP_ENABLED=True
```

#### Step 4: Initialize Database

```bash
python manage_search_index.py
```

### 3️⃣ Frontend Setup

#### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

#### Step 2: Configure Environment

Create `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  firebaseConfig: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.appspot.com',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id'
  }
};
```

Update `src/environments/environment.prod.ts` for production settings.

---

## 🎯 Quick Start

### Option 1: Manual Start (Development)

#### Terminal 1 - Backend

```bash
cd backend
.\venv\Scripts\activate  # or source venv/bin/activate on macOS/Linux
python main.py
```

The backend will start at `http://localhost:8000`

#### Terminal 2 - Frontend

```bash
cd frontend
npm start
```

The frontend will start at `http://localhost:4200`

### Option 2: Docker Compose (Recommended for Production)

```bash
cd infrastructure
docker-compose up -d
```

This will spin up:
- PostgreSQL database
- FastAPI backend
- Angular frontend
- All required services

---

## 📁 Project Structure

```
enterprise-ai-agent-platform/
├── backend/
│   ├── routers/
│   │   ├── agents.py          # 🤖 Agent management endpoints
│   │   ├── chats.py           # 💬 Chat functionality
│   │   ├── documents.py       # 📄 Document management
│   │   ├── tools.py           # 🛠️ Tool management
│   │   ├── users.py           # 👥 User management
│   │   └── organizations.py   # 🏢 Organization management
│   ├── agent_core.py          # Core agent logic
│   ├── agent_tool_bindings.py # Tool integration
│   ├── database.py            # Database setup
│   ├── models.py              # SQLAlchemy models
│   ├── schemas.py             # Pydantic schemas
│   ├── security.py            # Authentication/Authorization
│   ├── main.py                # FastAPI application entry point
│   ├── requirements.txt        # Python dependencies
│   └── worker.py              # Background job processing
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/    # Reusable UI components
│   │   │   │   ├── agent-workspace/
│   │   │   │   ├── create-agent/
│   │   │   │   ├── documents/
│   │   │   │   └── ...
│   │   │   ├── services/      # API and business logic
│   │   │   │   ├── api.service.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── agent-stream.service.ts
│   │   │   ├── app.routes.ts  # Application routes
│   │   │   └── app.config.ts  # Angular configuration
│   │   ├── environments/      # Environment configurations
│   │   ├── assets/            # Static assets
│   │   └── styles.scss        # Global styles
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.js
│
├── infrastructure/
│   └── docker-compose.yml     # Docker services configuration
│
├── docs/                       # Documentation
└── README.md                   # This file
```

---

## 🔧 Configuration

### Backend Configuration

#### Database Setup

1. **Create PostgreSQL Database**:
   ```bash
   createdb ai_agent_db
   ```

2. **Enable pgvector Extension**:
   ```bash
   psql ai_agent_db -c "CREATE EXTENSION IF NOT EXISTS vector"
   ```

#### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Download service account key
4. Place `firebase-adminsdk.json` in the `backend` directory

### Frontend Configuration

1. Update API base URL in environment files
2. Add Firebase configuration from Firebase Console
3. Configure CORS if needed

---

## 🚀 Running the Application

### Development Mode

```bash
# Backend
cd backend
.\venv\Scripts\activate
python main.py

# Frontend (in another terminal)
cd frontend
npm start
```

### Production Mode

```bash
# Using Docker Compose
cd infrastructure
docker-compose -f docker-compose.yml up -d

# Or build and run locally
cd backend
pip install -r requirements.txt
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker

cd frontend
npm run build
npm install -g http-server
http-server dist/ui
```

### Health Checks

- **Backend Health**: `http://localhost:8000/health`
- **Frontend**: `http://localhost:4200`
- **API Documentation**: `http://localhost:8000/docs` (Swagger UI)

---

## 📚 API Documentation

The API documentation is automatically generated and available at:

```
http://localhost:8000/docs
```

### Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | List all agents |
| `POST` | `/api/agents` | Create a new agent |
| `GET` | `/api/agents/{id}` | Get agent details |
| `POST` | `/api/chats/{agent_id}` | Start chat with agent |
| `POST` | `/api/documents` | Upload document |
| `GET` | `/api/documents/search` | Search documents |
| `POST` | `/api/tools` | Create custom tool |
| `GET` | `/api/users/profile` | Get user profile |

---

## 🛠️ Development

### Adding a New Feature

1. **Backend**: Add new router in `backend/routers/`
2. **Models**: Update `backend/models.py` if database schema changes
3. **Frontend**: Create new component in `frontend/src/app/components/`
4. **Services**: Update API service in `frontend/src/app/services/`

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Code Quality

```bash
# Format code
cd backend
black . --line-length 100

# Lint
cd frontend
npm run lint
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. **Database Connection Error**

```
Error: could not connect to server
```

**Solution**:
- Ensure PostgreSQL is running: `pg_isready -h localhost`
- Check DATABASE_URL in `.env`
- Verify database exists: `psql -l`

#### 2. **Firebase Authentication Failed**

```
Error: Failed to initialize Firebase
```

**Solution**:
- Verify `firebase-adminsdk.json` exists in backend directory
- Check Firebase credentials in environment variables
- Ensure Firebase project is active

#### 3. **CORS Issues**

```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution**:
- Check CORS configuration in `backend/main.py`
- Verify frontend URL is in allowed origins
- Clear browser cache

#### 4. **pgvector Extension Not Found**

```
Error: could not open extension control file
```

**Solution**:
```bash
# Install pgvector
sudo apt-get install postgresql-contrib  # Linux
# or use Homebrew on macOS
brew install pgvector

# Enable in your database
psql ai_agent_db -c "CREATE EXTENSION IF NOT EXISTS vector"
```

#### 5. **Port Already in Use**

```
Address already in use
```

**Solution**:
```bash
# Find and kill process on port 8000
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Or use different port
python main.py --port 8001
```

---

## 🔐 Security Considerations

⚠️ **Important**: Before deploying to production:

- [ ] Change default SECRET_KEY
- [ ] Enable HTTPS/SSL
- [ ] Set secure CORS origins
- [ ] Enable rate limiting
- [ ] Set up proper logging
- [ ] Configure firewall rules
- [ ] Enable database backups
- [ ] Use environment variables for secrets
- [ ] Enable Firebase security rules
- [ ] Set up API authentication tokens

---

## 📊 Performance Optimization

### Database
- Uses IVFFlat indexes for vector similarity search (~10-100x speedup)
- Configured pgvector for embedding storage
- Connection pooling enabled

### Frontend
- Angular 17 with latest performance features
- Lazy loading for components
- Tree shaking and code splitting with build optimization

### Backend
- Async/await for non-blocking operations
- Connection pooling for database
- Caching for frequently accessed data

---

## 📞 Support & Contribution

### 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 📧 Contact

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/enterprise-ai-agent-platform/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/enterprise-ai-agent-platform/discussions)

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🎉 Acknowledgments

- 🙏 Thanks to all contributors
- 💪 Built with [FastAPI](https://fastapi.tiangolo.com/), [Angular](https://angular.io/), and [PostgreSQL](https://www.postgresql.org/)
- 🔥 Powered by [Firebase](https://firebase.google.com/)

---

<div align="center">

### ⭐ If you find this project helpful, please give it a star!

Made with ❤️ by the Enterprise AI Agent Team

</div>
