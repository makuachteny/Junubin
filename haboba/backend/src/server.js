import http from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { setSocketIO } from './routes/swipes.js';

const httpServer = http.createServer(app);

const io = new SocketIO(httpServer, {
  cors: {
    origin: env.corsOrigin === '*' ? true : env.corsOrigin,
    credentials: true,
  },
});

// Make io available to swipes route for match notifications
setSocketIO(io);

// JWT auth middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    socket.userId = payload.sub;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Join personal room for match notifications
  socket.join(`user:${socket.userId}`);

  socket.on('JOIN_CONVERSATION', async (conversationId) => {
    if (!conversationId || typeof conversationId !== 'string') return;
    // Verify membership before joining room
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: socket.userId } },
    });
    if (member) socket.join(`conv:${conversationId}`);
  });

  socket.on('LEAVE_CONVERSATION', (conversationId) => {
    if (!conversationId || typeof conversationId !== 'string') return;
    socket.leave(`conv:${conversationId}`);
  });

  socket.on('SEND_MESSAGE', async (data, ack) => {
    try {
      if (!data || typeof data !== 'object') return ack?.({ error: 'Invalid payload' });
      const { conversationId, body, type = 'text' } = data;
      if (!conversationId || typeof conversationId !== 'string') return ack?.({ error: 'Invalid conversationId' });
      if (!body || typeof body !== 'string' || body.length > 4000) return ack?.({ error: 'Invalid message body' });

      // Verify membership
      const member = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: socket.userId } },
      });
      if (!member) return ack?.({ error: 'Not a member' });

      const message = await prisma.message.create({
        data: { conversationId, senderId: socket.userId, body, type },
        include: { sender: { select: { id: true, displayName: true } } },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Broadcast to all members in the conversation
      io.to(`conv:${conversationId}`).emit('NEW_MESSAGE', message);
      ack?.({ ok: true, message });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('TYPING_START', ({ conversationId }) => {
    socket.to(`conv:${conversationId}`).emit('TYPING_START', {
      conversationId,
      userId: socket.userId,
    });
  });

  socket.on('TYPING_STOP', ({ conversationId }) => {
    socket.to(`conv:${conversationId}`).emit('TYPING_STOP', {
      conversationId,
      userId: socket.userId,
    });
  });

  socket.on('READ_RECEIPT', ({ conversationId, messageId }) => {
    socket.to(`conv:${conversationId}`).emit('READ_RECEIPT', {
      conversationId,
      messageId,
      userId: socket.userId,
    });
  });

  socket.on('disconnect', () => {
    // Cleanup handled automatically by Socket.IO
  });
});

httpServer.listen(env.port, () => {
  console.log(`JuNubin API + Socket.IO listening on port ${env.port}`);
});

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down...`);
  io.close();
  httpServer.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { io };
