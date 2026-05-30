import assert from 'node:assert/strict';
import test from 'node:test';
import { activityEventsService } from '../services/activityEventsService.js';
import { activityEventsRepository } from '../repositories/activityEventsRepository.js';
import { UnauthorizedError } from '../utils/errors.js';

// Mock the repository database operations to avoid hitting a real DB/file
const originalCreate = activityEventsRepository.create;
const originalDelete = activityEventsRepository.delete;

test.before(() => {
  // Set up mock implementations
  activityEventsRepository.create = async (key, data) => {
    return { id: 'mock-id', ...data };
  };
  activityEventsRepository.delete = async (key, id) => {
    return true;
  };
  process.env.ADMIN_EVENT_PASSWORD = 'TestPassword123';
});

test.after(() => {
  // Restore original repository methods
  activityEventsRepository.create = originalCreate;
  activityEventsRepository.delete = originalDelete;
  delete process.env.ADMIN_EVENT_PASSWORD;
});

test('activityEventsService.addActivityEvent rejects unauthorized requests', async () => {
  const unauthorizedInput = {
    name: 'Hackathon Event',
    date: '2026-06-01',
    description: 'A test event description',
    password: 'wrongpassword', // Incorrect password
    coreTeamName: 'John Doe',
    coreTeamEmail: 'john@example.com',
    coreTeamPhone: '1234567890',
  };

  await assert.rejects(
    async () => {
      await activityEventsService.addActivityEvent('hackathons', unauthorizedInput);
    },
    (err) => {
      assert.ok(err instanceof UnauthorizedError);
      return true;
    }
  );
});

test('activityEventsService.addActivityEvent accepts authorized requests', async () => {
  const authorizedInput = {
    name: 'Hackathon Event',
    date: '2026-06-01',
    description: 'A test event description',
    password: 'TestPassword123', // Matches process.env.ADMIN_EVENT_PASSWORD
    // Matching one of the core team fallback members defined in coreTeamService.js
    coreTeamName: 'Ayush Sharma', 
    coreTeamEmail: 'ayush@example.com',
    coreTeamPhone: '9876543210',
  };

  const result = await activityEventsService.addActivityEvent('hackathons', authorizedInput);
  assert.equal(result.name, 'Hackathon Event');
});

test('activityEventsService.deleteActivityEvent rejects unauthorized requests', async () => {
  const unauthorizedInput = {
    password: 'wrongpassword',
    coreTeamName: 'John Doe',
  };

  await assert.rejects(
    async () => {
      await activityEventsService.deleteActivityEvent('hackathons', 'mock-id', unauthorizedInput);
    },
    (err) => {
      assert.ok(err instanceof UnauthorizedError);
      return true;
    }
  );
});

test('activityEventsService.deleteActivityEvent accepts authorized requests', async () => {
  const authorizedInput = {
    password: 'TestPassword123',
    coreTeamName: 'Ayush Sharma',
    coreTeamEmail: 'ayush@example.com',
    coreTeamPhone: '9876543210',
  };

  const result = await activityEventsService.deleteActivityEvent('hackathons', 'mock-id', authorizedInput);
  assert.equal(result, true);
});
