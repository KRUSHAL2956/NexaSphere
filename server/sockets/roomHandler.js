import logger from "../utils/logger.js";

const MAX_ROOMS_PER_SOCKET = 10;

function validateRoomId(roomId) {
  return typeof roomId === "string" && /^[a-zA-Z0-9\-_]{1,100}$/.test(roomId);
}

function roomsCount(socket) {
  return socket.rooms ? socket.rooms.size - 1 : 0;
}

export function registerRoomHandlers(socket, io) {
  socket.on("join_room", (roomId, user, ack) => {
    if (!validateRoomId(roomId)) {
      logger.warn("Invalid roomId for join_room", {
        socketId: socket.id,
        roomId,
      });
      if (typeof ack === "function")
        ack({ success: false, error: "Invalid roomId" });
      return;
    }

    if (roomsCount(socket) >= MAX_ROOMS_PER_SOCKET) {
      logger.warn("Room limit exceeded", { socketId: socket.id });
      if (typeof ack === "function")
        ack({ success: false, error: "Room limit exceeded" });
      return;
    }

    socket.join(roomId);
    logger.info("Socket joined team room", { socketId: socket.id, roomId });

    const sanitized =
      user && typeof user === "object"
        ? {
            id: typeof user.id === "string" ? user.id.slice(0, 100) : undefined,
            name:
              typeof user.name === "string"
                ? user.name.slice(0, 100)
                : "Anonymous",
            color: typeof user.color === "string" ? user.color : "#888",
          }
        : { name: "Anonymous" };

    socket
      .to(roomId)
      .emit("user_joined", {
        socketId: socket.id,
        user: sanitized,
        timestamp: Date.now(),
      });

    if (typeof ack === "function") ack({ success: true, roomId });
  });

  socket.on("leave_room", (roomId, ack) => {
    if (!validateRoomId(roomId)) {
      if (typeof ack === "function")
        ack({ success: false, error: "Invalid roomId" });
      return;
    }

    socket.leave(roomId);
    logger.info("Socket left team room", { socketId: socket.id, roomId });

    socket
      .to(roomId)
      .emit("user_left", { socketId: socket.id, timestamp: Date.now() });

    if (typeof ack === "function") ack({ success: true, roomId });
  });

  socket.on("task_status_update", async (data, ack) => {
    try {
      const { teamRoomId, taskId, newStatus, previousStatus, updatedBy } =
        data || {};

      if (!validateRoomId(teamRoomId)) {
        if (typeof ack === "function")
          ack({ success: false, error: "Invalid teamRoomId" });
        return;
      }

      if (!taskId || !newStatus) {
        if (typeof ack === "function")
          ack({ success: false, error: "taskId and newStatus required" });
        return;
      }

      const validStatuses = ["Todo", "In_Progress", "Review", "Done"];
      if (!validStatuses.includes(newStatus)) {
        if (typeof ack === "function")
          ack({ success: false, error: `Invalid status: ${newStatus}` });
        return;
      }

      const payload = {
        taskId,
        teamRoomId,
        newStatus,
        previousStatus: previousStatus || null,
        updatedBy: updatedBy || null,
        timestamp: Date.now(),
      };

      socket.to(teamRoomId).emit("task_updated", payload);

      if (typeof ack === "function") ack({ success: true, task: payload });
    } catch (err) {
      logger.error("task_status_update error", {
        error: err.message,
        socketId: socket.id,
      });
      if (typeof ack === "function")
        ack({ success: false, error: err.message });
    }
  });

  socket.on("typing_start", (data) => {
    const { teamRoomId, user } = data || {};
    if (!validateRoomId(teamRoomId)) return;

    const safe =
      user && typeof user === "object"
        ? { name: String(user.name || "Anonymous").slice(0, 100) }
        : { name: "Anonymous" };

    socket
      .to(teamRoomId)
      .emit("typing_start", { socketId: socket.id, user: safe });
  });

  socket.on("typing_stop", (data) => {
    const { teamRoomId } = data || {};
    if (!validateRoomId(teamRoomId)) return;

    socket.to(teamRoomId).emit("typing_stop", { socketId: socket.id });
  });
}
