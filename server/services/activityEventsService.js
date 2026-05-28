import { activityEventsRepository } from "../repositories/activityEventsRepository.js";
import { coreTeamService } from "./coreTeamService.js";
import { activityEventSchema } from "../validators/activityEventSchemas.js";
import cacheService from "./cacheService.js";

export const activityEventsService = {
  async listActivityEvents(activityKey, { page = 1, limit = 20 } = {}) {
    const cacheKey = `activity_events:list:${activityKey}:${page}:${limit}`;
    const cached = cacheService.get(cacheKey);
    if (cached !== undefined) {
      console.log(`[Activity Events Service] Cache HIT for key "${cacheKey}"`);
      return cached;
    }

    console.log(
      `[Activity Events Service] Cache MISS for key "${cacheKey}". Fetching from database.`
    );
    const result = await activityEventsRepository.listByActivityKey(
      activityKey,
      { page, limit }
    );
    cacheService.set(cacheKey, result);
    return result;
  },

  async assertCanManage(body) {
    await coreTeamService.assertCanManageActivityEvent(body);
  },

  async addActivityEvent(activityKey, input) {
    const parsed = activityEventSchema.parse(input);
    const created = await activityEventsRepository.create(activityKey, parsed);

    // Invalidate distributed cache after database mutation
    await cacheService.invalidateCache("activity_events");
    return created;
  },

  async deleteActivityEvent(activityKey, eventId) {
    const deleted = await activityEventsRepository.delete(activityKey, eventId);

    // Invalidate distributed cache after database mutation
    if (deleted) {
      await cacheService.invalidateCache("activity_events");
    }
    return deleted;
  },
};
