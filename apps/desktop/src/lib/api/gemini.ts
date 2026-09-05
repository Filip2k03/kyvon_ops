import { GeminiGenerateRequest, GeminiGenerateResponse } from './types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    this.apiKey = apiKey.trim();
    this.model = model;
  }

  private async generate(request: GeminiGenerateRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required. Please set your Gemini API key in the Gemini Operations panel.');
    }

    const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson.error?.message || `Gemini API HTTP ${response.status}: ${response.statusText}`;
      throw new Error(msg);
    }

    const data: GeminiGenerateResponse = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      throw new Error('Gemini returned an empty response or candidate was filtered.');
    }

    return candidate.content.parts[0].text;
  }

  /**
   * Run a deep UI/UX & Frontend Optimization Analysis
   */
  async auditUiUx(context: {
    screenName: string;
    currentHtmlSnippet?: string;
    metrics?: { ttfbMs: number; fcpMs: number; errorRate: number };
    userFeedbackPrompt?: string;
  }): Promise<string> {
    const systemPrompt = `You are the Lead Principal Design Systems Engineer & UI/UX Architect at KyvonOPS. 
Your goal is to evaluate frontend interfaces and provide humanized, high-converting, accessible (WCAG AAA), and aesthetically flawless UI/UX recommendations.
Always format recommendations with:
1. Executive Polish Score (0-100)
2. Immediate Visual & Micro-Interaction Enhancements (Lucide icon suggestions, contrast, spacing)
3. Accessibility & Keyboard Navigation Directives
4. Performance & Mobile Responsiveness Notes (.apk / .ipa viewport considerations)`;

    const userPrompt = `Audit and enhance the UI/UX for screen: "${context.screenName}".
${context.metrics ? `Current Performance Metrics: TTFB=${context.metrics.ttfbMs}ms, FCP=${context.metrics.fcpMs}ms, ErrorRate=${context.metrics.errorRate}%` : ''}
${context.currentHtmlSnippet ? `Code / Component snippet:\n\`\`\`tsx\n${context.currentHtmlSnippet}\n\`\`\`` : ''}
${context.userFeedbackPrompt ? `User Specific Request: "${context.userFeedbackPrompt}"` : ''}

Provide actionable advice and concrete Tailwind CSS / React 19 / Lucide Icon suggestions.`;

    return this.generate({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });
  }

  /**
   * Analyze Server Outage Risks & Generate Validated Safe Commands
   */
  async triageDevOpsIncident(context: {
    serverAlias: string;
    riskScore: number;
    activeAnomalies: string[];
    recentLogsExcerpt: string;
  }): Promise<string> {
    const systemPrompt = `You are the KyvonOPS 2.0 Autonomous DevOps Intelligence Engine.
You diagnose production Linux server incidents and synthesize zero-guesswork root causes.
RULES:
- Never suggest unbounded destructive commands (e.g. no rm -rf, no iptables -F).
- Suggest schema-validated systemctl, docker, or journalctl commands.
- Correlate Nginx reverse proxy logs with cgroups v2 memory pressure and disk I/O.`;

    const userPrompt = `Server: ${context.serverAlias}
Current Outage Risk Score: ${context.riskScore}/100
Active Anomaly Vectors: ${context.activeAnomalies.join(', ') || 'None detected'}
Recent Critical Logs Excerpt:
${context.recentLogsExcerpt}

Analyze the root cause and provide:
1. Root Cause Summary (1-2 sentences)
2. Immediate Stabilization Plan (Step-by-step)
3. Safe Shell / Systemctl verification commands`;

    return this.generate({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });
  }
}
