# Euron Nexus - AI Interview Platform

![Euron Logo](https://img.shields.io/badge/Euron-Nexus-0A66C2?style=for-the-badge&logo=lightning&logoColor=white)

A next-generation AI-powered interview platform that automates end-to-end hiring with intelligent resume screening, AI-driven interviews, and comprehensive analytics.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at **http://localhost:3000**

## 📁 Project Structure

```
euron-nexus/
├── public/
│   ├── index.html          # Landing page
│   ├── super-admin.html    # Super Admin Dashboard
│   ├── organizations.html  # Organizations Management
│   ├── interview.html      # AI Interview Demo
│   └── candidate-portal.html # Candidate Dashboard
├── server.js               # Express server
├── package.json
└── README.md
```

## 🎯 Features

### Demo Version Includes:
- ✅ Professional landing page with feature showcase
- ✅ Super Admin Dashboard with metrics
- ✅ Organizations management view
- ✅ Interactive AI Interview demo (simulated)
- ✅ Candidate portal with applications tracking
- ✅ Responsive design following enterprise SaaS aesthetics
- ✅ REST API endpoints for data

### Pages Available:

| Page | URL | Description |
|------|-----|-------------|
| Home | http://localhost:3000/ | Landing page with features & pricing |
| Super Admin | http://localhost:3000/super-admin | Admin dashboard with metrics |
| Organizations | http://localhost:3000/organizations | Manage client organizations |
| Interview | http://localhost:3000/interview | Interactive AI interview demo |
| Candidate | http://localhost:3000/candidate | Candidate portal |

### API Endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/health | GET | Health check |
| /api/stats | GET | Platform statistics |
| /api/organizations | GET | List all organizations |
| /api/organizations/:id | GET | Get organization by ID |
| /api/interviews | GET | List interviews |

## 🎨 Design System

The UI follows a professional, enterprise-grade design inspired by LinkedIn's UX:

- **Primary Blue**: #0A66C2
- **Background**: #F3F6F8
- **Typography**: Inter font family
- **Border Radius**: 8px for cards
- **Shadows**: Minimal, flat design

## 🚀 Deployment

### For AWS Deployment:

1. **EC2 Instance**: 
   ```bash
   # On your EC2 instance
   git clone <your-repo>
   cd euron-nexus
   npm install
   npm start
   ```

2. **With PM2 (Production)**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name euron-nexus
   pm2 save
   ```

3. **With Nginx** (recommended):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Docker (Optional):

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔮 Future Enhancements

- [ ] Real AI interview integration (OpenAI/Anthropic)
- [ ] Video/Audio recording and analysis
- [ ] Resume parsing with ATS scoring
- [ ] Multi-tenant database (PostgreSQL/DynamoDB)
- [ ] Authentication (Cognito/Auth0)
- [ ] Real-time notifications (WebSocket)
- [ ] Advanced analytics dashboard
- [ ] Webhook integrations for job boards

## 📞 Support

For any questions or issues, contact the development team.

---

**Built with ❤️ by Euron Team**
