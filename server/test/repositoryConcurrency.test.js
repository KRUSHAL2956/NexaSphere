import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';

// Set temporary mock DATABASE_URL to pass withDb checks
process.env.DATABASE_URL = 'postgresql://mock_user:mock_pass@localhost:5432/mock_db';

// Instrumentation variables to track client-level query concurrency
let peakConcurrentQueries = 0;
let totalQueriesExecuted = 0;
let clientsCheckedOut = 0;

// Mock the Pool constructor to return our custom pool tracking client checkouts
class MockPool {
  constructor(config) {
    this.config = config;
  }

  async connect() {
    clientsCheckedOut++;
    
    // Per-client concurrency tracker!
    let activeQueriesOnThisClient = 0;
    
    return {
      query: async (sql, params) => {
        totalQueriesExecuted++;
        activeQueriesOnThisClient++;
        
        if (activeQueriesOnThisClient > peakConcurrentQueries) {
          peakConcurrentQueries = activeQueriesOnThisClient;
        }

        // Introduce artificial asynchronous latency to allow any concurrent executions
        // on this specific client connection to overlap and trigger a concurrency peak.
        await new Promise((resolve) => setTimeout(resolve, 15));

        activeQueriesOnThisClient--;

        // Mock query results matching expected database schemas
        if (sql.toLowerCase().includes('count')) {
          return { rows: [{ total: 150 }] };
        }

        if (sql.toLowerCase().includes('select * from events')) {
          return {
            rows: [
              {
                id: 'event-1',
                name: 'GSSoC 2026 Kickoff',
                short_name: 'kickoff',
                date_text: '2026-05-27',
                description: 'Grand opening ceremony of GSSoC 2026',
                status: 'upcoming',
                icon: 'calendar',
                tags: ['oss', 'gssoc'],
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          };
        }

        if (sql.toLowerCase().includes('select * from activity_events')) {
          return {
            rows: [
              {
                id: 'act-1',
                name: 'Pull Request Open',
                date_text: '2026-05-27',
                tagline: 'PR is opened',
                description: 'User opened a pull request in NexaSphere',
                status: 'success',
                created_at: new Date(),
              },
            ],
          };
        }

        return { rows: [] };
      },
      release: () => {
        clientsCheckedOut--;
      },
    };
  }
}

// Monkey-patch pg.Pool before importing the repositories
const originalPool = pg.Pool;
pg.Pool = MockPool;

// Import repositories under test
const { eventsRepository } = await import('../repositories/eventsRepository.js');
const { activityEventsRepository } = await import('../repositories/activityEventsRepository.js');

test('Database Repository Concurrency & Sequential Query Safety Audit', async (t) => {
  
  t.beforeEach(() => {
    peakConcurrentQueries = 0;
    totalQueriesExecuted = 0;
    clientsCheckedOut = 0;
  });

  await t.test('eventsRepository.list executes queries strictly sequentially on the checked-out client', async () => {
    const result = await eventsRepository.list({ page: 2, limit: 10 });

    // Assert return schema correctness
    assert.equal(result.total, 150);
    assert.equal(result.rows.length, 1);
    const row = result.rows[0];
    assert.equal(row.id, 'event-1');
    assert.equal(row.name, 'GSSoC 2026 Kickoff');
    assert.equal(row.shortName, 'kickoff');
    assert.deepEqual(row.tags, ['oss', 'gssoc']);

    // Assert that exactly 2 queries were executed
    assert.equal(totalQueriesExecuted, 2);

    // CRITICAL: Peak concurrent queries on any client must be exactly 1.
    // If it was Promise.all, peakConcurrentQueries would be 2.
    assert.equal(peakConcurrentQueries, 1, 'Client query concurrency violation! Queries executed concurrently.');
  });

  await t.test('activityEventsRepository.listByActivityKey executes queries strictly sequentially on the checked-out client', async () => {
    const result = await activityEventsRepository.listByActivityKey('contributions', { page: 1, limit: 5 });

    // Assert return schema correctness
    assert.equal(result.total, 150);
    assert.equal(result.rows.length, 1);
    const row = result.rows[0];
    assert.equal(row.id, 'act-1');
    assert.equal(row.name, 'Pull Request Open');
    assert.equal(row.tagline, 'PR is opened');

    // Assert that exactly 2 queries were executed
    assert.equal(totalQueriesExecuted, 2);

    // CRITICAL: Peak concurrent queries on any client must be exactly 1.
    assert.equal(peakConcurrentQueries, 1, 'Client query concurrency violation! Queries executed concurrently.');
  });

  await t.test('Simultaneous concurrent API requests run sequentially on individual client connections (no connection collision)', async () => {
    // Replicate high-frequency concurrent traffic in autoscaling / production environments.
    // Five list requests are initiated at the same time.
    const promises = Array.from({ length: 5 }).map(() =>
      eventsRepository.list({ page: 1, limit: 20 })
    );

    const results = await Promise.all(promises);

    // Verify all 5 completed successfully
    assert.equal(results.length, 5);
    results.forEach((res) => {
      assert.equal(res.total, 150);
      assert.equal(res.rows[0].id, 'event-1');
    });

    // Verify that individual clients checked out executed sequentially (no query collisions inside a single checked-out connection).
    assert.equal(peakConcurrentQueries, 1, 'Concurrency hazard detected under simultaneous parallel requests!');
  });
});
