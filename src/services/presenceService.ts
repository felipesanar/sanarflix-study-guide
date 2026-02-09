import { supabase } from '@/integrations/supabase/client';

const CHANNEL_NAME = 'online-users';

class PresenceService {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private subscribers = new Set<() => void>();
  private isConnected = false;

  getChannel() {
    if (!this.channel) {
      this.channel = supabase.channel(CHANNEL_NAME, {
        config: {
          presence: {
            key: 'shared',
          },
        },
      });

      this.channel
        .on('presence', { event: 'sync' }, () => this.notify())
        .on('presence', { event: 'join' }, () => this.notify())
        .on('presence', { event: 'leave' }, () => this.notify())
        .subscribe((status) => {
          this.isConnected = status === 'SUBSCRIBED';
          this.notify();
        });
    }
    return this.channel;
  }

  getState() {
    return this.channel?.presenceState() ?? {};
  }

  getCount() {
    const state = this.getState();
    // Each key in presence state represents a unique user
    return Object.keys(state).length;
  }

  getIsConnected() {
    return this.isConnected;
  }

  subscribe(callback: () => void) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify() {
    this.subscribers.forEach((cb) => cb());
  }

  async track(userId: string, metadata: Record<string, unknown>) {
    const channel = this.getChannel();
    await channel.track({
      user_id: userId,
      ...metadata,
    });
  }

  async untrack() {
    await this.channel?.untrack();
  }
}

export const presenceService = new PresenceService();
