import { describe, it, expect } from '@jest/globals';

/**
 * env.js runs validation at import-time and ESM caches modules,
 * so we can't re-import with different env vars. Instead we test
 * the validation logic inline and verify the exported shape.
 */

// Replicate the validation logic from env.js
function validateEnv(envVars) {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  for (const key of required) {
    if (!envVars[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  return {
    nodeEnv: envVars.NODE_ENV || 'development',
    port: Number(envVars.PORT || 4000),
    databaseUrl: envVars.DATABASE_URL,
    jwtSecret: envVars.JWT_SECRET,
    jwtExpiresIn: envVars.JWT_EXPIRES_IN || '7d',
    corsOrigin: envVars.CORS_ORIGIN || '*',
  };
}

describe('env config validation', () => {
  it('throws if DATABASE_URL is missing', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'test-secret' })
    ).toThrow('DATABASE_URL');
  });

  it('throws if JWT_SECRET is missing', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'postgresql://localhost/test' })
    ).toThrow('JWT_SECRET');
  });

  it('uses defaults for optional values', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://localhost/test',
      JWT_SECRET: 'test-secret',
    });
    expect(env.port).toBe(4000);
    expect(env.corsOrigin).toBe('*');
    expect(env.nodeEnv).toBe('development');
  });

  it('respects provided optional values', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://localhost/test',
      JWT_SECRET: 'test-secret',
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'production',
    });
    expect(env.port).toBe(3000);
    expect(env.corsOrigin).toBe('http://localhost:3000');
    expect(env.nodeEnv).toBe('production');
  });
});

describe('env module export', () => {
  it('exports an env object with required keys', async () => {
    // This import uses the cached module (which loaded from .env / process.env)
    const { env } = await import('../src/config/env.js');
    expect(env).toHaveProperty('databaseUrl');
    expect(env).toHaveProperty('jwtSecret');
    expect(env).toHaveProperty('port');
    expect(env).toHaveProperty('nodeEnv');
    expect(env).toHaveProperty('corsOrigin');
    expect(typeof env.port).toBe('number');
  });
});
