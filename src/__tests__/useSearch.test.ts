import { describe, expect, it } from 'vitest';
import { eventMatchesQuery, getEventDisplayTitle } from '../hooks/useSearch';

describe('useSearch event helpers', () => {
  const event = {
    id: 'kss-153',
    name: 'KSS #153 — Knowledge Sharing Session',
    shortName: 'KSS #153',
    description: 'Peer-to-peer AI learning session',
    category: 'workshop',
    tags: ['AI', 'Learning'],
  };

  it('matches events by name', () => {
    expect(eventMatchesQuery(event, 'kss')).toBe(true);
    expect(eventMatchesQuery(event, 'knowledge sharing')).toBe(true);
  });

  it('matches events by shortName when title and name are absent', () => {
    expect(eventMatchesQuery({ shortName: 'Open Source Day' }, 'source')).toBe(true);
  });

  it('returns a non-empty display title from name or shortName', () => {
    expect(getEventDisplayTitle(event)).toBe('KSS #153 — Knowledge Sharing Session');
    expect(getEventDisplayTitle({ shortName: 'Open Source Day' })).toBe('Open Source Day');
  });
});
