import { eventsRepository } from "../repositories/eventsRepository.js";
import { eventSchema, eventPatchSchema } from "../validators/eventSchemas.js";

export const eventsService = {
  async listEvents({ page = 1, limit = 20 } = {}) {
    return eventsRepository.list({ page, limit });
  },

  async createEvent(input) {
    const event = eventSchema.parse(input);
    return eventsRepository.create(event);
  },

  async updateEvent(id, input) {
    const patch = eventPatchSchema.parse({ ...input, id });
    return eventsRepository.update(id, patch);
  },

  async deleteEvent(id) {
    return eventsRepository.delete(id);
  },
};
