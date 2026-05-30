import { activityEventsRepository } from '../repositories/activityEventsRepository.js';
import { coreTeamService } from './coreTeamService.js';
import { activityEventSchema } from '../validators/activityEventSchemas.js';

export const activityEventsService = {
  async listActivityEvents(activityKey, { page = 1, limit = 20 } = {}) {
    return activityEventsRepository.listByActivityKey(activityKey, { page, limit });
  },

  async assertCanManage(body) {
    await coreTeamService.assertCanManageActivityEvent(body);
  },

  async addActivityEvent(activityKey, input) {
    await this.assertCanManage(input);
    const parsed = activityEventSchema.parse(input);
    return activityEventsRepository.create(activityKey, parsed);
  },

  async deleteActivityEvent(activityKey, eventId, input) {
    await this.assertCanManage(input);
    return activityEventsRepository.delete(activityKey, eventId);
  },
};
