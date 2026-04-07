const { isWithinRadius, validateClick } = require('../../src/services/validationService');

describe('isWithinRadius', () => {
  test('returns true when click is inside radius', () => {
    const result = isWithinRadius(50, 50, 52, 53, 5);
    expect(result).toBe(true);
  });

  test('returns false when click is outside radius', () => {
    const result = isWithinRadius(50, 50, 70, 70, 5);
    expect(result).toBe(false);
  });

  test('returns true when click is exactly on boundary', () => {
    const result = isWithinRadius(50, 50, 55, 50, 5);
    expect(result).toBe(true);
  });
});

describe('validateClick', () => {
  function createSession(overrides = {}) {
    return {
      id: 'session123',
      status: 'ACTIVE',
      foundChars: [],
      level: {
        characters: [
          { id: 'character1', name: 'Waldo' },
          { id: 'character2', name: 'Odlaw' }
        ]
      },
      ...overrides
    };
  }

  const waldo = {
    id: 'character1',
    name: 'Waldo',
    xCoord: 100,
    yCoord: 150,
    radius: 10
  };

  const odlaw = {
    id: 'character2',
    name: 'Odlaw',
    xCoord: 200,
    yCoord: 250,
    radius: 10
  };

  test('returns session_not_found when no session exists', async () => {
    const result = await validateClick({
      session: null,
      character: waldo,
      clickX: 100,
      clickY: 150
    });

    expect(result.status).toBe('session_not_found');
  });

  test('returns game_completed when the session is already completed', async () => {
    const result = await validateClick({
      session: createSession({ status: 'COMPLETED' }),
      character: waldo,
      clickX: 100,
      clickY: 150
    });

    expect(result.status).toBe('game_completed');
  });

  test('returns character_not_found when no character is provided', async () => {
    const result = await validateClick({
      session: createSession(),
      character: null,
      clickX: 100,
      clickY: 150
    });

    expect(result.status).toBe('character_not_found');
  });

  test('returns already_found when the character is already in foundChars', async () => {
    const session = createSession({
      foundChars: [
        {
          characterId: 'character1',
          character: { id: 'character1', name: 'Waldo' }
        }
      ]
    });

    const result = await validateClick({
      session,
      character: waldo,
      clickX: 100,
      clickY: 150
    });

    expect(result.status).toBe('already_found');
    expect(session.foundChars).toHaveLength(1);
  });

  test('returns incorrect when the click misses the character', async () => {
    const session = createSession();

    const result = await validateClick({
      session,
      character: waldo,
      clickX: 500,
      clickY: 500
    });

    expect(result.status).toBe('incorrect');
    expect(session.foundChars).toHaveLength(0);
    expect(session.status).toBe('ACTIVE');
  });

  test('returns correct and appends the found character when the click is valid', async () => {
    const session = createSession();

    const result = await validateClick({
      session,
      character: waldo,
      clickX: 100,
      clickY: 150
    });

    expect(result.status).toBe('correct');
    expect(session.foundChars).toHaveLength(1);
    expect(session.foundChars[0].characterId).toBe('character1');
    expect(session.status).toBe('ACTIVE');
  });

  test('returns game_completed when the last remaining character is found', async () => {
    const session = createSession({
      foundChars: [
        {
          characterId: 'character1',
          character: { id: 'character1', name: 'Waldo' }
        }
      ]
    });

    const result = await validateClick({
      session,
      character: odlaw,
      clickX: 200,
      clickY: 250
    });

    expect(result.status).toBe('game_completed');
    expect(session.foundChars).toHaveLength(2);
    expect(session.status).toBe('COMPLETED');
  });
});
