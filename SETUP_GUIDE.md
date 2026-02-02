# 🚀 Euron Nexus - Complete Setup Guide

## Prerequisites

Before running this project, make sure you have:

✅ **Node.js** (version 18 or higher)  
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

✅ **npm** (comes with Node.js)  
   - Verify installation: `npm --version`

---

## 📋 Step-by-Step Installation

### Step 1: Open Terminal/Command Prompt

- **Windows**: Press `Win + R`, type `cmd` or `powershell`, press Enter
- **VS Code**: Press `` Ctrl + ` `` to open integrated terminal

### Step 2: Navigate to Project Folder

```bash
cd f:\euron-intervie-ai-agent
```

### Step 3: Install Dependencies

```bash
npm install
```

This will install:
- `express` - Web server framework
- `cors` - Cross-origin resource sharing

**Expected output:**
```
added 70 packages, and audited 71 packages in 5s
found 0 vulnerabilities
```

### Step 4: Start the Server

```bash
npm start
```

**Expected output:**
```
╔════════════════════════════════════════════════════════════╗
║        🚀 EURON NEXUS - AI Interview Platform              ║
║        Server running at: http://localhost:3000            ║
╚════════════════════════════════════════════════════════════╝
```

### Step 5: Open in Browser

Open your web browser and go to: **http://localhost:3000**

---

## 🔑 Environment Variables (OPTIONAL)

### For Demo Version: **NO .env FILE NEEDED!** ✅

The demo version works out of the box with no configuration required.

### For Future AI Integration:

If you want to add real AI functionality later, create a `.env` file:

```bash
# Copy the example file
copy .env.example .env

# Then edit .env with your API keys
```

**Example .env for OpenAI integration:**
```env
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=sk-your-openai-api-key-here
```

---

## 📁 Project Structure Explained

```
euron-intervie-ai-agent/
│
├── server.js              # Main Express server (entry point)
├── package.json           # Project dependencies
├── .env.example           # Environment variables template
│
├── public/                # Frontend HTML files
│   ├── index.html         # Landing page
│   ├── super-admin.html   # Admin dashboard
│   ├── organizations.html # Organizations management
│   ├── interview.html     # AI Interview demo
│   └── candidate-portal.html # Candidate dashboard
│
└── node_modules/          # Installed packages (auto-generated)
```

---

## 🌐 Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | http://localhost:3000/ | Landing page with features |
| Super Admin | http://localhost:3000/super-admin | Admin dashboard |
| Organizations | http://localhost:3000/organizations | Manage organizations |
| Interview | http://localhost:3000/interview | **Interactive AI demo** |
| Candidate | http://localhost:3000/candidate | Candidate portal |

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health check |
| `/api/stats` | GET | Platform statistics |
| `/api/organizations` | GET | List organizations |
| `/api/interviews` | GET | List interviews |

**Test the API:**
```bash
curl http://localhost:3000/api/health
```

---

## ❓ Troubleshooting

### "npm is not recognized"
→ Node.js is not installed. Download from https://nodejs.org/

### "Port 3000 is already in use"
→ Another app is using port 3000. Either:
- Close the other app, or
- Change port: `set PORT=3001 && npm start`

### "Cannot find module 'express'"
→ Run `npm install` first

### Page not loading
→ Make sure server is running (`npm start`)

---

## 🛑 Stopping the Server

Press `Ctrl + C` in the terminal where the server is running.

---

## 🔄 Restarting the Server

```bash
# Stop with Ctrl+C, then:
npm start
```

---

## ✅ Quick Start Summary

```bash
# 1. Go to project folder
cd f:\euron-intervie-ai-agent

# 2. Install dependencies (first time only)
npm install

# 3. Start server
npm start

# 4. Open browser
# Go to http://localhost:3000
```

**That's it! No API keys, no .env file, no database setup needed for the demo!** 🎉
