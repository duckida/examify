import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
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

function getModel(provider?: string, hackClubApiKey?: string, modelName?: string) {
  if (provider === 'hackclub' && hackClubApiKey) {
    const hackclub = createOpenRouter({
      apiKey: hackClubApiKey,
      baseUrl: 'https://ai.hackclub.com/proxy/v1',
    });
    return hackclub(modelName || process.env.LLM_MODEL || 'qwen/qwen3.6-flash');
  }
  return google(modelName || process.env.LLM_MODEL || 'gemini-3.1-flash-lite');
}

app.post('/api/parse-mark-scheme', async (req, res) => {
  try {
    const { markSchemePdf, aiProvider, hackClubApiKey, model } = req.body;
    if (!markSchemePdf) {
      res.status(400).json({ error: 'No mark scheme PDF provided' });
      return;
    }

    const usingHackClub = aiProvider === 'hackclub' && hackClubApiKey;
    if (!usingHackClub && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      res.status(500).json({ error: 'No AI API key configured on the server.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const llmModel = getModel(aiProvider, hackClubApiKey, model);

    const result = await generateText({
      model: llmModel,
      system: 'You are a PDF text extraction assistant. Extract ALL text from the provided PDF document. Return only the raw extracted text without any commentary, formatting, or JSON wrapper. Preserve the original content as faithfully as possible.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: 'Extract all text from this mark scheme PDF.' },
            { type: 'file' as const, data: Buffer.from(markSchemePdf, 'base64'), mediaType: 'application/pdf' },
          ],
        },
      ],
      maxOutputTokens: 8000,
      abortSignal: controller.signal,
    });

    clearTimeout(timeout);
    res.json({ text: result.text.trim() });
  } catch (error: any) {
    console.error('Mark scheme parsing error:', error);
    const message = error.name === 'AbortError' ? 'Mark scheme parsing timed out' : (error.message || 'Failed to parse mark scheme');
    res.status(500).json({ error: message });
  }
});

app.post('/api/mark', async (req, res) => {
  try {
    const { image, pageText, parsedMarkSchemeText, questionContext, aiProvider, hackClubApiKey, markingModel } = req.body;
    if (!image) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }

    const usingHackClub = aiProvider === 'hackclub' && hackClubApiKey;
    if (!usingHackClub && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      res.status(500).json({ error: 'No AI API key configured on the server. Select "Free endpoint" or provide a Hack Club AI API key.' });
      return;
    }

    const userContent: any[] = [];

    if (questionContext) {
      userContent.push({ type: 'text' as const, text: `Question context: ${questionContext}` });
    }

    if (pageText) {
      userContent.push({ type: 'text' as const, text: `Student's answer text (extracted from PDF):\n${pageText}` });
    }

    userContent.push(
      { type: 'text' as const, text: 'Here is the student\'s answer page as an image (including any annotations):' },
      { type: 'image' as const, image: `data:image/png;base64,${image}` },
    );

    if (parsedMarkSchemeText) {
      userContent.push(
        { type: 'text' as const, text: `Mark scheme:\n${parsedMarkSchemeText}` },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const model = getModel(aiProvider, hackClubApiKey, markingModel);

    const result = await generateText({
      model,
      system: `You are an expert examiner marking student answers against official mark schemes.
The student's answer is provided as both extracted text and a page image. Use both sources to assess the answer.
The mark scheme text is provided directly. Use it to assess the student's answer against each criterion.
Return JSON only, no markdown formatting:
- score (number): marks awarded
- totalMarks (number): total marks available
- feedback (string): detailed feedback referencing specific mark scheme criteria
- breakdown: array of { criterion: string, awarded: boolean, marks: number }`,
      messages: [{ role: 'user', content: userContent }],
      maxOutputTokens: 2000,
      abortSignal: controller.signal,
      ...(usingHackClub
        ? {}
        : {
            providerOptions: {
              google: {
                thinkingConfig: { thinkingLevel: 'low' },
              } satisfies GoogleLanguageModelOptions,
            },
          }),
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
