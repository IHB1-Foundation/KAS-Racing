import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { TxStatusInfo, SessionEventResult } from '../types/index.js';

let io: Server | null = null;

// Track which sockets are subscribed to which sessions
const sessionSubscriptions = new Map<string, Set<string>>(); // sessionId -> Set<socketId>
const socketSessions = new Map<string, Set<string>>(); // socketId -> Set<sessionId>

export function setupWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/ws',
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[ws] Client connected: ${socket.id}`);

    // Handle session subscription
    socket.on('subscribe', (data: { sessionId: string }) => {
      const { sessionId } = data;
      if (!sessionId) return;

      // Add to session subscriptions
      if (!sessionSubscriptions.has(sessionId)) {
        sessionSubscriptions.set(sessionId, new Set());
      }
      sessionSubscriptions.get(sessionId)!.add(socket.id);

      // Track which sessions this socket is subscribed to
      if (!socketSessions.has(socket.id)) {
        socketSessions.set(socket.id, new Set());
      }
      socketSessions.get(socket.id)!.add(sessionId);

      void socket.join(`session:${sessionId}`);
      console.log(`[ws] ${socket.id} subscribed to session ${sessionId}`);
    });

    // Handle session unsubscription
    socket.on('unsubscribe', (data: { sessionId: string }) => {
      const { sessionId } = data;
      if (!sessionId) return;

      sessionSubscriptions.get(sessionId)?.delete(socket.id);
      socketSessions.get(socket.id)?.delete(sessionId);
      void socket.leave(`session:${sessionId}`);
      console.log(`[ws] ${socket.id} unsubscribed from session ${sessionId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[ws] Client disconnected: ${socket.id}`);

      // Clean up subscriptions
      const sessions = socketSessions.get(socket.id);
      if (sessions) {
        for (const sessionId of sessions) {
          sessionSubscriptions.get(sessionId)?.delete(socket.id);
        }
        socketSessions.delete(socket.id);
      }
    });
  });

  return io;
}

/**
 * Emit txStatusUpdated to all clients subscribed to a session
 */
export function emitTxStatusUpdated(
  sessionId: string,
  txStatus: TxStatusInfo
): void {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('txStatusUpdated', txStatus);
}

/**
 * Emit sessionEventAck to all clients subscribed to a session
 */
export function emitSessionEventAck(
  sessionId: string,
  result: SessionEventResult & { seq: number }
): void {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('sessionEventAck', result);
}

/**
 * Get the Socket.IO server instance
 */
export function getIO(): Server | null {
  return io;
}
