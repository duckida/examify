import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { generateText } from 'ai';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/fetch-pdf', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL parameter required' });
      return;
    }
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: `Failed to fetch PDF: ${response.statusText}` });
      return;
    }
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch PDF' });
  }
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const model = google(process.env.LLM_MODEL || 'gemini-3.1-flash-lite');

    const result = await generateText({
      model,
      system: `You are an expert examiner marking student answers against official mark schemes.
Analyze the student's answer using the full mark scheme provided.
Return JSON only, no markdown formatting:
- score (number): marks awarded
- totalMarks (number): total marks available
- feedback (string): detailed feedback referencing specific mark scheme criteria
- breakdown: array of { criterion: string, awarded: boolean, marks: number }`,
      messages: [{ role: 'user', content: userContent }],
      maxOutputTokens: 2000,
      abortSignal: controller.signal,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingLevel: 'low' },
        } satisfies GoogleLanguageModelOptions,
      },
    });

    clearTimeout(timeout);

    const text = result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: 'LLM response did not contain valid JSON', raw: text });
      return;
    }
    res.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    console.error('Marking error:', error);
    const message = error.name === 'AbortError' ? 'AI marking timed out' : (error.message || 'Failed to mark');
    res.status(500).json({ error: message });
  }
});

const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Examify server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGQUIT', () => server.close(() => process.exit(0)));
