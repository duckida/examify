"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const google_1 = require("@ai-sdk/google");
const ai_1 = require("ai");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
const uploadDir = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const id = (0, uuid_1.v4)();
        cb(null, `${id}.pdf`);
    },
});
const upload = (0, multer_1.default)({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
app.post('/api/upload', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    const id = req.file.filename.replace('.pdf', '');
    res.json({ id, filename: req.file.filename, url: `/uploads/${req.file.filename}` });
});
app.post('/api/mark', async (req, res) => {
    try {
        const { image, markSchemeImages, markSchemeImage, questionContext } = req.body;
        if (!image) {
            res.status(400).json({ error: 'No image provided' });
            return;
        }
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            res.status(500).json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY not set on server' });
            return;
        }
        const images = markSchemeImages || (markSchemeImage ? [markSchemeImage] : []);
        const userContent = [
            { type: 'text', text: questionContext || 'Mark this exam answer.' },
            { type: 'image', image: `data:image/png;base64,${image}` },
        ];
        if (images.length > 0) {
            userContent.push({ type: 'text', text: `Here is the full mark scheme (${images.length} page${images.length > 1 ? 's' : ''}). Use it to assess the student's answer against each criterion.` });
            for (const msImg of images) {
                userContent.push({ type: 'image', image: `data:image/png;base64,${msImg}` });
            }
        }
        const result = await (0, ai_1.generateText)({
            model: (0, google_1.google)(process.env.LLM_MODEL || 'gemini-3.1-flash-lite'),
            system: `You are an expert examiner marking student answers against official mark schemes.
Analyze the student's answer using the full mark scheme provided.
Return JSON only, no markdown formatting:
- score (number): marks awarded
- totalMarks (number): total marks available
- feedback (string): detailed feedback referencing specific mark scheme criteria
- breakdown: array of { criterion: string, awarded: boolean, marks: number }`,
            messages: [{ role: 'user', content: userContent }],
            maxOutputTokens: 2000,
        });
        const text = result.text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            res.status(500).json({ error: 'LLM response did not contain valid JSON', raw: text });
            return;
        }
        res.json(JSON.parse(jsonMatch[0]));
    }
    catch (error) {
        console.error('Marking error:', error);
        res.status(500).json({ error: error.message || 'Failed to mark' });
    }
});
const clientDist = path_1.default.join(__dirname, '../../client/dist');
if (fs_1.default.existsSync(clientDist)) {
    app.use(express_1.default.static(clientDist));
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(clientDist, 'index.html'));
    });
}
const server = app.listen(PORT, () => {
    console.log(`Examify server running on http://localhost:${PORT}`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGQUIT', () => server.close(() => process.exit(0)));
