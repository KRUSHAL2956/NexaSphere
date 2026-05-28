import { eventsRepository } from "../repositories/eventsRepository.js";
import { eventSchema, eventPatchSchema } from "../validators/eventSchemas.js";
import { readContent, writeContent } from "../storage/contentFileStore.js";
import { sanitizeEventRecord } from "../utils/sanitize.js";

const isDbConfigured = () => Boolean(process.env.DATABASE_URL);

export const eventsService = {
  async listEvents({ page = 1, limit = 20 } = {}) {
    if (isDbConfigured()) {
      const result = await eventsRepository.list({ page, limit });
      const arr = result.rows || [];
      arr.rows = result.rows || [];
      arr.total = result.total ?? 0;
      return arr;
    }
    const content = await readContent();
    const rows = (content.events || []).map((e) => sanitizeEventRecord(e));
    const offset = (page - 1) * limit;
    const paginatedRows = rows.slice(offset, offset + limit);

    const arr = paginatedRows;
    arr.rows = paginatedRows;
    arr.total = rows.length;
    return arr;
  },

  async createEvent(input) {
    const event = eventSchema.parse(input);
    if (isDbConfigured()) {
      return eventsRepository.create(event);
    }
    const content = await readContent();
    content.events = content.events || [];
    const now = new Date().toISOString();
    const toInsert = {
      ...event,
      createdAt: now,
      updatedAt: now,
    };
    content.events.unshift(toInsert);
    await writeContent(content);
    return sanitizeEventRecord(toInsert);
  },

  async updateEvent(id, input) {
    const patch = eventPatchSchema.parse({ ...input, id });
    if (isDbConfigured()) {
      return eventsRepository.update(id, patch);
    }
    const content = await readContent();
    const idx = content.events.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const now = new Date().toISOString();
    content.events[idx] = {
      ...content.events[idx],
      ...patch,
      id,
      updatedAt: now,
    };
    await writeContent(content);
    return sanitizeEventRecord(content.events[idx]);
  },

  async deleteEvent(id) {
    if (isDbConfigured()) {
      return eventsRepository.delete(id);
    }
    const content = await readContent();
    const before = (content.events || []).length;
    content.events = (content.events || []).filter((e) => e.id !== id);
    if (content.events.length === before) return false;
    await writeContent(content);
    return true;
  },
};
