import { supabase } from '@/integrations/supabase/client';

const CHANNEL_NAME = 'online-users';

type PresenceCallback = (count: number, connected: boolean) => void;

class PresenceService {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private subscribers = new Set<PresenceCallback>();
  private isConnected = false;
  private isInitialized = false;

  init() {
    if (this.channel) return;

    this.channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: {
          key: 'shared',
        },
      },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => this.notifyAll())
      .on('presence', { event: 'join' }, () => this.notifyAll())
      .on('presence', { event: 'leave' }, () => this.notifyAll())
      .subscribe((status) => {
        const wasConnected = this.isConnected;
        this.isConnected = status === 'SUBSCRIBED';
        this.isInitialized = true;
        
        // Only notify if connection status actually changed
        if (wasConnected !== this.isConnected) {
          this.notifyAll();
        }
      });
  }

  getCount() {
    if (!this.channel) return 0;
    const state = this.channel.presenceState();
    return Object.keys(state).length;
  }

  getIsConnected() {
    return this.isConnected;
  }

  subscribe(callback: PresenceCallback): () => void {
    this.subscribers.add(callback);
    
    // Initialize channel on first subscriber
    if (!this.channel) {
      this.init();
    }
    
    // Send current state immediately (but not during React render)
    if (this.isInitialized) {
      queueMicrotask(() => {
        callback(this.getCount(), this.isConnected);
      });
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifyAll() {
    const count = this.getCount();
    const connected = this.isConnected;
    this.subscribers.forEach((cb) => cb(count, connected));
  }

  async track(userId: string, metadata: Record<string, unknown>) {
    if (!this.channel) {
      this.init();
    }
    
    // Wait for channel to be ready
    await new Promise<void>((resolve) => {
      const check = () => {
        if (this.isConnected) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });

    await this.channel!.track({
      user_id: userId,
      ...metadata,
    });
  }

  async untrack() {
    if (this.channel) {
      await this.channel.untrack();
    }
  }
}

export const presenceService = new PresenceService();
