import { generateUUID } from "../utils/uuid.js";
import {
  broadcastNotificationSync,
  registerNotificationSyncCallback,
} from "./cacheService.js";

/**
 * Simple in-memory notifications service.
 * Hardened with distributed PostgreSQL pub/sub synchronization.
 */
const MAX_PER_USER = 10000;
const notificationsStore = new Map(); // key: userId|'global', value: array

function _ensureList(userId = "global") {
  if (!notificationsStore.has(userId)) notificationsStore.set(userId, []);
  return notificationsStore.get(userId);
}

// Local operation helpers to apply updates from other instances without re-broadcasting
export function _localAddNotification(userId = "global", note) {
  const list = _ensureList(userId);
  if (list.some((n) => n.id === note.id)) return;
  while (list.length >= MAX_PER_USER) {
    list.pop();
  }
  list.unshift(note);
}

export function _localMarkAsRead(userId = "global", id) {
  const list = _ensureList(userId);
  for (const n of list) {
    if (n.id === id) {
      n.isRead = true;
      break;
    }
  }
}

export function _localMarkAllAsRead(userId = "global") {
  const list = _ensureList(userId);
  list.forEach((n) => (n.isRead = true));
}

export function _localClearAll(userId = "global") {
  notificationsStore.set(userId, []);
}

export function _localRemoveNotification(userId = "global", id) {
  const list = _ensureList(userId);
  const idx = list.findIndex((n) => n.id === id);
  if (idx >= 0) {
    list.splice(idx, 1);
  }
}

// Register the cross-instance synchronization hook
registerNotificationSyncCallback((action, userId, payload) => {
  try {
    if (action === "add") {
      _localAddNotification(userId, payload);
    } else if (action === "markAsRead") {
      _localMarkAsRead(userId, payload.id);
    } else if (action === "markAllAsRead") {
      _localMarkAllAsRead(userId);
    } else if (action === "clearAll") {
      _localClearAll(userId);
    } else if (action === "remove") {
      _localRemoveNotification(userId, payload.id);
    }
  } catch (err) {
    console.error("[Notifications Service] Sync handler error:", err.message);
  }
});

export function getNotifications(userId = "global") {
  return _ensureList(userId)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function addNotification(userId = "global", payload = {}) {
  const list = _ensureList(userId);
  while (list.length >= MAX_PER_USER) {
    list.pop();
  }
  const id = payload.id || generateUUID();
  const note = {
    id,
    type: payload.type || "system",
    title: payload.title || "Notification",
    message: payload.message || "",
    link: payload.link || null,
    isRead: !!payload.isRead,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
  list.unshift(note);

  // Broadcast sync event to all autoscaled instances
  broadcastNotificationSync("add", userId, note);

  return note;
}

export function markAsRead(userId = "global", id) {
  const list = _ensureList(userId);
  let changed = false;
  for (const n of list) {
    if (n.id === id) {
      n.isRead = true;
      changed = true;
      break;
    }
  }
  if (changed) {
    broadcastNotificationSync("markAsRead", userId, { id });
  }
  return changed;
}

export function markAllAsRead(userId = "global") {
  const list = _ensureList(userId);
  list.forEach((n) => (n.isRead = true));
  broadcastNotificationSync("markAllAsRead", userId, {});
}

export function clearAll(userId = "global") {
  notificationsStore.set(userId, []);
  broadcastNotificationSync("clearAll", userId, {});
}

export function removeNotification(userId = "global", id) {
  const list = _ensureList(userId);
  const idx = list.findIndex((n) => n.id === id);
  if (idx >= 0) {
    list.splice(idx, 1);
    broadcastNotificationSync("remove", userId, { id });
    return true;
  }
  return false;
}

export default {
  getNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  clearAll,
  removeNotification,
  _localAddNotification,
  _localMarkAsRead,
  _localMarkAllAsRead,
  _localClearAll,
  _localRemoveNotification,
};
