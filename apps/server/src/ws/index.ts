import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { TxStatusInfo, SessionEventResult, ChainStateEvent, MatchStateEvent } from '../types/index.js';
import type { Match } from '../db/schema.js';

let io: Server | null = null;

// Track which sockets are subscribed to which sessions
const sessionSubscriptions = new Map<string, Set<string>>(); // sessionId -> Set<socketId>
const socketSessions = new Map<string, Set<string>>(); // socketId -> Set<sessionId>

// Track which sockets are subscribed to which matches
const matchSubscriptions = new Map<string, Set<string>>(); // matchId -> Set<socketId>
const socketMatches = new Map<string, Set<string>>(); // socketId -> Set<matchId>

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

    // Handle match subscription
    socket.on('subscribeMatch', (data: { matchId: string }) => {
      const { matchId } = data;
      if (!matchId) return;

      // Add to match subscriptions
      if (!matchSubscriptions.has(matchId)) {
        matchSubscriptions.set(matchId, new Set());
      }
      matchSubscriptions.get(matchId)!.add(socket.id);

      // Track which matches this socket is subscribed to
      if (!socketMatches.has(socket.id)) {
        socketMatches.set(socket.id, new Set());
      }
      socketMatches.get(socket.id)!.add(matchId);

      void socket.join(`match:${matchId}`);
      console.log(`[ws] ${socket.id} subscribed to match ${matchId}`);
    });

    // Handle match unsubscription
    socket.on('unsubscribeMatch', (data: { matchId: string }) => {
      const { matchId } = data;
      if (!matchId) return;

      matchSubscriptions.get(matchId)?.delete(socket.id);
      socketMatches.get(socket.id)?.delete(matchId);
      void socket.leave(`match:${matchId}`);
      console.log(`[ws] ${socket.id} unsubscribed from match ${matchId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[ws] Client disconnected: ${socket.id}`);

      // Clean up session subscriptions
      const sessions = socketSessions.get(socket.id);
      if (sessions) {
        for (const sessionId of sessions) {
          sessionSubscriptions.get(sessionId)?.delete(socket.id);
        }
        socketSessions.delete(socket.id);
      }

      // Clean up match subscriptions
      const matchIds = socketMatches.get(socket.id);
      if (matchIds) {
        for (const matchId of matchIds) {
          matchSubscriptions.get(matchId)?.delete(socket.id);
        }
        socketMatches.delete(socket.id);
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
 * Emit matchUpdated to all clients subscribed to a match
 */
export function emitMatchUpdated(
  matchId: string,
  match: Match
): void {
  if (!io) return;
  io.to(`match:${matchId}`).emit('matchUpdated', {
    id: match.id,
    status: match.status,
    playerA: match.playerAAddress ? {
      address: match.playerAAddress,
      depositTxid: match.playerADepositTxid,
      depositStatus: match.playerADepositStatus,
    } : null,
    playerB: match.playerBAddress ? {
      address: match.playerBAddress,
      depositTxid: match.playerBDepositTxid,
      depositStatus: match.playerBDepositStatus,
    } : null,
    winner: match.winnerId,
    playerAScore: match.playerAScore,
    playerBScore: match.playerBScore,
    settleTxid: match.settleTxid,
    settleStatus: match.settleStatus,
  });
}

/**
 * Emit chainStateChanged to clients subscribed to a session or match.
 * Routes to the appropriate room based on entityType.
 */
export function emitChainStateChanged(event: ChainStateEvent): void {
  if (!io) return;

  if (event.entityType === 'reward') {
    // Reward events belong to sessions
    io.to(`session:${event.entityId}`).emit('chainStateChanged', event);
  } else {
    // Deposit/settlement events belong to matches
    io.to(`match:${event.entityId}`).emit('chainStateChanged', event);
  }
}

/**
 * Emit matchStateChanged to clients subscribed to a match.
 */
export function emitMatchStateChanged(event: MatchStateEvent): void {
  if (!io) return;
  io.to(`match:${event.matchId}`).emit('matchStateChanged', event);
}

// ── V3 EVM Events ──

/**
 * Emit raw EVM chain event to all connected clients.
 * Clients can filter by contract/eventName on their side.
 */
export function emitEvmChainEvent(event: import('../types/evm.js').EvmChainEventInfo): void {
  if (!io) return;
  io.emit('evmChainEvent', event);
}

/**
 * Emit EVM match update to clients subscribed to a specific match.
 */
export function emitEvmMatchUpdate(
  matchId: string,
  eventName: string,
  chainEvent: import('../types/evm.js').EvmChainEventInfo,
): void {
  if (!io) return;
  io.to(`match:${matchId}`).emit('evmMatchUpdate', { matchId, eventName, chainEvent });
}

/**
 * Emit EVM reward update to clients subscribed to the session.
 * Routes by txHash since the session room uses sessionId.
 */
export function emitEvmRewardUpdate(
  txHash: string,
  eventName: string,
  chainEvent: import('../types/evm.js').EvmChainEventInfo,
): void {
  if (!io) return;
  // Broadcast to all — client filters by relevance
  // (We don't have a txHash→sessionId mapping here; the client
  //  knows which txHashes belong to its session)
  io.emit('evmRewardUpdate', { txHash, eventName, chainEvent });
}

/**
 * Get the Socket.IO server instance
 */
export function getIO(): Server | null {
  return io;
}
