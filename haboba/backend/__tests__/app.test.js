import request from 'supertest';
import app from '../src/app.js';

describe('Express app', () => {
  it('GET / returns service status', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service', 'JuNubin API');
    expect(res.body).toHaveProperty('status', 'running');
  });

  it('GET /v1/health returns ok', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Route not found');
  });

  it('returns 401 for unauthenticated protected routes', async () => {
    const res = await request(app).get('/v1/discover');
    expect(res.status).toBe(401);
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/');
    // Helmet headers
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  describe('rate limiting', () => {
    it('includes rate limit headers', async () => {
      const res = await request(app).get('/');
      expect(res.headers).toHaveProperty('ratelimit-limit');
    });
  });
});

describe('Auth routes validation', () => {
  it('POST /v1/auth/otp/start rejects empty body', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/start')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /v1/auth/otp/start accepts email', async () => {
    const res = await request(app)
      .post('/v1/auth/otp/start')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
  });

  it('POST /v1/auth/otp/verify rejects invalid code', async () => {
    // Start OTP first
    await request(app)
      .post('/v1/auth/otp/start')
      .send({ email: 'verify-test@example.com' });

    const res = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ email: 'verify-test@example.com', code: '000000' });
    expect(res.status).toBe(401);
  });

  it('POST /v1/auth/otp/verify accepts correct code', async () => {
    await request(app)
      .post('/v1/auth/otp/start')
      .send({ email: 'correct-code@example.com' });

    const res = await request(app)
      .post('/v1/auth/otp/verify')
      .send({ email: 'correct-code@example.com', code: '123456' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('user');
  });

  it('POST /v1/auth/refresh rejects invalid token', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'invalid-token-that-does-not-exist' });
    expect(res.status).toBe(401);
  });
});

describe('Protected routes require auth', () => {
  it('GET /v1/discover requires auth', async () => {
    const res = await request(app).get('/v1/discover');
    expect(res.status).toBe(401);
  });

  it('POST /v1/swipes requires auth', async () => {
    const res = await request(app).post('/v1/swipes').send({ toUserId: 'x', type: 'like' });
    expect(res.status).toBe(401);
  });

  it('GET /v1/matches requires auth', async () => {
    const res = await request(app).get('/v1/matches');
    expect(res.status).toBe(401);
  });

  it('PATCH /v1/users/me requires auth', async () => {
    const res = await request(app).patch('/v1/users/me').send({ displayName: 'Test' });
    expect(res.status).toBe(401);
  });
});
