// Novu event trigger — uses Kong gateway (no API key needed)

const NOVU_TRIGGER_URL = 'https://kong.app-prod.sanar.cloud/novu/v1/events/trigger';

export interface TriggerNovuEventInput {
  name: string;
  to: Array<{ subscriberId: string; firstName?: string; lastName?: string; email: string }>;
  payload: Record<string, any>;
  overrides?: Record<string, any>;
  /**
   * When true, injects SendGrid tracking_settings into overrides.email to disable
   * click and open tracking. Required for auth emails (welcome, recovery, reset)
   * to prevent SendGrid from rewrapping links into the broken tracking domain
   * (url*.sanarsaude.com) which has an invalid SSL certificate.
   */
  disableTracking?: boolean;
}

export interface TriggerNovuEventResult {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function triggerNovuEvent(input: TriggerNovuEventInput): Promise<TriggerNovuEventResult> {
  try {
    // Validate inputs
    if (!input.name?.trim()) {
      console.log('[Novu] Validation failed: event name is empty');
      return { ok: false, status: 0, error: 'Event name is required' };
    }

    if (!input.to?.length) {
      console.log('[Novu] Validation failed: no recipients');
      return { ok: false, status: 0, error: 'At least one recipient is required' };
    }

    for (const recipient of input.to) {
      if (!recipient.email || !isValidEmail(recipient.email)) {
        console.log('[Novu] Validation failed: invalid email', recipient.email);
        return { ok: false, status: 0, error: `Invalid email: ${recipient.email}` };
      }
    }

    if (!input.payload?.email || !isValidEmail(input.payload.email)) {
      console.log('[Novu] Validation failed: payload.email missing or invalid');
      return { ok: false, status: 0, error: 'payload.email is required and must be valid' };
    }

    console.log('[Novu] Triggering event:', input.name, 'to:', input.to.map(t => t.email).join(', '));

    const body: Record<string, any> = {
      name: input.name,
      payload: input.payload,
      to: input.to,
    };
    if (input.overrides) {
      body.overrides = input.overrides;
    }

    const response = await fetch(NOVU_TRIGGER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let data: any;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.log('[Novu] Request failed:', response.status, data);
      return { ok: false, status: response.status, data, error: `HTTP ${response.status}` };
    }

    console.log('[Novu] Event triggered successfully:', input.name);
    return { ok: true, status: response.status, data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Novu] Exception:', msg);
    return { ok: false, status: 0, error: msg };
  }
}
