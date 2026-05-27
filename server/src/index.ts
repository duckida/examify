import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const id = uuidv4();
    cb(null, `${id}.pdf`);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

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

    const userContent: any[] = [
      { type: 'text' as const, text: questionContext || 'Mark this exam answer.' },
      { type: 'image' as const, image: `data:image/png;base64,${image}` },
    ];

    if (images.length > 0) {
      userContent.push(
        { type: 'text' as const, text: `Here is the full mark scheme (${images.length} page${images.length > 1 ? 's' : ''}). Use it to assess the student's answer against each criterion.` },
      );
      for (const msImg of images) {
        userContent.push(
          { type: 'image' as const, image: `data:image/png;base64,${msImg}` },
        );
      }
    }

    const result = await generateText({
      model: google(process.env.LLM_MODEL || 'gemini-3.1-flash-lite'),
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
  } catch (error: any) {
    console.error('Marking error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Examify server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGQUIT', () => server.close(() => process.exit(0)));
