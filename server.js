const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mock data for organizations
const mockOrganizations = [
    { id: 1, name: 'TechCorp Solutions', plan: 'Enterprise', status: 'Active', users: 47, interviews: 1247, mrr: 2499 },
    { id: 2, name: 'Global Innovations Inc', plan: 'Growth', status: 'Active', users: 18, interviews: 892, mrr: 999 },
    { id: 3, name: 'DataSync Pro', plan: 'Startup', status: 'Trial', users: 5, interviews: 124, mrr: 299 },
    { id: 4, name: 'CloudScale Systems', plan: 'Enterprise', status: 'Active', users: 92, interviews: 2156, mrr: 4999 },
];

// Mock data for interviews
const mockInterviews = [
    { id: 1, candidate: 'John Doe', position: 'Senior Developer', status: 'Completed', score: 85, date: '2024-01-15' },
    { id: 2, candidate: 'Jane Smith', position: 'Product Manager', status: 'Scheduled', score: null, date: '2024-01-20' },
    { id: 3, candidate: 'Mike Johnson', position: 'Data Analyst', status: 'In Progress', score: null, date: '2024-01-18' },
];

// API Endpoints
app.get('/api/organizations', (req, res) => {
    res.json(mockOrganizations);
});

app.get('/api/organizations/:id', (req, res) => {
    const org = mockOrganizations.find(o => o.id === parseInt(req.params.id));
    if (org) {
        res.json(org);
    } else {
        res.status(404).json({ error: 'Organization not found' });
    }
});

app.get('/api/interviews', (req, res) => {
    res.json(mockInterviews);
});

app.get('/api/stats', (req, res) => {
    res.json({
        totalOrganizations: 1234,
        activeUsers: 45678,
        interviewsToday: 892,
        monthlyRevenue: 4560000,
        systemHealth: 99.9,
        supportTickets: 23
    });
});

// Serve frontend pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/super-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'super-admin.html'));
});

app.get('/organizations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'organizations.html'));
});

app.get('/interview', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'interview.html'));
});

app.get('/candidate', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'candidate-portal.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🚀 EURON NEXUS - AI Interview Platform              ║
║                                                            ║
║        Server running at: http://localhost:${PORT}            ║
║                                                            ║
║        Pages:                                              ║
║        • Home:          http://localhost:${PORT}/             ║
║        • Super Admin:   http://localhost:${PORT}/super-admin  ║
║        • Organizations: http://localhost:${PORT}/organizations║
║        • Interview:     http://localhost:${PORT}/interview    ║
║        • Candidate:     http://localhost:${PORT}/candidate    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});
