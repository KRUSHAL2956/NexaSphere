import "dotenv/config";
import helmet from "helmet";
import express from "express";
import { EventEmitter } from "events";
import cors from "cors";
import { google } from "googleapis";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { sendWelcomeVerificationEmail } from "./services/emailService.js";
import { ZodError } from "zod";
import { normalizeFormSubmission } from "./validators/formSchemas.js";
import { adminAuthMiddleware } from "./middleware/adminAuthMiddleware.js";
import analyticsRouter from "./routes/analytics.js";
import { initializeSocketIO, emitToRoom, getRoom } from "./config/socket.js";
import adminStreamRouter from "./routes/adminStream.js";
import { broadcastSSEEvent } from "./services/sseService.js";
import documentationRouter from "./routes/documentation.js";
import monitoringRouter from "./routes/monitoring.js";
import rateLimit from "express-rate-limit";
import 'dotenv/config';
import helmet from 'helmet';
import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { sendWelcomeVerificationEmail } from './services/emailService.js';
import { ZodError } from 'zod';
import { EventEmitter } from 'events';
import { normalizeFormSubmission } from './validators/formSchemas.js';
import { adminAuthMiddleware } from './middleware/adminAuthMiddleware.js';
import analyticsRouter from './routes/analytics.js';
import { initializeSocketIO, emitToRoom, getRoom } from './config/socket.js';
import adminStreamRouter from './routes/adminStream.js';
import { broadcastSSEEvent } from './services/sseService.js';
import {
  apiRateLimiter,
  authRateLimiter,
  formRateLimiter,
  notificationRateLimiter,
  formRateLimiter,
  activityAuthRateLimiter,
} from "./middleware/rateLimiter.js";

import { portfolioRepository } from "./repositories/portfolioRepository.js";
import { Mutex } from "async-mutex";
  portfolioRateLimiter,
  validateLimiters,
} from './middleware/rateLimiter.js';
import { getPublicAppUrl } from './utils/publicAppUrl.js';

// Import required controllers and services
import * as eventsController from './controllers/eventsController.js';
import * as activityEventsController from './controllers/activityEventsController.js';
import * as coreTeamController from './controllers/coreTeamController.js';
import * as formsController from './controllers/formsController.js';
import { eventsService } from './services/eventsService.js';
import { coreTeamService } from './services/coreTeamService.js';
import notificationsService from './services/notificationsService.js';
import { portfolioRepository } from './repositories/portfolioRepository.js';

// Fail fast on startup if any rate limiter failed to export correctly.
validateLimiters();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENT_FILE = path.join(__dirname, 'data', 'content.json');

const app = express();
app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "512kb" }));
const adminEvents = new EventEmitter();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean) : true,
  credentials: false,
}));
app.use(express.json({ limit: '512kb' }));

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  const { method, path } = req;

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const message = `[${method}] ${path} → ${status} (${Math.round(duration)}ms)`;

    if (status >= 500) {
      console.error(message);
    } else if (status >= 400) {
      console.warn(message);
    } else {
      console.log(message);
    }
  });

  next();
}

app.use(requestLogger);

// Mount monitoring + API documentation routes (previously implemented but never registered).
app.use("/api/monitoring", monitoringRouter);
app.use("/api", documentationRouter);

const adminAuth = adminAuthMiddleware.requireAdmin;
adminEvents.on('CORE_TEAM_MEMBER_ADDED', (event) => console.log(`[EVENT] CORE_TEAM_MEMBER_ADDED:`, event));
adminEvents.on('CORE_TEAM_MEMBER_REMOVED', (event) => console.log(`[EVENT] CORE_TEAM_MEMBER_REMOVED:`, event));

const defaultContent = {
  events: [
    {
      id: 'kss-153',
      name: 'KSS #153 — Knowledge Sharing Session',
      shortName: 'KSS #153',
      date: 'March 14, 2025',
      description: 'NexaSphere\'s inaugural Knowledge Sharing Session focused on the impact of AI.',
      status: 'completed',
      icon: 'Brain',
      tags: ['AI', 'Learning', 'Community'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  activityEvents: {},
  coreTeam: [],
};

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

function requiredStrongPassword(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);

  if (value.length < 12 || !hasLower || !hasUpper || !hasNumber || !hasSymbol) {
    throw new Error(
      `${name} must be at least 12 characters and include uppercase, lowercase, number, and symbol`,
    );
  }

  return value;
}

// Enforce admin event password format validation if it's set
const ADMIN_EVENT_PASSWORD = requiredStrongPassword('ADMIN_EVENT_PASSWORD');

getPublicAppUrl();

function normalizePrivateKey(k) {
  return k.includes('\\n') ? k.replace(/\\n/g, '\n') : k;
}

async function ensureContentFile() {
  const dir = path.dirname(CONTENT_FILE);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(CONTENT_FILE);
  } catch {
    await fs.writeFile(
      CONTENT_FILE,
      JSON.stringify(defaultContent, null, 2),
      "utf8",
    );
  }
}
const fileMutex = new Mutex();

export async function runWithFileLock(callback) {
  return await fileMutex.runExclusive(callback);
}

async function readContent() {
  await ensureContentFile();
  const raw = await fs.readFile(CONTENT_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeContent(content) {
  await ensureContentFile();
  await fs.writeFile(CONTENT_FILE, JSON.stringify(content, null, 2), "utf8");
}

let contentLock = Promise.resolve();

function withContentLock(fn) {
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  const current = contentLock;
  contentLock = next;
  return current.then(() => fn()).finally(() => release());
}

export async function supabaseRequest(pathname, { method = "GET", body } = {}) {
  if (!HAS_SUPABASE) throw new Error("Supabase is not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "count=exact" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error (${res.status}): ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Paginated variant: appends LIMIT/OFFSET to a PostgREST GET request and reads
// the total row count from the Content-Range response header (sent when
// Prefer: count=exact is set). Returns { rows, total } instead of a bare array.
async function supabasePaginatedRequest(pathname, page, limit) {
  if (!HAS_SUPABASE) throw new Error("Supabase is not configured");
  const offset = (page - 1) * limit;
  const separator = pathname.includes("?") ? "&" : "?";
  const url = `${SUPABASE_URL}/rest/v1/${pathname}${separator}limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "count=exact",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error (${res.status}): ${text}`);
  }
  const text = await res.text();
  const rows = text ? JSON.parse(text) : [];
  // Content-Range format from PostgREST: "0-19/150" or "*/0" when empty
  const contentRange = res.headers.get("content-range") || "";
  const totalMatch = contentRange.match(/\/(\d+)$/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : rows.length;
  return { rows, total };
}

// Parses ?page and ?limit from a request query object, clamps to safe bounds,
// and returns normalised integers. Defaults: page=1, limit=20, cap=100.
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

function toSafeString(value, max = 4000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function validateWhatsApp(str) {
  const v = String(str || "").trim();
  if (!/^\d{10}$/.test(v))
    throw new Error("WhatsApp must be exactly 10 digits");
  return v;
}

function validateSection(str) {
  const v = String(str || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]$/.test(v))
    throw new Error("Section must be a single letter (A-Z)");
  return v;
}

function sanitizeEvent(input = {}) {
  const status = input.status === "upcoming" ? "upcoming" : "completed";
  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((t) => toSafeString(t, 40))
        .filter(Boolean)
        .slice(0, 12)
    : String(input.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);

  return {
    id:
      toSafeString(input.id || input.shortName || input.name, 80)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `event-${Date.now()}`,
    name: toSafeString(input.name, 120),
    shortName: toSafeString(input.shortName || input.name, 60),
    date: toSafeString(input.date, 80),
    description: toSafeString(input.description, 1200),
    status,
    icon: toSafeString(input.icon || "Pin", 32),
    tags,
  };
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

async function canManageActivityEvent({ name, email, phone, password }) {
  const expectedPassword = process.env.ADMIN_EVENT_PASSWORD;
  if (String(password || "") !== expectedPassword) return false;
  const n = String(name || "")
    .trim()
    .toLowerCase();
  const e = String(email || "")
    .trim()
    .toLowerCase();
  const p = normalizePhone(phone);

  const members = await listCoreTeamStore();
  return members.some(
    (m) =>
      m.name.toLowerCase() === n &&
      m.email.toLowerCase() === e &&
      normalizePhone(m.whatsapp) === p,
  );
}

async function listEventsStore({ page = 1, limit = 20 } = {}) {
  if (HAS_SUPABASE) {
    const { rows, total } = await supabasePaginatedRequest(
      "events?select=*&order=created_at.desc",
      page,
      limit,
    );
    return {
      events: rows.map((r) =>
        sanitizeEventRecord({
          id: r.id,
          name: r.name,
          shortName: r.short_name || r.shortName || r.name,
          date: r.date_text || r.date,
          description: r.description,
          status: r.status,
          icon: r.icon || "Pin",
          tags: Array.isArray(r.tags) ? r.tags : [],
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }),
      ),
      total,
    };
  }
  const content = await readContent();
  const all = (content.events || []).map((event) => sanitizeEventRecord(event));
  const total = all.length;
  const start = (page - 1) * limit;
  return { events: all.slice(start, start + limit), total };
}

function sanitizeEventRecord(event) {
  return event;
}

async function createEventStore(event) {
  if (HAS_SUPABASE) {
    let payload = {
      id: event.id,
      name: event.name,
      short_name: event.shortName,
      date_text: event.date,
      description: event.description,
      status: event.status,
      icon: event.icon,
      tags: event.tags,
    };

    let row;
    try {
      [row] = await supabaseRequest("events", {
        method: "POST",
        body: [payload],
      });
    } catch (e) {
      // Retry with suffix if id collision occurs.
      payload = { ...payload, id: `${event.id}-${Date.now()}` };
      [row] = await supabaseRequest("events", {
        method: "POST",
        body: [payload],
      });
    }
    return sanitizeEventRecord({
      id: row.id,
      name: row.name,
      shortName: row.short_name || row.name,
      date: row.date_text,
      description: row.description,
      status: row.status,
      icon: row.icon || "Pin",
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  // Safe atomic fallback operation preventing data loss using async-mutex
  return withContentLock(async () => {
    const content = await readContent();
    content.events.unshift({
      ...event,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await writeContent(content);
    return sanitizeEventRecord(content.events[0]);
  });
}
async function updateEventStore(id, patch) {
  if (HAS_SUPABASE) {
    const [row] = await supabaseRequest(
      `events?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: {
          name: patch.name,
          short_name: patch.shortName,
          date_text: patch.date,
          description: patch.description,
          status: patch.status,
          icon: patch.icon,
          tags: patch.tags,
          updated_at: new Date().toISOString(),
        },
      },
    );
    if (!row) return null;
    return sanitizeEventRecord({
      id: row.id,
      name: row.name,
      shortName: row.short_name || row.name,
      date: row.date_text,
      description: row.description,
      status: row.status,
      icon: row.icon || "Pin",
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return withContentLock(async () => {
    const content = await readContent();
    const idx = content.events.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    content.events[idx] = {
      ...content.events[idx],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    await writeContent(content);
    return sanitizeEventRecord(content.events[idx]);
  });
}

async function deleteEventStore(id) {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      `events?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  return withContentLock(async () => {
    const content = await readContent();
    const before = content.events.length;
    content.events = content.events.filter((e) => e.id !== id);
    if (content.events.length === before) return false;
    await writeContent(content);
    return true;
  });
}

async function listActivityEventsStore(activityKey, { page = 1, limit = 20 } = {}) {
  if (HAS_SUPABASE) {
    const { rows, total } = await supabasePaginatedRequest(
      `activity_events?activity_key=eq.${encodeURIComponent(activityKey)}&select=*&order=created_at.desc`,
      page,
      limit,
    );
    return {
      events: rows.map((r) =>
        sanitizeActivityEventRecord({
          id: r.id,
          name: r.name,
          date: r.date_text || r.date,
          tagline: r.tagline,
          description: r.description,
          status: r.status || "completed",
          createdAt: r.created_at,
        }),
      ),
      total,
    };
  }
  const content = await readContent();
  const all = (content.activityEvents?.[activityKey] || []).map((event) =>
    sanitizeActivityEventRecord(event),
  );
  const total = all.length;
  const start = (page - 1) * limit;
  return { events: all.slice(start, start + limit), total };
}

function sanitizeActivityEventRecord(event) {
  if (!event || typeof event !== "object") return event;
  const { createdBy, ...safe } = event;
  return safe;
}

async function createActivityEventStore(activityKey, event) {
  if (HAS_SUPABASE) {
    const [row] = await supabaseRequest("activity_events", {
      method: "POST",
      body: [
        {
          id: event.id,
          activity_key: activityKey,
          name: event.name,
          date_text: event.date,
          tagline: event.tagline,
          description: event.description,
          status: event.status,
          created_by_name: event.createdBy?.name || "",
          created_by_email: event.createdBy?.email || "",
          created_by_phone: event.createdBy?.phone || "",
        },
      ],
    });
    return sanitizeActivityEventRecord({
      id: row.id,
      name: row.name,
      date: row.date_text,
      tagline: row.tagline,
      description: row.description,
      status: row.status || "completed",
      createdAt: row.created_at,
    });
  }
  return withContentLock(async () => {
    const content = await readContent();
    content.activityEvents = content.activityEvents || {};
    content.activityEvents[activityKey] =
      content.activityEvents[activityKey] || [];
    content.activityEvents[activityKey].unshift(event);
    await writeContent(content);
    return sanitizeActivityEventRecord(event);
  });
}

async function deleteActivityEventStore(activityKey, eventId) {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      `activity_events?activity_key=eq.${encodeURIComponent(activityKey)}&id=eq.${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  return withContentLock(async () => {
    const content = await readContent();
    content.activityEvents = content.activityEvents || {};
    const list = content.activityEvents[activityKey] || [];
    const next = list.filter((e) => e.id !== eventId);
    if (next.length === list.length) return false;
    content.activityEvents[activityKey] = next;
    await writeContent(content);
    return true;
  });
}

async function listCoreTeamStore() {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      "core_team_members?select=*&order=created_at.asc",
    );
    return rows.map((r) =>
      sanitizeCoreTeamMemberRecord({
        id: r.id,
        name: r.name,
        role: r.role,
        year: r.year,
        branch: r.branch,
        section: r.section,
        email: r.email,
        whatsapp: r.whatsapp,
        linkedin: r.linkedin,
        instagram: r.instagram,
        photoUrl: r.photo_url,
        createdAt: r.created_at,
      }),
    );
  }
  const content = await readContent();
  return (content.coreTeam || []).map((member) =>
    sanitizeCoreTeamMemberRecord(member),
  );
}

function sanitizeCoreTeamMemberRecord(member) {
  return member;
}

async function createCoreTeamStore(member) {
  if (HAS_SUPABASE) {
    const [row] = await supabaseRequest("core_team_members", {
      method: "POST",
      body: [
        {
          name: member.name,
          role: member.role,
          year: member.year,
          branch: member.branch,
          section: member.section,
          email: member.email,
          whatsapp: member.whatsapp,
          linkedin: member.linkedin,
          instagram: member.instagram,
          photo_url: member.photoUrl,
        },
      ],
    });
    return sanitizeCoreTeamMemberRecord({
      id: row.id,
      name: row.name,
      role: row.role,
      year: row.year,
      branch: row.branch,
      section: row.section,
      email: row.email,
      whatsapp: row.whatsapp,
      linkedin: row.linkedin,
      instagram: row.instagram,
      photoUrl: row.photo_url,
      createdAt: row.created_at,
    });
  }
  return withContentLock(async () => {
    const content = await readContent();
    content.coreTeam = content.coreTeam || [];
    const newMember = {
      ...member,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    content.coreTeam.push(newMember);
    await writeContent(content);
    return sanitizeCoreTeamMemberRecord(newMember);
  });
}

async function deleteCoreTeamStore(id) {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      `core_team_members?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  return withContentLock(async () => {
    const content = await readContent();
    content.coreTeam = content.coreTeam || [];
    const before = content.coreTeam.length;
    content.coreTeam = content.coreTeam.filter(
      (m) => String(m.id) !== String(id),
    );
    if (content.coreTeam.length === before) return false;
    await writeContent(content);
    return true;
  });
}

async function appendToSupabaseForms(formType, payload) {
  if (!HAS_SUPABASE) return false;
  try {
    await supabaseRequest("form_submissions", {
      method: "POST",
      body: [
        {
          form_type: formType,
          full_name: toSafeString(payload.fullName, 140),
          college_email: toSafeString(payload.collegeEmail, 140),
          whatsapp: toSafeString(payload.whatsapp, 40),
          payload,
        },
      ],
    });
    return true;
  } catch {
    return false;
    await fs.writeFile(CONTENT_FILE, JSON.stringify(defaultContent, null, 2), 'utf8');
  }
}

function validateWhatsApp(str) {
  const v = String(str || "").trim();
  if (!/^\d{10}$/.test(v))
    throw new Error("WhatsApp must be exactly 10 digits");
  return v;
}

function validateSection(str) {
  const v = String(str || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]$/.test(v))
    throw new Error("Section must be a single letter (A-Z)");
  return v;
}

function sanitizeEvent(input = {}) {
  const status = input.status === "upcoming" ? "upcoming" : "completed";
  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((t) => toSafeString(t, 40))
        .filter(Boolean)
        .slice(0, 12)
    : String(input.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);

  return {
    id:
      toSafeString(input.id || input.shortName || input.name, 80)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `event-${Date.now()}`,
    name: toSafeString(input.name, 120),
    shortName: toSafeString(input.shortName || input.name, 60),
    date: toSafeString(input.date, 80),
    description: toSafeString(input.description, 1200),
    status,
    icon: toSafeString(input.icon || "Pin", 32),
    tags,
  };
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

// Constant-time string comparison that does not short-circuit on the first
// mismatched character. Both operands are encoded to UTF-8 Buffers of equal
// length before the comparison so response time is independent of how many
// leading characters match. Returns false immediately if either value is empty,
// so callers cannot exploit a zero-length buffer edge case.
function timingSafeStringEqual(a, b) {
  const sa = String(a ?? "");
  const sb = String(b ?? "");
  if (!sa.length || !sb.length) return sa === sb;
  const ba = Buffer.from(sa, "utf8");
  const bb = Buffer.from(sb, "utf8");
  // Buffers must be the same byte length for timingSafeEqual. Pad the shorter
  // one so the comparison always runs the full loop.
  if (ba.length !== bb.length) {
    const maxLen = Math.max(ba.length, bb.length);
    const paddedA = Buffer.alloc(maxLen);
    const paddedB = Buffer.alloc(maxLen);
    ba.copy(paddedA);
    bb.copy(paddedB);
    // The length mismatch already means they cannot be equal, but we still run
    // the full comparison so the execution time is data-independent.
    crypto.timingSafeEqual(paddedA, paddedB);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

// Per-IP failed-attempt tracking for the activity-event auth endpoints.
// Mirrors the passkey lockout pattern used for portfolio mutations below.
const failedActivityAuthAttempts = new Map();
const ACTIVITY_AUTH_MAX_ATTEMPTS = 5;
const ACTIVITY_AUTH_LOCKOUT_MS = 15 * 60 * 1000;

function checkActivityAuthLockout(ip) {
  const entry = failedActivityAuthAttempts.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.lockoutUntil) {
    failedActivityAuthAttempts.delete(ip);
    return null;
  }
  return entry;
}

function recordFailedActivityAuth(ip) {
  const entry = failedActivityAuthAttempts.get(ip) || {
    count: 0,
    lockoutUntil: 0,
  };
  entry.count += 1;
  if (entry.count >= ACTIVITY_AUTH_MAX_ATTEMPTS) {
    entry.lockoutUntil = Date.now() + ACTIVITY_AUTH_LOCKOUT_MS;
    entry.count = 0;
  }
  failedActivityAuthAttempts.set(ip, entry);
  return entry;
}

function clearActivityAuthAttempts(ip) {
  failedActivityAuthAttempts.delete(ip);
}

async function canManageActivityEvent({ name, email, phone, password }) {
  const expectedPassword = process.env.ADMIN_EVENT_PASSWORD;
  // Use constant-time comparison to prevent timing-based password recovery.
  if (!timingSafeStringEqual(String(password ?? ""), expectedPassword)) {
    return false;
  }
  const n = String(name || "")
    .trim()
    .toLowerCase();
  const e = String(email || "")
    .trim()
    .toLowerCase();
  const p = normalizePhone(phone);

  const members = await listCoreTeamStore();
  return members.some(
    (m) =>
      m.name.toLowerCase() === n &&
      m.email.toLowerCase() === e &&
      normalizePhone(m.whatsapp) === p,
  );
}

async function listEventsStore() {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest("events?select=*&order=created_at.desc");
    return rows.map((r) =>
      sanitizeEventRecord({
        id: r.id,
        name: r.name,
        shortName: r.short_name || r.shortName || r.name,
        date: r.date_text || r.date,
        description: r.description,
        status: r.status,
        icon: r.icon || "Pin",
        tags: Array.isArray(r.tags) ? r.tags : [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }),
    );
  }
  const content = await readContent();
  return (content.events || []).map((event) => sanitizeEventRecord(event));
}

function sanitizeEventRecord(event) {
  return event;
}

async function createEventStore(event) {
  if (HAS_SUPABASE) {
    let payload = {
      id: event.id,
      name: event.name,
      short_name: event.shortName,
      date_text: event.date,
      description: event.description,
      status: event.status,
      icon: event.icon,
      tags: event.tags,
    };

    let row;
    try {
      [row] = await supabaseRequest("events", {
        method: "POST",
        body: [payload],
      });
    } catch (e) {
      // Retry with suffix if id collision occurs.
      payload = { ...payload, id: `${event.id}-${Date.now()}` };
      [row] = await supabaseRequest("events", {
        method: "POST",
        body: [payload],
      });
    }
    return sanitizeEventRecord({
      id: row.id,
      name: row.name,
      shortName: row.short_name || row.name,
      date: row.date_text,
      description: row.description,
      status: row.status,
      icon: row.icon || "Pin",
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  // Safe atomic fallback operation preventing data loss using async-mutex
  return withContentLock(async () => {
    const content = await readContent();
    content.events.unshift({
      ...event,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await writeContent(content);
    return sanitizeEventRecord(content.events[0]);
  });
}
async function updateEventStore(id, patch) {
  if (HAS_SUPABASE) {
    const [row] = await supabaseRequest(
      `events?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: {
          name: patch.name,
          short_name: patch.shortName,
          date_text: patch.date,
          description: patch.description,
          status: patch.status,
          icon: patch.icon,
          tags: patch.tags,
          updated_at: new Date().toISOString(),
        },
      },
    );
    if (!row) return null;
    return sanitizeEventRecord({
      id: row.id,
      name: row.name,
      shortName: row.short_name || row.name,
      date: row.date_text,
      description: row.description,
      status: row.status,
      icon: row.icon || "Pin",
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return withContentLock(async () => {
    const content = await readContent();
    const idx = content.events.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    content.events[idx] = {
      ...content.events[idx],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    await writeContent(content);
    return sanitizeEventRecord(content.events[idx]);
  });
}

async function deleteEventStore(id) {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      `events?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  return withContentLock(async () => {
    const content = await readContent();
    const before = content.events.length;
    content.events = content.events.filter((e) => e.id !== id);
    if (content.events.length === before) return false;
    await writeContent(content);
    return true;
  });
}

async function listActivityEventsStore(activityKey) {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      `activity_events?activity_key=eq.${encodeURIComponent(activityKey)}&select=*&order=created_at.desc`,
    );
    return rows.map((r) =>
      sanitizeActivityEventRecord({
        id: r.id,
        name: r.name,
        date: r.date_text || r.date,
        tagline: r.tagline,
        description: r.description,
        status: r.status || "completed",
        createdAt: r.created_at,
      }),
    );
  }
  const content = await readContent();
  return (content.activityEvents?.[activityKey] || []).map((event) =>
    sanitizeActivityEventRecord(event),
  );
}

function sanitizeActivityEventRecord(event) {
  if (!event || typeof event !== "object") return event;
  const { createdBy, ...safe } = event;
  return safe;
}

async function createActivityEventStore(activityKey, event) {
  if (HAS_SUPABASE) {
    const [row] = await supabaseRequest("activity_events", {
      method: "POST",
      body: [
        {
          id: event.id,
          activity_key: activityKey,
          name: event.name,
          date_text: event.date,
          tagline: event.tagline,
          description: event.description,
          status: event.status,
          created_by_name: event.createdBy?.name || "",
          created_by_email: event.createdBy?.email || "",
          created_by_phone: event.createdBy?.phone || "",
        },
      ],
    });
    return sanitizeActivityEventRecord({
      id: row.id,
      name: row.name,
      date: row.date_text,
      tagline: row.tagline,
      description: row.description,
      status: row.status || "completed",
      createdAt: row.created_at,
    });
  }
  return withContentLock(async () => {
    const content = await readContent();
    content.activityEvents = content.activityEvents || {};
    content.activityEvents[activityKey] =
      content.activityEvents[activityKey] || [];
    content.activityEvents[activityKey].unshift(event);
    await writeContent(content);
    return sanitizeActivityEventRecord(event);
  });
}

async function deleteActivityEventStore(activityKey, eventId) {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      `activity_events?activity_key=eq.${encodeURIComponent(activityKey)}&id=eq.${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  return withContentLock(async () => {
    const content = await readContent();
    content.activityEvents = content.activityEvents || {};
    const list = content.activityEvents[activityKey] || [];
    const next = list.filter((e) => e.id !== eventId);
    if (next.length === list.length) return false;
    content.activityEvents[activityKey] = next;
    await writeContent(content);
    return true;
  });
}

async function listCoreTeamStore() {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      "core_team_members?select=*&order=created_at.asc",
    );
    return rows.map((r) =>
      sanitizeCoreTeamMemberRecord({
        id: r.id,
        name: r.name,
        role: r.role,
        year: r.year,
        branch: r.branch,
        section: r.section,
        email: r.email,
        whatsapp: r.whatsapp,
        linkedin: r.linkedin,
        instagram: r.instagram,
        photoUrl: r.photo_url,
        createdAt: r.created_at,
      }),
    );
  }
  const content = await readContent();
  return (content.coreTeam || []).map((member) =>
    sanitizeCoreTeamMemberRecord(member),
  );
}

function sanitizeCoreTeamMemberRecord(member) {
  return member;
}

async function createCoreTeamStore(member) {
  if (HAS_SUPABASE) {
    const [row] = await supabaseRequest("core_team_members", {
      method: "POST",
      body: [
        {
          name: member.name,
          role: member.role,
          year: member.year,
          branch: member.branch,
          section: member.section,
          email: member.email,
          whatsapp: member.whatsapp,
          linkedin: member.linkedin,
          instagram: member.instagram,
          photo_url: member.photoUrl,
        },
      ],
    });
    return sanitizeCoreTeamMemberRecord({
      id: row.id,
      name: row.name,
      role: row.role,
      year: row.year,
      branch: row.branch,
      section: row.section,
      email: row.email,
      whatsapp: row.whatsapp,
      linkedin: row.linkedin,
      instagram: row.instagram,
      photoUrl: row.photo_url,
      createdAt: row.created_at,
    });
  }
  return withContentLock(async () => {
    const content = await readContent();
    content.coreTeam = content.coreTeam || [];
    const newMember = {
      ...member,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    content.coreTeam.push(newMember);
    await writeContent(content);
    return sanitizeCoreTeamMemberRecord(newMember);
  });
}

async function deleteCoreTeamStore(id) {
  if (HAS_SUPABASE) {
    const rows = await supabaseRequest(
      `core_team_members?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  return withContentLock(async () => {
    const content = await readContent();
    content.coreTeam = content.coreTeam || [];
    const before = content.coreTeam.length;
    content.coreTeam = content.coreTeam.filter(
      (m) => String(m.id) !== String(id),
    );
    if (content.coreTeam.length === before) return false;
    await writeContent(content);
    return true;
  });
}

async function appendToSupabaseForms(formType, payload) {
  if (!HAS_SUPABASE) return false;
// REST Endpoints
app.get('/healthz', async (req, res) => {
  try {
    const list = await eventsService.listEvents({ page: 1, limit: 1 });
    res.json({
      ok: true,
      events: list?.total ?? 0,
      storage: HAS_SUPABASE ? 'supabase' : 'file',
    });
  } catch (e) {
    res.status(503).json({
      ok: false,
      error: e?.message || 'Health check failed',
      storage: HAS_SUPABASE ? 'supabase' : 'file',
    });
  }
});

// Event channels/content
app.get('/api/content/events', eventsController.listEvents);
app.get('/api/content/activity-events/:activityKey', activityEventsController.listActivityEvents);
app.post('/api/content/activity-events/:activityKey', activityEventsController.addActivityEvent);
app.delete('/api/content/activity-events/:activityKey/:eventId', activityEventsController.deleteActivityEvent);

// Admin Auth Endpoints
app.post('/api/admin/login', authRateLimiter, adminAuthMiddleware.login);
app.post('/api/admin/logout', adminAuthMiddleware.logout);
app.use('/api/admin/analytics', adminAuth, analyticsRouter);
app.use('/api/admin/metrics', adminAuth, adminStreamRouter);

// Event Admin Management
app.get('/api/admin/events', adminAuth, eventsController.adminListEvents);
app.post('/api/admin/events', adminAuth, eventsController.adminCreateEvent);
app.put('/api/admin/events/:id', adminAuth, eventsController.adminUpdateEvent);
app.delete('/api/admin/events/:id', adminAuth, eventsController.adminDeleteEvent);

// Public listings
app.get('/api/content/team', async (req, res) => {
  try {
    const rawMembers = await coreTeamService.listMembers();
    const members = (rawMembers || []).map(m => {
      let email = m.email || null;
      if (email && !email.toLowerCase().endsWith('@glbajajgroup.org')) {
        email = null; // hide personal emails entirely
      }
      return {
        ...m,
        email,
        whatsapp: 'https://chat.whatsapp.com/FhpJEaod2g419jFMfqrhGZ' // official community link
      };
    });
    return res.json({ members });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Failed to load core team' });
  }
});

app.get('/api/content/core-team', async (req, res) => {
  try {
    const rawMembers = await coreTeamService.listMembers();
    const members = (rawMembers || []).map(m => {
      let email = m.email || null;
      if (email && !email.toLowerCase().endsWith('@glbajajgroup.org')) {
        email = null; // hide personal emails entirely
      }
      return {
        ...m,
        email,
        whatsapp: 'https://chat.whatsapp.com/FhpJEaod2g419jFMfqrhGZ' // official community link
      };
    });
    return res.json({ members });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Failed to load core team' });
  }
});

app.post("/api/content/activity-events/:activityKey", activityAuthRateLimiter, async (req, res) => {
  try {
    const activityKey = toSafeString(req.params.activityKey, 80);
    const body = req.body || {};
    const ip = String(req.ip || req.headers["x-forwarded-for"] || "unknown")
      .split(",")[0]
      .trim();

    const lockout = checkActivityAuthLockout(ip);
    if (lockout) {
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
      });
    }

    const auth = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      password: body.password,
    };
    if (!(await canManageActivityEvent(auth))) {
      recordFailedActivityAuth(ip);
      return res
        .status(401)
        .json({
          error: "Unauthorized. Core team details or password did not match.",
        });
    }
    clearActivityAuthAttempts(ip);
// Admin Team Management
app.get('/api/admin/core-team', adminAuth, coreTeamController.adminListCoreTeamMembers);
app.post('/api/admin/core-team', adminAuth, coreTeamController.adminAddCoreTeamMember);
app.delete('/api/admin/core-team/:id', adminAuth, coreTeamController.adminDeleteCoreTeamMember);

// Dynamic forms
app.post('/api/forms/membership', formRateLimiter, formsController.makeHandleForm('membership'));
app.post('/api/forms/recruitment', formRateLimiter, formsController.makeHandleForm('recruitment'));
app.post('/api/core-team/apply', formRateLimiter, formsController.makeHandleForm('core_team'));

app.post('/api/submissions/membership', formRateLimiter, formsController.makeHandleForm('membership'));
app.post('/api/submissions/recruitment', formRateLimiter, formsController.makeHandleForm('recruitment'));

// Admin membership responses
app.get('/api/admin/membership', adminAuth, async (req, res) => {
  const scriptUrl = process.env.MEMBERSHIP_SCRIPT_URL;
  const secret = process.env.MEMBERSHIP_SECRET;

  if (!scriptUrl || !secret) {
    return res.json({ responses: [] });
  }

app.delete(
  "/api/content/activity-events/:activityKey/:eventId",
  activityAuthRateLimiter,
  async (req, res) => {
    try {
      const activityKey = toSafeString(req.params.activityKey, 80);
      const eventId = toSafeString(req.params.eventId, 120);
      const body = req.body || {};
      const ip = String(req.ip || req.headers["x-forwarded-for"] || "unknown")
        .split(",")[0]
        .trim();

      const lockout = checkActivityAuthLockout(ip);
      if (lockout) {
        return res.status(429).json({
          error: "Too many failed attempts. Please try again later.",
        });
      }

      const auth = {
        name: body.name,
        email: body.email,
        phone: body.phone,
        password: body.password,
      };
      if (!(await canManageActivityEvent(auth))) {
        recordFailedActivityAuth(ip);
        return res
          .status(401)
          .json({
            error: "Unauthorized. Core team details or password did not match.",
          });
      }
      clearActivityAuthAttempts(ip);
  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getResponses', token: secret }),
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script returned ${response.status}`);
    }

app.post("/api/admin/login", authRateLimiter, adminAuthMiddleware.login);
app.post("/api/admin/logout", adminAuthMiddleware.logout);
app.get("/api/admin/me", adminAuth, (req, res) => {
  return res.json({ username: req.adminSession.username });
});
app.use("/api/admin/analytics", adminAuth, analyticsRouter);
app.use("/api/admin/metrics", adminAuth, adminStreamRouter);

app.get("/api/admin/events", adminAuth, async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  const { events, total } = await listEventsStore({ page, limit });
  return res.json({
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
    const data = await response.json();
    return res.json({ responses: data.responses || [] });
  } catch (err) {
    console.error('[Membership] Failed to fetch responses:', err.message);
    return res.status(500).json({ error: 'Failed to fetch membership responses' });
  }
});

// Real-time Push Subscriber channels
const pushSubscriptions = new Set();
app.post('/api/notifications/subscribe', (req, res) => {
  try {
    const { subscription } = req.body;
    if (subscription) {
      pushSubscriptions.add(JSON.stringify(subscription));
      if (pushSubscriptions.size > 10000) {
        const oldest = pushSubscriptions.values().next().value;
        pushSubscriptions.delete(oldest);
      }
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/unsubscribe', (req, res) => {
  try {
    const { subscription } = req.body;
    if (subscription) pushSubscriptions.delete(JSON.stringify(subscription));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Server side notifications store api
app.get('/api/notifications', (req, res) => {
  try {
    const userId = req.query.userId || 'global';
    const list = notificationsService.getNotifications(userId);
    return res.json({ notifications: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/mark-read', adminAuth, notificationRateLimiter, (req, res) => {
  try {
    const { id, userId } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const uid = userId || 'global';
    const ok = notificationsService.markAsRead(uid, id);
    return res.json({ success: ok });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/mark-all-read', adminAuth, notificationRateLimiter, (req, res) => {
  try {
    const { userId } = req.body || {};
    notificationsService.markAllAsRead(userId || 'global');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications/:id', adminAuth, notificationRateLimiter, (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.query.userId || 'global';
    const removed = notificationsService.removeNotification(userId, id);
    if (!removed) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications', adminAuth, notificationRateLimiter, (req, res) => {
  try {
    const userId = req.query.userId || 'global';
    notificationsService.clearAll(userId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications', adminAuth, notificationRateLimiter, (req, res) => {
  try {
    const { userId, title, message, type, link } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required' });
    }
    const note = notificationsService.addNotification(userId || 'global', {
      title,
      message,
      type,
      link,
    });
    return res.json({ success: true, notification: note });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Portfolio routing support
app.get('/api/portfolio/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '').trim();
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const portfolio = await portfolioRepository.getByUsername(username);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    return res.json(portfolio);
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

const failedPasskeyAttempts = new Map();

function checkPasskeyLockout(username, ip) {
  const key = `${String(username || '').toLowerCase()}:${ip}`;
  const entry = failedPasskeyAttempts.get(key);
  if (!entry) return null;
  if (Date.now() > entry.lockoutUntil) {
    failedPasskeyAttempts.delete(key);
    return null;
  }
  return entry;
}

function recordFailedPasskeyAttempt(username, ip) {
  const key = `${String(username || '').toLowerCase()}:${ip}`;
  const entry = failedPasskeyAttempts.get(key) || { count: 0, lockoutUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockoutUntil = Date.now() + 15 * 60 * 1000; // 15 min lockout
    entry.count = 0;
  }
  failedPasskeyAttempts.set(key, entry);
  return entry;
}

function clearPasskeyAttempts(username, ip) {
  const key = `${String(username || '').toLowerCase()}:${ip}`;
  failedPasskeyAttempts.delete(key);
}

app.post("/api/forms/membership", formRateLimiter, (req, res) =>
  handleForm("membership", req, res),
);
app.post("/api/forms/recruitment", formRateLimiter, (req, res) =>
  handleForm("recruitment", req, res),
);
app.post("/api/core-team/apply", formRateLimiter, (req, res) =>
  handleForm("core_team", req, res),
);
// Real-time notification subscriber channels
const pushSubscriptions = new Set();
app.post("/api/notifications/subscribe", notificationRateLimiter, (req, res) => {
  try {
    const { subscription } = req.body;
    if (subscription) {
      if (pushSubscriptions.size >= 10000) {
        const oldest = pushSubscriptions.values().next().value;
        pushSubscriptions.delete(oldest);
      }
      pushSubscriptions.add(JSON.stringify(subscription));
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/notifications/unsubscribe", notificationRateLimiter, (req, res) => {
  try {
    const { subscription } = req.body;
    if (subscription) pushSubscriptions.delete(JSON.stringify(subscription));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Server-side notifications API (simple in-memory store)
import notificationsService from "./services/notificationsService.js";

app.get("/api/notifications", adminAuth, notificationRateLimiter, (req, res) => {
  try {
    const userId = req.adminSession?.username || "global";
    const list = notificationsService.getNotifications(userId);
    return res.json({ notifications: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/notifications/mark-read",
  adminAuth,
  notificationRateLimiter,
  (req, res) => {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id required" });
      const uid = req.adminSession?.username || "global";
      const ok = notificationsService.markAsRead(uid, id);
      return res.json({ success: ok });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

app.post(
  "/api/notifications/mark-all-read",
  adminAuth,
  notificationRateLimiter,
  (req, res) => {
    try {
      const uid = req.adminSession?.username || "global";
      notificationsService.markAllAsRead(uid);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

app.delete(
  "/api/notifications/:id",
  adminAuth,
  notificationRateLimiter,
  (req, res) => {
    try {
      const id = req.params.id;
      const uid = req.adminSession?.username || "global";
      const removed = notificationsService.removeNotification(uid, id);
      if (!removed)
        return res.status(404).json({ error: "Notification not found" });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// Delete all notifications for a user (or global)
app.delete(
  "/api/notifications",
  adminAuth,
  notificationRateLimiter,
  (req, res) => {
    try {
      const uid = req.adminSession?.username || "global";
      notificationsService.clearAll(uid);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// Create notification (admin/testing)
app.post(
  "/api/notifications",
  adminAuth,
  notificationRateLimiter,
  (req, res) => {
    try {
      const { title, message, type, link } = req.body || {};
      if (!title || !message)
        return res
          .status(400)
          .json({ error: "title and message are required" });
      const note = notificationsService.addNotification(req.adminSession?.username || "global", {
        title,
        message,
        type,
        link,
      });
      return res.json({ success: true, notification: note });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// Portfolio System API Endpoints
app.get("/api/portfolio/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const portfolio = await portfolioRepository.getByUsername(username);
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    return res.json(portfolio);
  } catch (err) {
    console.error("Error fetching portfolio:", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.put('/api/portfolio', portfolioRateLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const passkey = String(body.passkey || '').trim();
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({
        error: 'Username can only contain alphanumeric characters, underscores, and hyphens',
      });
    }
    if (!passkey || passkey.length < 12) {
      return res.status(400).json({ error: 'Passkey must be at least 12 characters long' });
    }

    const existingPortfolio = await portfolioRepository.getByUsername(username);
    const isNewRegistration = !existingPortfolio;

    const lockout = checkPasskeyLockout(username, ip);
    if (lockout) {
      return res.status(429).json({
        error: 'Too many failed passkey attempts. Please try again later.',
      });
    }

    const isAuthorized = await portfolioRepository.verifyPasskey(username, passkey, {
      allowNew: isNewRegistration,
    });
    if (!isAuthorized) {
      recordFailedPasskeyAttempt(username, ip);
      return res.status(401).json({ error: 'Incorrect passkey for this username' });
    }

    clearPasskeyAttempts(username, ip);

    const saved = await portfolioRepository.createOrUpdate(body);
    return res.json({ ok: true, portfolio: saved });
  } catch (err) {
    console.error('Error saving portfolio:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

process.on('unhandledRejection', (reason) => {
  console.error(
    '[Process] Unhandled rejection:',
    reason instanceof Error ? reason.message : reason,
  );
});

process.on('uncaughtException', (err) => {
  console.error(
    '[Process] Uncaught exception:',
    err instanceof Error ? err.message : err,
  );
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
});

const port = Number(process.env.PORT || 8787);
let server;

if (!process.env.VERCEL) {
  const boot = HAS_SUPABASE ? Promise.resolve() : ensureContentFile();
  boot.then(() => {
    server = app.listen(port, () => {
      console.log(`NexaSphere server listening on http://localhost:${port}`);
    });
    initializeSocketIO(server);
  });
} else {
  server = app.listen(port, () => {
    console.log(`NexaSphere server listening on http://localhost:${port}`);
  });
  initializeSocketIO(server);
}

export default app;
