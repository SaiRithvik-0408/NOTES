/**
 * AI Note Assistant Engine
 * Provides dual-mode intelligent note operations:
 * 1. Ultra-fast local client-side NLP heuristics (100% offline, zero latency, free).
 * 2. Optional Google Gemini 1.5 Flash API integration when an API key is provided.
 */

export interface AiRequestOptions {
  geminiApiKey?: string;
  maxBullets?: number;
}

const GEMINI_STORAGE_KEY = 'nexus_gemini_api_key';

export function getStoredGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_STORAGE_KEY) || '';
}

export function setStoredGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key.trim()) {
    localStorage.removeItem(GEMINI_STORAGE_KEY);
  } else {
    localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
  }
}

/**
 * Strips HTML tags and decodes basic HTML entities
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/p>|<\/div>|<\/li>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Calls Google Gemini REST API if key is available
 */
async function callGeminiApi(prompt: string, text: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${prompt}\n\nCONTENT:\n${text}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`Gemini API error: ${message}`);
  }

  const data = await response.json();
  const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generatedText) {
    throw new Error('Gemini returned an empty response.');
  }

  return generatedText.trim();
}

/**
 * Summarize Document: extracts key points and executive summary
 */
export async function summarizeDocument(
  content: string,
  options?: AiRequestOptions
): Promise<string> {
  const plainText = htmlToPlainText(content);
  if (!plainText || plainText.length < 20) {
    return '<p><em>Note is too short to generate a summary. Please add more content first.</em></p>';
  }

  const apiKey = options?.geminiApiKey || getStoredGeminiKey();

  if (apiKey) {
    try {
      const prompt =
        'You are an expert executive editor. Summarize the following document into a concise executive summary followed by 3-5 bullet points. Format the output in clean HTML (using <p> and <ul><li> tags). Do not wrap in markdown code blocks.';
      const result = await callGeminiApi(prompt, plainText, apiKey);
      return `<div class="nexus-callout nexus-callout-ai"><div class="nexus-callout-icon">⚡</div><div class="nexus-callout-content"><p><strong>AI Executive Summary:</strong></p>${result.replace(/^```html|```$/gi, '')}</div></div>`;
    } catch (err) {
      console.warn('Gemini summarization failed, falling back to local NLP heuristics:', err);
    }
  }

  // Local Rule-Based NLP Summarizer
  const sentences = plainText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 250);

  if (sentences.length === 0) {
    return `<div class="nexus-callout nexus-callout-ai"><div class="nexus-callout-icon">⚡</div><div class="nexus-callout-content"><p><strong>Summary:</strong> ${plainText.slice(0, 160)}...</p></div></div>`;
  }

  // Score sentences by word frequency and semantic keyword indicators
  const keywords = ['important', 'key', 'main', 'summary', 'overall', 'result', 'crucial', 'must', 'primary', 'conclude', 'goal'];
  const scored = sentences.map((sentence, idx) => {
    let score = 0;
    // Early sentences often contain thesis/context
    if (idx === 0) score += 4;
    if (idx === 1) score += 2;
    // Keyword match
    const lower = sentence.toLowerCase();
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 3;
    }
    // Numbers / statistics usually signal important facts
    if (/\b\d+(?:\.\d+)?%?\b/.test(sentence)) score += 2;
    return { sentence, score, idx };
  });

  scored.sort((a, b) => b.score - a.score);
  const maxBullets = options?.maxBullets || 3;
  const topSentences = scored.slice(0, maxBullets).sort((a, b) => a.idx - b.idx);

  const bulletsHtml = topSentences
    .map((item) => `<li>${item.sentence.replace(/^[-•*]\s*/, '')}</li>`)
    .join('');

  return `
<div class="nexus-callout nexus-callout-ai">
  <div class="nexus-callout-icon">⚡</div>
  <div class="nexus-callout-content">
    <p><strong>Executive Summary (${topSentences.length} Key Points):</strong></p>
    <ul>
      ${bulletsHtml}
    </ul>
  </div>
</div>`;
}

/**
 * Fix Grammar, Typos, Capitalization, and Improve Flow
 */
export async function fixGrammarAndPolish(
  content: string,
  options?: AiRequestOptions
): Promise<string> {
  const plainText = htmlToPlainText(content);
  if (!plainText.trim()) return content;

  const apiKey = options?.geminiApiKey || getStoredGeminiKey();

  if (apiKey) {
    try {
      const prompt =
        'You are a professional copyeditor. Fix all grammar errors, typos, spelling, capitalization, and improve sentence flow while strictly preserving the original meaning. Return clean formatted text with paragraphs.';
      const result = await callGeminiApi(prompt, plainText, apiKey);
      // Convert plain text paragraphs to clean HTML paragraphs
      return result
        .replace(/^```[a-z]*|```$/gim, '')
        .trim()
        .split(/\n\n+/)
        .map((p) => `<p>${p.trim()}</p>`)
        .join('');
    } catch (err) {
      console.warn('Gemini grammar polish failed, falling back to local rules:', err);
    }
  }

  // Local Rule-Based NLP Polish
  let polished = plainText;

  // Common typo dictionary
  const typoDict: [RegExp, string][] = [
    [/\bteh\b/gi, 'the'],
    [/\brecieve\b/gi, 'receive'],
    [/\brecieved\b/gi, 'received'],
    [/\bseperate\b/gi, 'separate'],
    [/\bdefinately\b/gi, 'definitely'],
    [/\boccured\b/gi, 'occurred'],
    [/\buntill\b/gi, 'until'],
    [/\btruely\b/gi, 'truly'],
    [/\baccomodate\b/gi, 'accommodate'],
    [/\balot\b/gi, 'a lot'],
    [/\bwierd\b/gi, 'weird'],
    [/\bgodd\b/gi, 'good'],
    [/\bthier\b/gi, 'their'],
    [/\bexperiance\b/gi, 'experience'],
    [/\benviroment\b/gi, 'environment'],
  ];

  for (const [pattern, replacement] of typoDict) {
    polished = polished.replace(pattern, replacement);
  }

  // Apostrophe contractions
  const contractions: [RegExp, string][] = [
    [/\bdont\b/gi, "don't"],
    [/\bcant\b/gi, "can't"],
    [/\bwont\b/gi, "won't"],
    [/\bisnt\b/gi, "isn't"],
    [/\barent\b/gi, "aren't"],
    [/\bwasnt\b/gi, "wasn't"],
    [/\bwerent\b/gi, "weren't"],
    [/\bcouldnt\b/gi, "couldn't"],
    [/\bshouldnt\b/gi, "shouldn't"],
    [/\bwouldnt\b/gi, "wouldn't"],
    [/\bhavent\b/gi, "haven't"],
    [/\bhasnt\b/gi, "hasn't"],
    [/\bim\b/gi, "I'm"],
    [/\byoure\b/gi, "you're"],
    [/\btheyre\b/gi, "they're"],
    [/\bweve\b/gi, "we've"],
    [/\byouve\b/gi, "you've"],
    [/\bill\b/gi, "I'll"],
    [/\byoull\b/gi, "you'll"],
  ];

  for (const [pattern, replacement] of contractions) {
    polished = polished.replace(pattern, replacement);
  }

  // Standalone 'i' pronoun capitalization
  polished = polished.replace(/\b(i)\b/g, 'I');

  // Fix repeated adjacent words ("the the" -> "the")
  polished = polished.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // Fix punctuation spacing: remove space before punctuation, ensure space after
  polished = polished.replace(/\s+([.,;:!?])/g, '$1');
  polished = polished.replace(/([.,;:!?])(?=[a-zA-Z])/g, '$1 ');

  // Fix sentence capitalization after [.!?] or newline
  polished = polished.replace(/(?:^|[.!?]\s+)([a-z])/g, (_, p1) => _.slice(0, -1) + p1.toUpperCase());

  // Collapse double spaces
  polished = polished.replace(/[ \t]{2,}/g, ' ');

  // Return formatted paragraphs
  return polished
    .split(/\n\n+/)
    .map((p) => `<p>${p.trim()}</p>`)
    .join('');
}

/**
 * Extract Action Items and convert to interactive checklist format
 */
export async function extractActionItems(
  content: string,
  options?: AiRequestOptions
): Promise<string> {
  const plainText = htmlToPlainText(content);
  if (!plainText.trim()) return '';

  const apiKey = options?.geminiApiKey || getStoredGeminiKey();

  if (apiKey) {
    try {
      const prompt =
        'Extract all actionable tasks, to-dos, and next steps from this note. Return only a simple list with each action item on its own line beginning with a dash (-). Do not add preamble or explanations.';
      const result = await callGeminiApi(prompt, plainText, apiKey);
      const lines = result
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.]\s*/, '').trim())
        .filter((l) => l.length > 5);

      if (lines.length > 0) {
        const taskItemsHtml = lines
          .map(
            (task) =>
              `<li data-type="taskItem" data-checked="false"><p>${task}</p></li>`
          )
          .join('');
        return `<h3>✅ Action Checklist</h3><ul data-type="taskList">${taskItemsHtml}</ul>`;
      }
    } catch (err) {
      console.warn('Gemini task extraction failed, falling back to local heuristics:', err);
    }
  }

  // Local Rule-Based Task & Action Item Extractor
  const lines = plainText
    .split(/[\n.!?]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8 && l.length < 200);

  const actionVerbsRegex = /^(?:todo|task|action|need to|must|should|have to|remember to|don't forget to|ensure|verify|create|build|update|implement|fix|review|test|schedule|call|email|send|deploy|investigate|configure|add|remove|refactor|prepare|check)\b/i;

  const extractedTasks: string[] = [];

  for (const line of lines) {
    const clean = line.replace(/^[-*•]\s*/, '').trim();
    if (actionVerbsRegex.test(clean) || /\b(?:by tomorrow|deadline|asap|priority)\b/i.test(clean)) {
      // Capitalize first letter
      const task = clean.charAt(0).toUpperCase() + clean.slice(1);
      if (!extractedTasks.includes(task)) {
        extractedTasks.push(task);
      }
    }
  }

  // Fallback if no imperative verbs found: take any line with bullet point or numbered item
  if (extractedTasks.length === 0) {
    const bulletCandidates = plainText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[-*•\d.]\s+/.test(l))
      .map((l) => l.replace(/^[-*•\d.]\s*/, '').trim())
      .filter((l) => l.length > 5);

    if (bulletCandidates.length > 0) {
      extractedTasks.push(...bulletCandidates.slice(0, 5));
    } else {
      // As a fallback, formulate a review action
      extractedTasks.push(`Review document: "${plainText.slice(0, 45)}..."`);
    }
  }

  const taskListHtml = extractedTasks
    .map(
      (task) =>
        `<li data-type="taskItem" data-checked="false"><p>${task}</p></li>`
    )
    .join('');

  return `<h3>✅ Action Checklist</h3><ul data-type="taskList">${taskListHtml}</ul>`;
}

/**
 * Extract Key Takeaways Callout
 */
export async function extractKeyTakeaways(
  content: string,
  options?: AiRequestOptions
): Promise<string> {
  const plainText = htmlToPlainText(content);
  if (!plainText.trim()) return '';

  const apiKey = options?.geminiApiKey || getStoredGeminiKey();

  if (apiKey) {
    try {
      const prompt =
        'Extract 3 crucial key takeaways from the text. Return only 3 bullet points, each on its own line starting with - .';
      const result = await callGeminiApi(prompt, plainText, apiKey);
      const points = result
        .split('\n')
        .map((p) => p.replace(/^[-*•\d.]\s*/, '').trim())
        .filter((p) => p.length > 5);

      const itemsHtml = points.map((p) => `<li>${p}</li>`).join('');
      return `
<div class="nexus-callout nexus-callout-takeaways">
  <div class="nexus-callout-icon">💡</div>
  <div class="nexus-callout-content">
    <p><strong>Key Takeaways:</strong></p>
    <ul>${itemsHtml}</ul>
  </div>
</div>`;
    } catch (err) {
      console.warn('Gemini takeaways extraction failed, falling back:', err);
    }
  }

  // Heuristic Takeaways
  const sentences = plainText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 220);

  const takeaways = sentences.slice(0, 3).map((s) => `<li>${s}</li>`).join('');

  return `
<div class="nexus-callout nexus-callout-takeaways">
  <div class="nexus-callout-icon">💡</div>
  <div class="nexus-callout-content">
    <p><strong>Key Takeaways:</strong></p>
    <ul>${takeaways}</ul>
  </div>
</div>`;
}
