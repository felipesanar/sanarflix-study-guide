import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20261014210100_b2c_sync_agenda.sql'),
  'utf8',
);

describe('migration b2c_sync_agenda', () => {
  it('agenda às 07:00 UTC (04:00 São Paulo)', () => {
    expect(sql).toContain("'0 7 * * *'");
    expect(sql).toContain("'sync-simulados-b2c'");
  });

  it('desagenda o job existente antes de agendar (idempotente)', () => {
    const i = sql.indexOf('cron.unschedule');
    const j = sql.indexOf('cron.schedule');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });

  it('chama a edge via net.http_post com o segredo do Vault por nome', () => {
    expect(sql).toContain('net.http_post');
    expect(sql).toContain('/functions/v1/sync-simulados-b2c');
    expect(sql).toContain('vault.decrypted_secrets');
    expect(sql).toContain("name = 'service_role_key'");
  });

  it('não versiona nenhum JWT literal', () => {
    expect(sql).not.toMatch(/eyJ/);
  });
});
