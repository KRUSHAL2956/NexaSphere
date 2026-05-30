import { generateUUID } from '../utils/uuid.js';

const MAX_PER_USER = 10000;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const notificationsStore = new Map();

function _ensureList(userId = 'global') {
  if (!notificationsStore.has(userId)) notificationsStore.set(userId, []);
  return notificationsStore.get(userId);
}

function _removeExpired(list) {
  const cutoff = Date.now() - TTL_MS;
  while (list.length > 0 && new Date(list[list.length - 1].createdAt).getTime() < cutoff) {
    list.pop();
  }
}

export function getNotifications(userId = 'global') {
  const list = _ensureList(userId);
  _removeExpired(list);
  return list.slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
}

export function addNotification(userId = 'global', payload = {}) {
  const list = _ensureList(userId);
  _removeExpired(list);
  while (list.length >= MAX_PER_USER) {
    list.shift();
  }
  const id = generateUUID();
  const note = {
    id,
    type: payload.type || 'system',
    title: payload.title || 'Notification',
    message: payload.message || '',
    link: payload.link || null,
    isRead: !!payload.isRead,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
  list.unshift(note);
  return note;
}

export function markAsRead(userId = 'global', id) {
  const list = _ensureList(userId);
  let changed = false;
  for (const n of list) {
    if (n.id === id) { n.isRead = true; changed = true; break; }
  }
  return changed;
}

export function markAllAsRead(userId = 'global') {
  const list = _ensureList(userId);
  list.forEach(n => n.isRead = true);
}

export function clearAll(userId = 'global') {
  notificationsStore.set(userId, []);
}

export function removeNotification(userId = 'global', id) {
  const list = _ensureList(userId);
  const idx = list.findIndex(n => n.id === id);
  if (idx >= 0) {
    list.splice(idx, 1);
    return true;
  }
  return false;
}

export default {
  getNotifications, addNotification, markAsRead, markAllAsRead, clearAll, removeNotification,
};
