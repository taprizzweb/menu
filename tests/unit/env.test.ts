import { describe, expect, it } from 'vitest';
import { EnvError, parseServerEnv } from '@/env';

const good = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcd1234.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(40),
  NEXT_PUBLIC_APP_ORIGIN: 'https://gotomenu.taprizz.in',
  SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(40),
  GUEST_COOKIE_SECRET: 'c'.repeat(48),
  IP_HASH_SALT: 'i'.repeat(24),
};

describe('server env validation', () => {
  it('accepts a complete configuration and applies defaults', () => {
    const env = parseServerEnv(good);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.SENTRY_DSN).toBeUndefined();
  });
  it('treats an empty SENTRY_DSN as not configured', () => {
    expect(parseServerEnv({ ...good, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined();
  });
  it('fails fast and names every missing variable', () => {
    try {
      parseServerEnv({});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError);
      const msg = (e as Error).message;
      for (const k of Object.keys(good)) expect(msg).toContain(k);
      expect(msg).toContain('.env.example');
    }
  });
  it('rejects weak secrets', () => {
    expect(() => parseServerEnv({ ...good, GUEST_COOKIE_SECRET: 'short' })).toThrow(/GUEST_COOKIE_SECRET/);
    expect(() => parseServerEnv({ ...good, IP_HASH_SALT: 'x' })).toThrow(/IP_HASH_SALT/);
  });
  it('rejects a malformed URL', () => {
    expect(() => parseServerEnv({ ...good, NEXT_PUBLIC_SUPABASE_URL: 'not a url' })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
  it('never echoes secret values in the error message', () => {
    try {
      parseServerEnv({ ...good, GUEST_COOKIE_SECRET: 'tooshort-secret-value' });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain('tooshort-secret-value');
    }
  });
});
