// Force the app to use the lightweight test session setup before it is imported.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/config/prisma');

describe('POST /levels/:levelId/start', () => {
  let level;
  let secondLevel;
  let waldo;

  beforeAll(async () => {
    // Seed only the records this suite needs so each test can focus on behavior.
    level = await prisma.level.create({
      data: {
        name: 'Test Level',
        imageUrl: 'http://test.com/image.jpg'
      }
    });

    secondLevel = await prisma.level.create({
      data: {
        name: 'Second Test Level',
        imageUrl: 'http://test.com/second-image.jpg'
      }
    });

    waldo = await prisma.character.create({
      data: {
        name: 'Waldo',
        xCoord: 10,
        yCoord: 20,
        radius: 5,
        levelId: level.id
      }
    });
  });

  afterEach(async () => {
    // Remove sessions between tests so agents and assertions never leak state.
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
    // Clean up only the suite-owned records instead of wiping entire tables.
    await prisma.character.deleteMany({
      where: {
        id: waldo.id
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

  test('should start a new game session', async () => {
    const res = await request(app)
      .post(`/levels/${level.id}/start`)
      .expect(201);

    // A new session returns public level data and starts with no found characters.
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.level.id).toBe(level.id);
    expect(res.body.level.characters).toEqual([{ name: 'Waldo' }]);
    expect(res.body.foundCharacters).toEqual([]);
  });

  test('should return 404 for invalid level', async () => {
    const res = await request(app)
      .post('/levels/invalid-id/start')
      .expect(404);

    expect(res.body.error).toBe('Level not found');
  });

  test('should resume an existing session and include found characters', async () => {
    const agent = request.agent(app);

    const firstRes = await agent
      .post(`/levels/${level.id}/start`)
      .expect(201);

    // Simulate progress so the resume response has meaningful state to return.
    await prisma.foundCharacter.create({
      data: {
        sessionId: firstRes.body.sessionId,
        characterId: waldo.id
      }
    });

    const secondRes = await agent
      .post(`/levels/${level.id}/start`)
      .expect(200);

    expect(secondRes.body.sessionId).toBe(firstRes.body.sessionId);
    expect(secondRes.body.foundCharacters).toEqual(['Waldo']);
  });

  test('should return 409 when an active session exists for a different level', async () => {
    const agent = request.agent(app);

    await agent
      .post(`/levels/${level.id}/start`)
      .expect(201);

    const res = await agent
      .post(`/levels/${secondLevel.id}/start`)
      .expect(409);

    expect(res.body.error).toBe('An active game is already in progress');
  });

  test('should expire an old session and create a new one', async () => {
    const agent = request.agent(app);

    const firstRes = await agent
      .post(`/levels/${level.id}/start`)
      .expect(201);

    // Push the active session into the past so the controller takes the expiry path.
    await prisma.gameSession.update({
      where: { id: firstRes.body.sessionId },
      data: {
        expiredAt: new Date(Date.now() - 60 * 1000)
      }
    });

    const secondRes = await agent
      .post(`/levels/${level.id}/start`)
      .expect(201);

    const expiredSession = await prisma.gameSession.findUnique({
      where: { id: firstRes.body.sessionId }
    });

    expect(secondRes.body.sessionId).not.toBe(firstRes.body.sessionId);
    expect(expiredSession.status).toBe('EXPIRED');
    expect(expiredSession.endedAt).not.toBeNull();
  });
});
