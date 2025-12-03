/**
 * VAPI Voice AI Client
 *
 * This module provides the integration with VAPI for the AI Phone Agent.
 * Configure your VAPI_API_KEY and VAPI_PHONE_NUMBER_ID in .env.local
 *
 * VAPI Documentation: https://docs.vapi.ai/
 */

const VAPI_API_URL = "https://api.vapi.ai";

interface VapiConfig {
  apiKey: string;
  phoneNumberId?: string;
}

interface CallOptions {
  phoneNumber: string;
  assistantId?: string;
  metadata?: Record<string, any>;
}

interface TranscriptMessage {
  role: "assistant" | "user";
  message: string;
  timestamp: number;
}

interface CallDetails {
  id: string;
  status: "queued" | "ringing" | "in-progress" | "completed" | "failed";
  phoneNumber: string;
  direction: "inbound" | "outbound";
  duration?: number;
  transcript?: TranscriptMessage[];
  summary?: string;
  recordingUrl?: string;
  createdAt: string;
  endedAt?: string;
}

class VapiClient {
  private apiKey: string;
  private phoneNumberId?: string;

  constructor(config: VapiConfig) {
    this.apiKey = config.apiKey;
    this.phoneNumberId = config.phoneNumberId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${VAPI_API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VAPI API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Initiate an outbound call
   */
  async makeCall(options: CallOptions): Promise<CallDetails> {
    return this.request<CallDetails>("/call/phone", {
      method: "POST",
      body: JSON.stringify({
        phoneNumberId: this.phoneNumberId,
        customer: {
          number: options.phoneNumber,
        },
        assistantId: options.assistantId,
        metadata: options.metadata,
      }),
    });
  }

  /**
   * Get call details by ID
   */
  async getCall(callId: string): Promise<CallDetails> {
    return this.request<CallDetails>(`/call/${callId}`);
  }

  /**
   * List recent calls
   */
  async listCalls(params?: {
    limit?: number;
    createdAtGt?: string;
    createdAtLt?: string;
  }): Promise<CallDetails[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set("limit", params.limit.toString());
    if (params?.createdAtGt) queryParams.set("createdAtGt", params.createdAtGt);
    if (params?.createdAtLt) queryParams.set("createdAtLt", params.createdAtLt);

    const query = queryParams.toString();
    return this.request<CallDetails[]>(`/call${query ? `?${query}` : ""}`);
  }

  /**
   * Get call transcript
   */
  async getTranscript(callId: string): Promise<TranscriptMessage[]> {
    const call = await this.getCall(callId);
    return call.transcript || [];
  }

  /**
   * End an active call
   */
  async endCall(callId: string): Promise<void> {
    await this.request(`/call/${callId}/end`, {
      method: "POST",
    });
  }
}

// Singleton instance
let vapiClient: VapiClient | null = null;

export function getVapiClient(): VapiClient {
  if (!vapiClient) {
    const apiKey = process.env.VAPI_API_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    if (!apiKey) {
      throw new Error("VAPI_API_KEY is not configured");
    }

    vapiClient = new VapiClient({
      apiKey,
      phoneNumberId,
    });
  }

  return vapiClient;
}

export type { VapiConfig, CallOptions, CallDetails, TranscriptMessage };
export { VapiClient };
