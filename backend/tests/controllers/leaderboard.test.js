// Force the app to use the lightweight test session setup before it is imported.
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/config/prisma');

describe('Leaderboard routes', () => {
  let level;
  let secondLevel;

  beforeAll(async () => {
    level = await prisma.level.create({
      data: {
        name: 'Leaderboard Level',
        imageUrl: 'http://test.com/leaderboard-level.jpg'
      }
    });

    secondLevel = await prisma.level.create({
      data: {
        name: 'Second Leaderboard Level',
        imageUrl: 'http://test.com/second-leaderboard-level.jpg'
      }
    });
  });

  afterEach(async () => {
    await prisma.leaderboardEntry.deleteMany({
      where: {
        session: {
          levelId: {
            in: [level.id, secondLevel.id]
          }
        }
      }
    });

    await prisma.gameSession.deleteMany({
      where: {
        levelId: {
          in: [level.id, secondLevel.id]
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.level.deleteMany({
      where: {
        id: {
          in: [level.id, secondLevel.id]
        }
      }
    });

    await prisma.$disconnect();
  });

  async function createSession({
    levelId = level.id,
    status = 'COMPLETED',
    startedAt = new Date('2026-03-01T10:00:00.000Z'),
    endedAt = new Date('2026-03-01T10:00:05.000Z'),
    expiredAt = new Date('2026-03-01T10:30:00.000Z')
  } = {}) {
    return prisma.gameSession.create({
      data: {
        levelId,
        status,
        startedAt,
        endedAt,
        expiredAt
      }
    });
  }

  async function startGame(agent, targetLevelId = level.id) {
    return agent
      .post(`/levels/${targetLevelId}/start`)
      .expect(201);
  }

  test('cannot submit without session', async () => {
    const res = await request(app)
      .post('/leaderboard')
      .send({ name: '  Alice  ' })
      .expect(401);

    expect(res.body.error).toBe('No active game session found in the current session');
  });

  test('cannot submit if ACTIVE', async () => {
    const agent = request.agent(app);
    const startRes = await startGame(agent);

    await prisma.gameSession.update({
      where: { id: startRes.body.sessionId },
      data: {
        status: 'ACTIVE',
        endedAt: null,
        expiredAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    });

    const res = await agent
      .post('/leaderboard')
      .send({ name: 'Alice' })
      .expect(409);

    expect(res.body.error).toBe('Only completed sessions may submit to the leaderboard');
  });

  test('cannot submit if EXPIRED', async () => {
    const agent = request.agent(app);
    const startRes = await startGame(agent);

    await prisma.gameSession.update({
      where: { id: startRes.body.sessionId },
      data: {
        status: 'EXPIRED',
        endedAt: new Date('2026-03-01T10:05:00.000Z')
      }
    });

    const res = await agent
      .post('/leaderboard')
      .send({ name: 'Alice' })
      .expect(409);

    expect(res.body.error).toBe('Expired sessions cannot submit to the leaderboard');
    expect(res.headers['set-cookie'].join(' ')).toContain('connect.sid=');
  });

  test('successful submission', async () => {
    const agent = request.agent(app);
    const startedAt = new Date('2026-03-01T10:00:00.000Z');
    const endedAt = new Date('2026-03-01T10:00:09.250Z');

    const startRes = await startGame(agent);

    await prisma.gameSession.update({
      where: { id: startRes.body.sessionId },
      data: {
        status: 'COMPLETED',
        startedAt,
        endedAt
      }
    });

    const res = await agent
      .post('/leaderboard')
      .send({ name: '  Alice  ' })
      .expect(201);

    const entry = await prisma.leaderboardEntry.findUnique({
      where: {
        sessionId: startRes.body.sessionId
      }
    });

    expect(res.body.entry.name).toBe('Alice');
    expect(res.body.entry.timeInMs).toBe(9250);
    expect(entry).not.toBeNull();
    expect(entry.name).toBe('Alice');
    expect(entry.timeInMs).toBe(9250);
    expect(res.headers['set-cookie'].join(' ')).toContain('connect.sid=');
  });

  test('cannot submit twice for the same completed session', async () => {
    const agent = request.agent(app);
    const startRes = await startGame(agent);

    await prisma.gameSession.update({
      where: { id: startRes.body.sessionId },
      data: {
        status: 'COMPLETED',
        startedAt: new Date('2026-03-01T10:00:00.000Z'),
        endedAt: new Date('2026-03-01T10:00:05.000Z')
      }
    });

    await prisma.leaderboardEntry.create({
      data: {
        name: 'Alice',
        timeInMs: 5000,
        sessionId: startRes.body.sessionId
      }
    });

    const res = await agent
      .post('/leaderboard')
      .send({ name: 'Alice' })
      .expect(409);

    expect(res.body.error).toBe('Leaderboard entry already exists for this session');
    expect(res.headers['set-cookie'].join(' ')).toContain('connect.sid=');
  });

  test('allows the same leaderboard name across different sessions', async () => {
    const firstAgent = request.agent(app);
    const secondAgent = request.agent(app);

    const firstStartRes = await startGame(firstAgent);
    const secondStartRes = await startGame(secondAgent);

    await prisma.gameSession.updateMany({
      where: {
        id: {
          in: [firstStartRes.body.sessionId, secondStartRes.body.sessionId]
        }
      },
      data: {
        status: 'COMPLETED'
      }
    });

    await prisma.gameSession.update({
      where: { id: firstStartRes.body.sessionId },
      data: {
        startedAt: new Date('2026-03-01T10:00:00.000Z'),
        endedAt: new Date('2026-03-01T10:00:05.000Z')
      }
    });

    await prisma.gameSession.update({
      where: { id: secondStartRes.body.sessionId },
      data: {
        startedAt: new Date('2026-03-01T10:00:00.000Z'),
        endedAt: new Date('2026-03-01T10:00:06.000Z')
      }
    });

    await firstAgent
      .post('/leaderboard')
      .send({ name: 'Alice' })
      .expect(201);

    await secondAgent
      .post('/leaderboard')
      .send({ name: 'Alice' })
      .expect(201);

    const entries = await prisma.leaderboardEntry.findMany({
      where: {
        name: 'Alice'
      },
      orderBy: {
        timeInMs: 'asc'
      }
    });

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.sessionId)).toEqual([
      firstStartRes.body.sessionId,
      secondStartRes.body.sessionId
    ]);
  });

  test('GET returns sorted leaderboard', async () => {
    const slowSession = await createSession({
      startedAt: new Date('2026-03-01T10:00:00.000Z'),
      endedAt: new Date('2026-03-01T10:00:08.000Z')
    });
    const fastSession = await createSession({
      startedAt: new Date('2026-03-01T10:00:00.000Z'),
      endedAt: new Date('2026-03-01T10:00:03.000Z')
    });

    await prisma.leaderboardEntry.createMany({
      data: [
        {
          name: 'Slow',
          timeInMs: 8000,
          sessionId: slowSession.id
        },
        {
          name: 'Fast',
          timeInMs: 3000,
          sessionId: fastSession.id
        }
      ]
    });

    const res = await request(app)
      .get('/leaderboard')
      .expect(200);

    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries.map((entry) => entry.name)).toEqual(['Fast', 'Slow']);
  });

  test('GET limits results to top 10', async () => {
    for (let index = 0; index < 12; index += 1) {
      const session = await createSession({
        startedAt: new Date('2026-03-01T10:00:00.000Z'),
        endedAt: new Date(`2026-03-01T10:00:${String(index).padStart(2, '0')}.000Z`)
      });

      await prisma.leaderboardEntry.create({
        data: {
          name: `Player ${index}`,
          timeInMs: index * 1000,
          sessionId: session.id
        }
      });
    }

    const res = await request(app)
      .get('/leaderboard')
      .expect(200);

    expect(res.body.entries).toHaveLength(10);
    expect(res.body.entries[0].timeInMs).toBe(0);
    expect(res.body.entries[9].timeInMs).toBe(9000);
  });

  test('GET /leaderboard?levelId=uuid returns top scores for the level sorted ascending and limited to 10', async () => {
    for (let index = 0; index < 11; index += 1) {
      const session = await createSession({
        levelId: level.id,
        startedAt: new Date('2026-03-01T10:00:00.000Z'),
        endedAt: new Date(`2026-03-01T10:00:${String(index).padStart(2, '0')}.000Z`)
      });

      await prisma.leaderboardEntry.create({
        data: {
          name: `Level One ${index}`,
          timeInMs: index * 1000,
          sessionId: session.id
        }
      });
    }

    const otherLevelSession = await createSession({
      levelId: secondLevel.id,
      startedAt: new Date('2026-03-01T10:00:00.000Z'),
      endedAt: new Date('2026-03-01T10:00:01.000Z')
    });

    await prisma.leaderboardEntry.create({
      data: {
        name: 'Other Level',
        timeInMs: 1000,
        sessionId: otherLevelSession.id
      }
    });

    const res = await request(app)
      .get(`/leaderboard?levelId=${level.id}`)
      .expect(200);

    expect(res.body.entries).toHaveLength(10);
    expect(res.body.entries.every((entry) => entry.levelId === level.id)).toBe(true);
    expect(res.body.entries[0].timeInMs).toBe(0);
    expect(res.body.entries[9].timeInMs).toBe(9000);
  });
});
