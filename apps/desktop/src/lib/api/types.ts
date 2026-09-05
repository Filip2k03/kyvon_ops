// Real-World API Types for KyvonOPS 2.0 (Cloudflare, Gemini, Reverse Proxy & Stripe)

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  name_servers: string[];
  original_name_servers: string[];
}

export interface CloudflareDnsRecord {
  id?: string;
  zone_id: string;
  zone_name?: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS' | 'SRV';
  content: string;
  proxiable?: boolean;
  proxied: boolean;
  ttl: number; // 1 = automatic
  comment?: string;
  tags?: string[];
  created_on?: string;
  modified_on?: string;
}

export interface CloudflareSslSetting {
  id: string;
  value: 'off' | 'flexible' | 'full' | 'strict';
  editable: boolean;
  modified_on?: string;
}

export interface CloudflarePurgeRequest {
  purge_everything?: boolean;
  files?: string[];
  tags?: string[];
  hosts?: string[];
  prefixes?: string[];
}

// Gemini AI Types
export interface GeminiMessagePart {
  text: string;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiMessagePart[];
}

export interface GeminiGenerateRequest {
  contents: GeminiContent[];
  systemInstruction?: {
    parts: GeminiMessagePart[];
  };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

export interface GeminiCandidate {
  content: {
    parts: GeminiMessagePart[];
    role: string;
  };
  finishReason: string;
  avgLogprobs?: number;
}

export interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    safetyRatings: Array<{ category: string; probability: string }>;
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// Reverse Proxy Types
export interface ReverseProxyRoute {
  domain: string;
  upstreamUrl: string; // e.g., "127.0.0.1:3000" or "unix:/run/app.sock"
  enableWebsockets: boolean;
  enableGzip: boolean;
  customHeaders?: Record<string, string>;
  sslMode: 'cloudflare_origin' | 'letsencrypt' | 'custom' | 'off';
  certPath?: string;
  keyPath?: string;
}

// Stripe Types
export interface DonationTier {
  id: string;
  amount: number; // in USD
  name: string;
  description: string;
  perk: string;
  popular?: boolean;
}

export interface StripeCheckoutPayload {
  amountUsd: number;
  donorName?: string;
  donorEmail?: string;
  message?: string;
  currency?: string;
}
