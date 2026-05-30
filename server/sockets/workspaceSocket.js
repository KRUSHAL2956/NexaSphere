import logger from '../utils/logger.js';

const MAX_ROOMS_PER_SOCKET = 10;
const VALID_STATUSES = ['Todo', 'In_Progress', 'Review', 'Done'];

function isValidRoomId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9\-_]{1,100}$/.test(value);
}

function roomsCount(socket) {
  return socket.rooms ? socket.rooms.size - 1 : 0;
}

export function setupWorkspaceSocket(io) {
  io.on('connection', (socket) => {
    const handshakeRoomId = socket.handshake.auth?.roomId || socket.handshake.query?.roomId || null;

    if (handshakeRoomId && isValidRoomId(handshakeRoomId)) {
      if (roomsCount(socket) < MAX_ROOMS_PER_SOCKET) {
        socket.join(handshakeRoomId);
        logger.info('Socket auto-joined room via handshake', {
          socketId: socket.id,
          roomId: handshakeRoomId,
        });
      }
    }

    socket.on('join_room', (roomId, ack) => {
      if (!isValidRoomId(roomId)) {
        if (typeof ack === 'function') ack({ success: false, error: 'Invalid roomId' });
        return;
      }

      if (roomsCount(socket) >= MAX_ROOMS_PER_SOCKET) {
        if (typeof ack === 'function') ack({ success: false, error: 'Room limit exceeded' });
        return;
      }

      socket.join(roomId);
      logger.info('Socket joined room', { socketId: socket.id, roomId });

      socket.to(roomId).emit('user_joined', {
        socketId: socket.id,
        timestamp: Date.now(),
      });

      if (typeof ack === 'function') ack({ success: true, roomId });
    });

    socket.on('leave_room', (roomId, ack) => {
      if (!isValidRoomId(roomId)) {
        if (typeof ack === 'function') ack({ success: false, error: 'Invalid roomId' });
        return;
      }

      socket.leave(roomId);
      logger.info('Socket left room', { socketId: socket.id, roomId });

      socket.to(roomId).emit('user_left', {
        socketId: socket.id,
        timestamp: Date.now(),
      });

      if (typeof ack === 'function') ack({ success: true, roomId });
    });

    socket.on('task_create', async (data, ack) => {
      try {
        const { roomId, task } = data || {};

        if (!isValidRoomId(roomId)) {
          if (typeof ack === 'function') ack({ success: false, error: 'Invalid roomId' });
          return;
        }

        if (!task || !task.title) {
          if (typeof ack === 'function') ack({ success: false, error: 'Task title is required' });
          return;
        }

        const payload = {
          ...task,
          roomId,
          _id: task._id || undefined,
          createdAt: task.createdAt || new Date().toISOString(),
        };

        socket.to(roomId).emit('task_created', payload);

        if (typeof ack === 'function') ack({ success: true, task: payload });
      } catch (err) {
        logger.error('task_create error', {
          error: err.message,
          socketId: socket.id,
        });
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    socket.on('task_update_status', async (data, ack) => {
      try {
        const { roomId, taskId, status, previousStatus, updatedBy } = data || {};

        if (!isValidRoomId(roomId)) {
          if (typeof ack === 'function') ack({ success: false, error: 'Invalid roomId' });
          return;
        }

        if (!taskId || !VALID_STATUSES.includes(status)) {
          if (typeof ack === 'function') {
            ack({
              success: false,
              error: 'taskId and valid status are required',
            });
          }
          return;
        }

        const payload = {
          taskId,
          roomId,
          status,
          previousStatus: previousStatus || null,
          updatedBy: updatedBy || null,
          timestamp: Date.now(),
        };

        socket.to(roomId).emit('task_updated', payload);

        if (typeof ack === 'function') ack({ success: true, task: payload });
      } catch (err) {
        logger.error('task_update_status error', {
          error: err.message,
          socketId: socket.id,
        });
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    socket.on('typing_start', (data) => {
      const { roomId, user } = data || {};
      if (!isValidRoomId(roomId)) return;

      socket.to(roomId).emit('typing_start', {
        socketId: socket.id,
        user:
          user && typeof user === 'object'
            ? { name: String(user.name || 'Anonymous').slice(0, 100) }
            : { name: 'Anonymous' },
      });
    });

    socket.on('typing_stop', (data) => {
      const { roomId } = data || {};
      if (!isValidRoomId(roomId)) return;

      socket.to(roomId).emit('typing_stop', { socketId: socket.id });
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected from workspace handler', {
        socketId: socket.id,
      });
    });
  });
}
