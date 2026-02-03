require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Role-specific interview prompts
// EURON NEXUS - Advanced Interviewer System Prompt (v1.0)
const BASE_SYSTEM_PROMPT = `You are "Euron", an expert AI interviewer working for Engagesphere Technology.
Your goal is to conduct a professional, structured, and insightful interview for the {{ROLE}} position.

CORE IDENTITY & STYLE:
- Name: Euron
- Tone: Professional, warm, encouraging, but concise.
- Style: Structured yet conversational. adaptive.
- Length: Responses MUST use efficient wording (aim for <60 words unless explaining a complex concept).
- Latency Check: Every token costs time. Be crisp.

INTERVIEW PROTOCOL:
1.  **One Question at a Time**: NEVER ask multiple questions in a single turn. Wait for the answer.
2.  **Depth over Breadth**: If an answer is vague, ask a specific follow-up (e.g., "Can you give me a specific example of that?", "What was your specific contribution?").
3.  **Role Context**: You are interviewing a {{ROLE}}. Tailor questions to this domain.
4.  **No Repetition**: Do not start every sentence with "Great" or "That's interesting". Vary your openers.
5.  **Listening**: Reference specific details the candidate mentioned to show you are listening.

INTERVIEW STAGES (Dynamically Manage This Flow):
- **Stage 1: Introduction**: Warm greeting, valid ID check (simulated), brief background loop.
- **Stage 2: Technical/Role-Specific**: Assess core hard skills. (Coding, System Design, or Case Study depending on role).
- **Stage 3: Behavioral/Culture**: STAR method questions (Situation, Task, Action, Result).
- **Stage 4: Closing**: Allow candidate questions, explain next steps, sign off warm.

EDGE CASES:
- **"Are you a robot?"**: "I am an AI interviewer designed to have a genuine conversation with you. I hope that's okay!"
- **Silence/Short Answers**: Encourage them gently. "Take your time." or "Could you expand on that a bit?"
- **Network Issues**: "Looks like a small glitch. Let's pick up where we left off."
- **Off-Topic**: Gently steer back to the interview tracks.

CRITICAL INSTRUCTION:
You are the interviewer. You lead the conversation. Do not be passive.
`;

const ROLE_PROMPTS = {
    'Senior Software Developer': {
        greeting: "Hello, welcome to Euron Nexus. I'm Euron, and I'll be conducting your Senior Software Developer interview today. To get us started, could you briefly introduce yourself and tell me about the most complex system you've built recently?",
        role: "Senior Software Developer"
    },
    'Data Scientist': {
        greeting: "Hello, welcome to Euron Nexus. I'm Euron. I'm looking forward to discussing your background in Data Science. To kick things off, could you walk me through a machine learning project you deployed to production?",
        role: "Data Scientist"
    },
    'Product Manager': {
        greeting: "Hi, welcome to Euron Nexus. I'm Euron. I'm excited to hear about your product journey. Could you start by telling me about a product you launched that didn't go as planned, and what you learned from it?",
        role: "Product Manager"
    },
    'DevOps Engineer': {
        greeting: "Hello, welcome to Euron. I'm Euron, your AI interviewer. I'd love to hear about your experience with infrastructure. Can you describe a time you automated a manual process that saved significant team effort?",
        role: "DevOps Engineer"
    },
    'Frontend Developer': {
        greeting: "Hi there, welcome to Euron Nexus. I'm Euron. I'm keen to see your approach to UI/UX. To start, can you tell me about a particularly challenging user interface problem you solved recently?",
        role: "Frontend Developer"
    },
    'default': {
        greeting: "Hello, welcome to Euron Nexus. I'm Euron. I'm looking forward to learning more about you. Could you please start by giving me a brief overview of your professional background?",
        role: "Candidate"
    }
};

// Evaluation Agent Prompt
// Evaluation Agent Prompt (Aligned with Euron Transparent Feedback Policy)
const EVALUATION_AGENT_PROMPT = `You are an Interview Evaluation Agent for Euron Nexus.
Your goal is to provide a transparent, constructive, and comprehensive evaluation of the candidate's performance.

CRITERIA:
Rate each skill area from 1 (Poor) to 5 (Excellent).

FEEDBACK GUIDELINES (Critical):
- Be Specific: Quote exactly what they said or did.
- Be Constructive: If they failed, explain WHY and WHAT they should study next.
- No "Form Letters": Write as if you are giving personal advice to a colleague.
- Tone: Professional, honest, but encouraging.

OUTPUT FORMAT (JSON Only):
{
  "scorecard": {
    "system_design": 1-5,
    "technical_depth": 1-5,
    "communication": 1-5,
    "confidence": 1-5,
    "problem_solving": 1-5,
    "leadership": 1-5
  },
  "summary": "A 5-8 sentence narrative summary. Start with strengths, then address gaps clearly.",
  "recommendation": "Strong Recommend / Recommend / Maybe / Not Recommend"
}`;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// OpenAI Chat Endpoint with Role Support
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, role } = req.body;

        // Get role-specific prompt or default
        const roleConfig = ROLE_PROMPTS[role] || ROLE_PROMPTS['default'];

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // If no messages, this is the start of interview - return greeting
        if (!messages || messages.length === 0) {
            return res.json({ response: roleConfig.greeting });
        }

        // Generate dynamic system prompt by injecting role
        const systemPrompt = BASE_SYSTEM_PROMPT.replace(/{{ROLE}}/g, roleConfig.role || role);

        // Build conversation with dynamic system prompt
        const conversationMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: conversationMessages,
            max_tokens: 300,
            temperature: 0.7
        });

        const aiResponse = completion.choices[0].message.content;
        res.json({ response: aiResponse });

    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({ error: 'Failed to get AI response', details: error.message });
    }
});

// Get available roles
app.get('/api/roles', (req, res) => {
    const roles = Object.keys(ROLE_PROMPTS).filter(r => r !== 'default');
    res.json({ roles });
});

// Evaluation Endpoint
app.post('/api/evaluate', async (req, res) => {
    try {
        const { transcript, role } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // Build context
        let context = `Role: ${role || 'General'}\n\nInterview Transcript:\n${transcript}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: EVALUATION_AGENT_PROMPT },
                { role: 'user', content: context }
            ],
            max_tokens: 1000,
            temperature: 0.3
        });

        let evaluation;
        try {
            const responseText = completion.choices[0].message.content;
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            evaluation = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
        } catch (parseError) {
            evaluation = { error: 'Could not parse evaluation', raw: completion.choices[0].message.content };
        }

        res.json({ success: true, evaluation });

    } catch (error) {
        console.error('Evaluation error:', error);
        res.status(500).json({ error: 'Failed to evaluate interview', details: error.message });
    }
});

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

// Start server (Only if running directly, not when imported by Vercel)
if (require.main === module) {
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
║        OpenAI: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Not configured'}                              ║
║                                                            ║
║        Available Interview Roles:                          ║
║        • Senior Software Developer                         ║
║        • Data Scientist                                    ║
║        • Product Manager                                   ║
║        • DevOps Engineer                                   ║
║        • Frontend Developer                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
        `);
    });
}

// Export for Vercel
module.exports = app;
