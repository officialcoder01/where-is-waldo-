// Force the app to use the lightweight test session setup before it is imported.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/config/prisma');

describe('POST /levels/:levelId/click', () => {
  let level;
  let secondLevel;
  let waldo;
  let odlaw;
  let outsider;

  beforeAll(async () => {
    // Seed two levels so we can test both valid clicks and cross-level failures.
    level = await prisma.level.create({
      data: {
        name: 'Click Test Level',
        imageUrl: 'http://test.com/click-level.jpg'
      }
    });

    secondLevel = await prisma.level.create({
      data: {
        name: 'Other Click Level',
        imageUrl: 'http://test.com/other-click-level.jpg'
      }
    });

    waldo = await prisma.character.create({
      data: {
        name: 'Waldo',
        xCoord: 100,
        yCoord: 150,
        radius: 12,
        levelId: level.id
      }
    });

    odlaw = await prisma.character.create({
      data: {
        name: 'Odlaw',
        xCoord: 220,
        yCoord: 260,
        radius: 12,
        levelId: level.id
      }
    });

    outsider = await prisma.character.create({
      data: {
        name: 'Wizard Whitebeard',
        xCoord: 50,
        yCoord: 60,
        radius: 10,
        levelId: secondLevel.id
      }
    });
  });

  afterEach(async () => {
    // Remove session progress so each test starts with a clean game state.
    const sessions = await prisma.gameSession.findMany({
      where: {
        levelId: {
          in: [level.id, secondLevel.id]
        }
      },
      select: { id: true }
    });

    const sessionIds = sessions.map((session) => session.id);

    if (sessionIds.length > 0) {
      await prisma.foundCharacter.deleteMany({
        where: {
          sessionId: {
            in: sessionIds
          }
        }
      });
    }

    await prisma.gameSession.deleteMany({
      where: {
        levelId: {
          in: [level.id, secondLevel.id]
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up only the records this suite created.
    await prisma.character.deleteMany({
      where: {
        id: {
          in: [waldo.id, odlaw.id, outsider.id]
        }
      }
    });

    await prisma.level.deleteMany({
      where: {
        id: {
          in: [level.id, secondLevel.id]
        }
      }
    });

    await prisma.$disconnect();
  });

  async function startGame(agent, targetLevelId = level.id) {
    return agent
      .post(`/levels/${targetLevelId}/start`)
      .expect(201);
  }

  test('should return 400 when characterId is missing', async () => {
    const agent = request.agent(app);
    await startGame(agent);

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ xCoord: 100, yCoord: 150 })
      .expect(400);

    expect(res.body.errors.characterId).toBe('Character ID is required');
  });

  test('should return 400 when xCoord and yCoord are missing', async () => {
    const agent = request.agent(app);
    await startGame(agent);

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: waldo.id })
      .expect(400);

    expect(res.body.errors.xCoord).toBe('xCoord is required');
    expect(res.body.errors.yCoord).toBe('yCoord is required');
  });

  test('should return 400 when coordinates are invalid numbers', async () => {
    const agent = request.agent(app);
    await startGame(agent);

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: waldo.id, xCoord: 'bad', yCoord: 150 })
      .expect(400);

    expect(res.body.errors.coordinates).toBe('Coordinates must be valid numbers');
  });

  test('should return 401 when the session cookie has no game session', async () => {
    const res = await request(app)
      .post(`/levels/${level.id}/click`)
      .send({ characterId: waldo.id, xCoord: 100, yCoord: 150 })
      .expect(401);

    expect(res.body.error).toBe('No active game session found in the current session');
  });

  test('should expire an old session, clear the cookie, and return 410', async () => {
    const agent = request.agent(app);
    const startRes = await startGame(agent);

    await prisma.gameSession.update({
      where: { id: startRes.body.sessionId },
      data: {
        expiredAt: new Date(Date.now() - 60 * 1000)
      }
    });

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: waldo.id, xCoord: 100, yCoord: 150 })
      .expect(410);

    const expiredSession = await prisma.gameSession.findUnique({
      where: { id: startRes.body.sessionId }
    });

    expect(res.body.error).toBe('Game session has expired');
    expect(expiredSession.status).toBe('EXPIRED');
    expect(expiredSession.endedAt).not.toBeNull();
    expect(res.headers['set-cookie'].join(' ')).toContain('connect.sid=');
  });

  test('should return 409 when the game session is not ACTIVE', async () => {
    const agent = request.agent(app);
    const startRes = await startGame(agent);

    await prisma.gameSession.update({
      where: { id: startRes.body.sessionId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date()
      }
    });

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: waldo.id, xCoord: 100, yCoord: 150 })
      .expect(409);

    expect(res.body.error).toBe('Game session is not active');
  });

  test('should return 404 when the chosen character does not belong to the level', async () => {
    const agent = request.agent(app);
    await startGame(agent);

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: outsider.id, xCoord: 50, yCoord: 60 })
      .expect(404);

    expect(res.body.status).toBe('character_not_found');
    expect(res.body.correct).toBe(false);
  });

  test('should return 409 when the character was already found', async () => {
    const agent = request.agent(app);
    const startRes = await startGame(agent);

    await prisma.foundCharacter.create({
      data: {
        sessionId: startRes.body.sessionId,
        characterId: waldo.id
      }
    });

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: waldo.id, xCoord: 100, yCoord: 150 })
      .expect(409);

    expect(res.body.status).toBe('already_found');
    expect(res.body.correct).toBe(false);
  });

  test('should return correct false when the click misses the character', async () => {
    const agent = request.agent(app);
    await startGame(agent);

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: waldo.id, xCoord: 400, yCoord: 400 })
      .expect(200);

    expect(res.body.status).toBe('incorrect');
    expect(res.body.correct).toBe(false);
  });

  test('should create a found character when the click is correct', async () => {
    const agent = request.agent(app);
    const startRes = await startGame(agent);

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: waldo.id, xCoord: 100, yCoord: 150 })
      .expect(200);

    const foundCharacter = await prisma.foundCharacter.findUnique({
      where: {
        sessionId_characterId: {
          sessionId: startRes.body.sessionId,
          characterId: waldo.id
        }
      }
    });

    expect(res.body.status).toBe('correct');
    expect(res.body.correct).toBe(true);
    expect(res.body.character.name).toBe('Waldo');
    expect(res.body.foundCharacters).toEqual(['Waldo']);
    expect(foundCharacter).not.toBeNull();
  });

  test('should complete the game when the final character is found', async () => {
    const agent = request.agent(app);
    const startRes = await startGame(agent);

    // Pre-find one character so the next correct click finishes the level.
    await prisma.foundCharacter.create({
      data: {
        sessionId: startRes.body.sessionId,
        characterId: waldo.id
      }
    });

    const res = await agent
      .post(`/levels/${level.id}/click`)
      .send({ characterId: odlaw.id, xCoord: 220, yCoord: 260 })
      .expect(200);

    const completedSession = await prisma.gameSession.findUnique({
      where: { id: startRes.body.sessionId }
    });

    expect(res.body.status).toBe('game_completed');
    expect(res.body.correct).toBe(true);
    expect(res.body.sessionStatus).toBe('COMPLETED');
    expect(res.body.foundCharacters).toEqual(['Waldo', 'Odlaw']);
    expect(completedSession.status).toBe('COMPLETED');
    expect(completedSession.endedAt).not.toBeNull();
  });
});
