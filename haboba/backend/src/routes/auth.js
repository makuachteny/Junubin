import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).optional(),
    password: z.string().min(8),
    displayName: z.string().min(2),
    dateOfBirth: z.string().datetime(),
  })
  .refine((data) => data.email || data.phone, { message: 'email or phone is required' });

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
  password: z.string().min(8),
});

const otpStartSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).optional(),
  })
  .refine((data) => data.email || data.phone, { message: 'email or phone is required' });

const otpVerifySchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).optional(),
    code: z.string().length(6),
  })
  .refine((data) => data.email || data.phone, { message: 'email or phone is required' });

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const signAccessToken = (userId) =>
  jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const createRefreshToken = () => crypto.randomBytes(48).toString('hex');
const otpStore = new Map();
const otpAttempts = new Map(); // track failed attempts per key
const MAX_OTP_ATTEMPTS = 5;

// Clean up expired OTPs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otpStore) {
    if (record.expiresAt < now) otpStore.delete(key);
  }
  for (const [key, record] of otpAttempts) {
    if (record.expiresAt < now) otpAttempts.delete(key);
  }
}, 10 * 60 * 1000);

const issueAuthTokens = async (userId) => {
  const accessToken = signAccessToken(userId);
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      refreshToken,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
};

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: payload.email || undefined }, { phone: payload.phone || undefined }],
      },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        phone: payload.phone,
        passwordHash,
        displayName: payload.displayName,
        dateOfBirth: new Date(payload.dateOfBirth),
        profile: {
          create: {},
        },
      },
      select: { id: true, email: true, phone: true, displayName: true, createdAt: true },
    });

    const tokens = await issueAuthTokens(user.id);
    return res.status(201).json({ ...tokens, user });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: payload.email || undefined }, { phone: payload.phone || undefined }],
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(payload.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokens = await issueAuthTokens(user.id);
    return res.json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
      },
    });
  })
);

router.post(
  '/otp/start',
  asyncHandler(async (req, res) => {
    const payload = otpStartSchema.parse(req.body);
    const key = payload.email ? `email:${payload.email.toLowerCase()}` : `phone:${payload.phone}`;
    const code = '123456';
    otpStore.set(key, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    res.json({ ok: true, expiresInSeconds: 600 });
  })
);

router.post(
  '/otp/verify',
  asyncHandler(async (req, res) => {
    const payload = otpVerifySchema.parse(req.body);
    const key = payload.email ? `email:${payload.email.toLowerCase()}` : `phone:${payload.phone}`;

    // Check attempt limit
    const attempts = otpAttempts.get(key);
    if (attempts && attempts.count >= MAX_OTP_ATTEMPTS && attempts.expiresAt > Date.now()) {
      return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
    }

    const record = otpStore.get(key);
    if (!record || record.expiresAt < Date.now() || payload.code !== record.code) {
      // Track failed attempt
      const current = otpAttempts.get(key) || { count: 0, expiresAt: Date.now() + 10 * 60 * 1000 };
      current.count += 1;
      otpAttempts.set(key, current);
      return res.status(401).json({ error: 'Invalid verification code' });
    }
    otpStore.delete(key);
    otpAttempts.delete(key);

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email: payload.email || undefined }, { phone: payload.phone || undefined }],
      },
      select: { id: true, email: true, phone: true, displayName: true },
    });

    if (!user) {
      const seed = payload.email || payload.phone;
      const safeName = `JuNubin ${String(seed).slice(0, 4)}`;
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12);
      user = await prisma.user.create({
        data: {
          email: payload.email,
          phone: payload.phone,
          passwordHash,
          displayName: safeName,
          dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
          profile: { create: {} },
        },
        select: { id: true, email: true, phone: true, displayName: true },
      });
    }

    const tokens = await issueAuthTokens(user.id);
    res.json({ ...tokens, user });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { select: { id: true, isActive: true } } },
    });
    if (!session || !session.user.isActive || session.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    await prisma.session.delete({ where: { id: session.id } });
    const tokens = await issueAuthTokens(session.user.id);
    res.json(tokens);
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await prisma.session.deleteMany({ where: { refreshToken } });
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { profile: true, photos: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json({ user });
  })
);

export default router;
