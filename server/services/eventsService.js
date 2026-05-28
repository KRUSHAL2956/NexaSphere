import { eventsRepository } from "../repositories/eventsRepository.js";
import { eventSchema } from "../validators/eventSchemas.js";
import cacheService from "./cacheService.js";

export const eventsService = {
  async listEvents({ page = 1, limit = 20 } = {}) {
    const cacheKey = `events:list:${page}:${limit}`;
    const cached = cacheService.get(cacheKey);
    if (cached !== undefined) {
      console.log(`[Events Service] Cache HIT for key "${cacheKey}"`);
      return cached;
    }

    console.log(
      `[Events Service] Cache MISS for key "${cacheKey}". Fetching from database.`
    );
    const result = await eventsRepository.list({ page, limit });
    cacheService.set(cacheKey, result);
    return result;
  },

  async createEvent(input) {
    const event = eventSchema.parse(input);
    const created = await eventsRepository.create(event);

    // Invalidate distributed events cache after successful commit
    await cacheService.invalidateCache("events");
    return created;
  },

  async updateEvent(id, input) {
    const patch = eventSchema.partial().parse({ ...input, id });
    const updated = await eventsRepository.update(id, patch);

    // Invalidate distributed events cache after successful commit
    if (updated) {
      await cacheService.invalidateCache("events");
    }
    return updated;
  },

  async deleteEvent(id) {
    const deleted = await eventsRepository.delete(id);

    // Invalidate distributed events cache after successful commit
    if (deleted) {
      await cacheService.invalidateCache("events");
    }
    return deleted;
  },
};
