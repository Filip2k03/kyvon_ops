import { CloudflareZone, CloudflareDnsRecord, CloudflareSslSetting, CloudflarePurgeRequest } from './types';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

export class CloudflareClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken.trim();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiToken) {
      throw new Error('Cloudflare API Token is missing. Configure your API token in Settings or Cloudflare Manager.');
    }

    const url = `${CLOUDFLARE_API_BASE}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      const errorMsg = json.errors?.[0]?.message || `Cloudflare API error (${res.status}): ${res.statusText}`;
      throw new Error(errorMsg);
    }

    return json.result as T;
  }

  /**
   * List all verified Cloudflare zones for this account
   */
  async listZones(): Promise<CloudflareZone[]> {
    return this.request<CloudflareZone[]>('/zones?per_page=50&status=active');
  }

  /**
   * List DNS records for a given zone
   */
  async listDnsRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    return this.request<CloudflareDnsRecord[]>(`/zones/${zoneId}/dns_records?per_page=100`);
  }

  /**
   * Create a DNS record (A, AAAA, CNAME, etc.)
   */
  async createDnsRecord(zoneId: string, record: Omit<CloudflareDnsRecord, 'id' | 'zone_id'>): Promise<CloudflareDnsRecord> {
    return this.request<CloudflareDnsRecord>(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }

  /**
   * Update an existing DNS record
   */
  async updateDnsRecord(zoneId: string, recordId: string, record: Partial<CloudflareDnsRecord>): Promise<CloudflareDnsRecord> {
    return this.request<CloudflareDnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(record),
    });
  }

  /**
   * Delete a DNS record
   */
  async deleteDnsRecord(zoneId: string, recordId: string): Promise<{ id: string }> {
    return this.request<{ id: string }>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get SSL/TLS encryption setting
   */
  async getSslSetting(zoneId: string): Promise<CloudflareSslSetting> {
    return this.request<CloudflareSslSetting>(`/zones/${zoneId}/settings/ssl`);
  }

  /**
   * Update SSL/TLS mode (flexible, full, strict)
   */
  async updateSslMode(zoneId: string, value: 'off' | 'flexible' | 'full' | 'strict'): Promise<CloudflareSslSetting> {
    return this.request<CloudflareSslSetting>(`/zones/${zoneId}/settings/ssl`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  }

  /**
   * Purge Cache
   */
  async purgeCache(zoneId: string, payload: CloudflarePurgeRequest): Promise<{ id: string }> {
    return this.request<{ id: string }>(`/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
