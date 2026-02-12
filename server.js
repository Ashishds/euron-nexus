require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const OpenAI = require('openai');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for CDN scripts (Tailwind, FontAwesome)
    crossOriginEmbedderPolicy: false
}));

// Rate limiting: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please try again in a few minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', apiLimiter);

// ============================================================
// FILE UPLOAD CONFIG (Resume)
// ============================================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `resume_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.doc'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and DOCX files are accepted'));
        }
    }
});

// ============================================================
// AGENT PROMPTS
// ============================================================

// AGENT 1: RESUME ANALYZER AGENT
const RESUME_ANALYZER_PROMPT = `You are a Resume Analysis Agent for Zoho AI Interview Platform.
Your job is to deeply analyze a candidate's resume and extract structured information that will help the Interviewer Agent ask targeted, personalized questions.

ANALYSIS REQUIREMENTS:
1. Extract ALL technical skills mentioned (languages, frameworks, tools, databases, cloud services).
2. Identify key projects with their tech stacks and the candidate's specific contributions.
3. Spot experience gaps, career transitions, or inconsistencies that should be explored.
4. Generate 3-5 targeted interview questions based on specific resume claims.

OUTPUT FORMAT (JSON Only):
{
  "candidate_name": "Name from resume",
  "experience_years": "X years",
  "skills": ["skill1", "skill2", "skill3"],
  "key_projects": [
    {
      "name": "Project Name",
      "tech_stack": ["tech1", "tech2"],
      "contribution": "What they did",
      "question_angle": "What to probe deeper on"
    }
  ],
  "experience_summary": "2-3 sentence summary of their career path",
  "strengths": ["strength1", "strength2"],
  "areas_to_probe": ["gap1", "gap2"],
  "targeted_questions": [
    "Specific question about their resume claim 1",
    "Specific question about their project 2",
    "Specific question about a skill they listed"
  ]
}`;

// AGENT 2: INTERVIEWER AGENT (Enhanced with Resume Context)
const BASE_SYSTEM_PROMPT = `You are "Zoho", an expert AI interviewer working for Engagesphere Technology.
Your goal is to conduct a professional, structured, and insightful interview for the {{ROLE}} position.

CORE IDENTITY & STYLE:
- Name: Zoho
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

{{RESUME_CONTEXT}}

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
        greeting: "Hello, welcome to Zoho. I'm Zoho, and I'll be conducting your Senior Software Developer interview today. To get us started, could you briefly introduce yourself and tell me about the most complex system you've built recently?",
        role: "Senior Software Developer"
    },
    'Data Scientist': {
        greeting: "Hello, welcome to Zoho. I'm Zoho. I'm looking forward to discussing your background in Data Science. To kick things off, could you walk me through a machine learning project you deployed to production?",
        role: "Data Scientist"
    },
    'Product Manager': {
        greeting: "Hi, welcome to Zoho. I'm Zoho. I'm excited to hear about your product journey. Could you start by telling me about a product you launched that didn't go as planned, and what you learned from it?",
        role: "Product Manager"
    },
    'DevOps Engineer': {
        greeting: "Hello, welcome to Zoho. I'm Zoho, your AI interviewer. I'd love to hear about your experience with infrastructure. Can you describe a time you automated a manual process that saved significant team effort?",
        role: "DevOps Engineer"
    },
    'Frontend Developer': {
        greeting: "Hi there, welcome to Zoho. I'm Zoho. I'm keen to see your approach to UI/UX. To start, can you tell me about a particularly challenging user interface problem you solved recently?",
        role: "Frontend Developer"
    },
    'default': {
        greeting: "Hello, welcome to Zoho. I'm Zoho. I'm looking forward to learning more about you. Could you please start by giving me a brief overview of your professional background?",
        role: "Candidate"
    }
};

// AGENT 3: EVALUATION AGENT (Enhanced with Resume Verification)
const EVALUATION_AGENT_PROMPT = `You are an Interview Evaluation Agent for Zoho.
Your goal is to provide a transparent, constructive, and comprehensive evaluation of the candidate's performance.

CRITERIA:
Rate each skill area from 1 (Poor) to 5 (Excellent).

{{RESUME_EVAL_CONTEXT}}

FEEDBACK GUIDELINES (Critical):
- Be Specific: Quote exactly what they said or did.
- Be Constructive: If they failed, explain WHY and WHAT they should study next.
- No "Form Letters": Write as if you are giving personal advice to a colleague.
- Tone: Professional, honest, but encouraging.
- Resume Verification: If resume data is available, assess whether the candidate's answers were consistent with their resume claims. Flag any discrepancies.

OUTPUT FORMAT (JSON Only):
{
  "scorecard": {
    "system_design": 1-5,
    "technical_depth": 1-5,
    "communication": 1-5,
    "confidence": 1-5,
    "problem_solving": 1-5,
    "leadership": 1-5,
    "resume_consistency": 1-5
  },
  "summary": "A 5-8 sentence narrative summary. Start with strengths, then address gaps clearly. Include whether the candidate's answers matched their resume claims.",
  "recommendation": "Strong Recommend / Recommend / Maybe / Not Recommend",
  "resume_verification": "Brief assessment of how well the candidate backed up their resume claims during the interview."
}`;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// API ROUTES
// ============================================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), agents: ['resume-analyzer', 'interviewer', 'evaluator'] });
});

// ============================================================
// AGENT 1: RESUME UPLOAD & ANALYSIS
// ============================================================

// Step 1: Upload Resume (extract text)
app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();
        let resumeText = '';

        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            try {
                const pdfData = await pdfParse(dataBuffer);
                resumeText = pdfData.text;
            } catch (pdfError) {
                console.error('❌ PDF Parse Error:', pdfError);
                return res.status(400).json({ error: 'Failed to parse PDF file. Please try a different file.' });
            }
        } else if (ext === '.docx' || ext === '.doc') {
            try {
                const result = await mammoth.extractRawText({ path: filePath });
                resumeText = result.value;
            } catch (docxError) {
                console.error('❌ DOCX Parse Error:', docxError);
                return res.status(400).json({ error: 'Failed to parse Word document. Please try a different file.' });
            }
        }

        // Clean up uploaded file
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore cleanup error */ }

        if (!resumeText || resumeText.trim().length < 50) {
            console.error('❌ Resume text too short:', resumeText ? resumeText.length : 0);
            return res.status(400).json({ error: 'Could not extract meaningful text from resume. Please ensure it is not a scanned image.' });
        }

        console.log('✅ Resume processed successfully. Text length:', resumeText.length);

        res.json({
            success: true,
            resumeText: resumeText.trim(),
            charCount: resumeText.trim().length
        });

    } catch (error) {
        console.error('Resume upload error:', error);
        if (error.message === 'Only PDF and DOCX files are accepted') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to process resume', details: error.message });
    }
});

// Step 2: Analyze Resume (AI Agent)
app.post('/api/analyze-resume', async (req, res) => {
    try {
        const { resumeText } = req.body;

        if (!resumeText) {
            return res.status(400).json({ error: 'No resume text provided' });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // Agent 1: Resume Analyzer — uses gpt-4o-mini (fast, cost-effective for parsing)
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: RESUME_ANALYZER_PROMPT },
                { role: 'user', content: `Analyze this resume:\n\n${resumeText}` }
            ],
            max_tokens: 1500,
            temperature: 0.3
        });

        let analysis;
        try {
            const responseText = completion.choices[0].message.content;
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
        } catch (parseError) {
            analysis = { error: 'Could not parse analysis', raw: completion.choices[0].message.content };
        }

        res.json({ success: true, analysis });

    } catch (error) {
        console.error('Resume analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze resume', details: error.message });
    }
});

// ============================================================
// AGENT 2: INTERVIEWER (Enhanced with Resume Context)
// ============================================================

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, role, resumeContext } = req.body;

        // Get role-specific prompt or default
        const roleConfig = ROLE_PROMPTS[role] || ROLE_PROMPTS['default'];

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // If no messages, this is the start of interview - return greeting
        if (!messages || messages.length === 0) {
            // If resume context exists, personalize the greeting
            if (resumeContext && resumeContext.candidate_name) {
                const personalGreeting = `Hello ${resumeContext.candidate_name}, welcome to Zoho. I'm Zoho, and I'll be conducting your ${roleConfig.role} interview today. I've reviewed your resume — I can see you have experience with ${resumeContext.skills ? resumeContext.skills.slice(0, 3).join(', ') : 'relevant technologies'}. Let's dive in! Could you start by giving me a brief overview of your career journey?`;
                return res.json({ response: personalGreeting });
            }
            return res.json({ response: roleConfig.greeting });
        }

        // Generate dynamic system prompt by injecting role
        let systemPrompt = BASE_SYSTEM_PROMPT.replace(/{{ROLE}}/g, roleConfig.role || role);

        // Inject resume context if available
        if (resumeContext) {
            const resumeSection = `
RESUME CONTEXT (Use this to ask personalized questions):
- Candidate: ${resumeContext.candidate_name || 'Unknown'}
- Experience: ${resumeContext.experience_years || 'Unknown'}
- Key Skills: ${resumeContext.skills ? resumeContext.skills.join(', ') : 'Not available'}
- Projects: ${resumeContext.key_projects ? resumeContext.key_projects.map(p => `${p.name} (${p.tech_stack ? p.tech_stack.join(', ') : ''})`).join('; ') : 'Not available'}
- Areas to Probe: ${resumeContext.areas_to_probe ? resumeContext.areas_to_probe.join(', ') : 'None identified'}
- Targeted Questions to Ask: ${resumeContext.targeted_questions ? resumeContext.targeted_questions.join(' | ') : 'None'}

IMPORTANT: Use the resume context naturally. Reference their specific projects/skills when asking questions. Example: "You mentioned working on [Project X] with [Tech Y], can you tell me more about the challenges you faced?"`;
            systemPrompt = systemPrompt.replace('{{RESUME_CONTEXT}}', resumeSection);
        } else {
            systemPrompt = systemPrompt.replace('{{RESUME_CONTEXT}}', '');
        }

        // Build conversation with dynamic system prompt
        const conversationMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        // Agent 2: Interviewer — uses gpt-4o-mini (cost-effective)
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
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

// ============================================================
// AGENT 3: EVALUATOR (Enhanced with Resume Verification)
// ============================================================

app.post('/api/evaluate', async (req, res) => {
    try {
        const { transcript, role, resumeAnalysis } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // Build evaluation prompt with resume context
        let evalPrompt = EVALUATION_AGENT_PROMPT;

        if (resumeAnalysis) {
            const resumeEvalSection = `
RESUME DATA FOR VERIFICATION:
The candidate's resume claims the following:
- Skills: ${resumeAnalysis.skills ? resumeAnalysis.skills.join(', ') : 'N/A'}
- Projects: ${resumeAnalysis.key_projects ? resumeAnalysis.key_projects.map(p => p.name).join(', ') : 'N/A'}
- Experience: ${resumeAnalysis.experience_summary || 'N/A'}
- Strengths (from resume): ${resumeAnalysis.strengths ? resumeAnalysis.strengths.join(', ') : 'N/A'}

IMPORTANT: Compare these claims against the candidate's actual interview answers. Did they demonstrate genuine knowledge of the skills and projects they listed? Score "resume_consistency" accordingly.`;
            evalPrompt = evalPrompt.replace('{{RESUME_EVAL_CONTEXT}}', resumeEvalSection);
        } else {
            evalPrompt = evalPrompt.replace('{{RESUME_EVAL_CONTEXT}}', 'Note: No resume data available for this candidate. Skip resume_consistency scoring and set it to null.');
        }

        // Build context
        let context = `Role: ${role || 'General'}\n\nInterview Transcript:\n${transcript}`;

        // Agent 3: Evaluator — uses gpt-4o-mini (cost-effective for post-interview analysis)
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: evalPrompt },
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

// ============================================================
// MOCK DATA & STATIC ROUTES
// ============================================================

const mockOrganizations = [
    { id: 1, name: 'TechCorp Solutions', plan: 'Enterprise', status: 'Active', users: 47, interviews: 1247, mrr: 2499 },
    { id: 2, name: 'Global Innovations Inc', plan: 'Growth', status: 'Active', users: 18, interviews: 892, mrr: 999 },
    { id: 3, name: 'DataSync Pro', plan: 'Startup', status: 'Trial', users: 5, interviews: 124, mrr: 299 },
    { id: 4, name: 'CloudScale Systems', plan: 'Enterprise', status: 'Active', users: 92, interviews: 2156, mrr: 4999 },
];

const mockInterviews = [
    { id: 1, candidate: 'Ashish Singh', position: 'Senior Developer', status: 'Completed', score: 85, date: '2024-01-15' },
    { id: 2, candidate: 'Priya Verma', position: 'Product Manager', status: 'Scheduled', score: null, date: '2024-01-20' },
    { id: 3, candidate: 'Manoj Kumar', position: 'Data Analyst', status: 'In Progress', score: null, date: '2024-01-18' },
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

    // ============================================================
    // OPENAI REALTIME VOICE API (WebSocket Relay) - LOCAL ONLY
    // ============================================================

    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server, path: '/ws/realtime' });

    wss.on('connection', (clientWs, req) => {
        console.log('\n🎙️  Client connected to Realtime Voice API');

        // Parse query params for role and resume context
        const url = new URL(req.url, `http://${req.headers.host}`);
        const role = url.searchParams.get('role') || 'Senior Software Developer';
        const resumeContextParam = url.searchParams.get('resumeContext');
        let resumeContext = null;
        try {
            if (resumeContextParam) resumeContext = JSON.parse(decodeURIComponent(resumeContextParam));
        } catch (e) { /* ignore parse errors */ }

        // Connect to OpenAI Realtime API
        const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1'
            }
        });

        openaiWs.on('open', () => {
            console.log('✅ Connected to OpenAI Realtime API');

            // Build system instructions with role and resume context
            const roleConfig = ROLE_PROMPTS[role] || ROLE_PROMPTS['default'];
            let instructions = BASE_SYSTEM_PROMPT.replace(/{{ROLE}}/g, roleConfig.role || role);

            if (resumeContext) {
                const resumeSection = `
RESUME CONTEXT (Use this to ask personalized questions):
- Candidate: ${resumeContext.candidate_name || 'Unknown'}
- Key Skills: ${resumeContext.skills ? resumeContext.skills.join(', ') : 'Not available'}
- Projects: ${resumeContext.key_projects ? resumeContext.key_projects.map(p => p.name).join(', ') : 'Not available'}
- Areas to Probe: ${resumeContext.areas_to_probe ? resumeContext.areas_to_probe.join(', ') : 'None'}
IMPORTANT: Reference their specific projects and skills naturally during the interview.`;
                instructions = instructions.replace('{{RESUME_CONTEXT}}', resumeSection);
            } else {
                instructions = instructions.replace('{{RESUME_CONTEXT}}', '');
            }

            // Configure the Realtime session
            const sessionConfig = {
                type: 'session.update',
                session: {
                    modalities: ['text', 'audio'],
                    instructions: instructions,
                    voice: 'alloy',
                    input_audio_format: 'pcm16',
                    output_audio_format: 'pcm16',
                    input_audio_transcription: {
                        model: 'whisper-1'
                    },
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.8,
                        prefix_padding_ms: 500,
                        silence_duration_ms: 1500,
                        create_response: true
                    }
                }
            };

            openaiWs.send(JSON.stringify(sessionConfig));
            console.log(`🎯 Session configured for role: ${role}, voice: alloy`);
        });

        // Relay: OpenAI → Client
        openaiWs.on('message', (data) => {
            try {
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(data.toString());
                }
            } catch (e) {
                console.error('Error relaying to client:', e.message);
            }
        });

        // Relay: Client → OpenAI
        clientWs.on('message', (data) => {
            try {
                if (openaiWs.readyState === WebSocket.OPEN) {
                    openaiWs.send(data.toString());
                }
            } catch (e) {
                console.error('Error relaying to OpenAI:', e.message);
            }
        });

        // Handle disconnections
        clientWs.on('close', () => {
            console.log('🔌 Client disconnected');
            if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
        });

        openaiWs.on('close', () => {
            console.log('🔌 OpenAI Realtime disconnected');
            if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
        });

        openaiWs.on('error', (err) => {
            console.error('❌ OpenAI Realtime error:', err.message);
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'error', error: { message: 'OpenAI Realtime connection failed: ' + err.message } }));
            }
        });

        clientWs.on('error', (err) => {
            console.error('❌ Client WebSocket error:', err.message);
        });
    });

    server.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🚀 ZOHO - AI Interview Platform                     ║
║        🤖 Multi-Agent Architecture v3.0                    ║
║                                                            ║
║        Server running at: http://localhost:${PORT}            ║
║                                                            ║
║        AI Agents:                                          ║
║        • Agent 1: Resume Analyzer   (GPT-4o-mini)          ║
║        • Agent 2: Interviewer       (GPT-4o)               ║
║        • Agent 3: Evaluator         (GPT-4o-mini)          ║
║        • Voice:   Realtime API      (GPT-4o-realtime)      ║
║        • Note:    Voice Mode is LOCAL ONLY                 ║
║                                                            ║
║        Voice Mode: ws://localhost:${PORT}/ws/realtime         ║
║                                                            ║
║        Pages:                                              ║
║        • Home:          http://localhost:${PORT}/             ║
║        • Interview:     http://localhost:${PORT}/interview    ║
║        • Candidate:     http://localhost:${PORT}/candidate    ║
║                                                            ║
║        OpenAI: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Not configured'}                              ║
║        Security: Helmet ✓ | Rate Limit: 100/15min         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
        `);
    });
}

// Export for Vercel
module.exports = app;
