const prisma = require('../config/prisma');
const {
  clearSessionExpiryTimer,
  expireSessionNow,
  scheduleSessionExpiry
} = require('../services/sessionExpiryService');

// Keep the session lifetime in one place so controller behavior stays consistent.
const SESSION_DURATION_MS = 1 * 60 * 1000;

function buildLevelQuery() {
  // Only expose the public character data the client needs to render the UI.
  return {
    include: {
      characters: {
        select: { id: true, name: true }
      }
    }
  };
}

function serializePublicLevel(level) {
  // Keep the public level payload lean and separate from DB internals.
  return {
    id: level.id,
    name: level.name,
    imageUrl: level.imageUrl,
    characters: level.characters.map((character) => ({
      name: character.name
    }))
  };
}

function serializeCharacterRoster(level) {
  // Character roster powers the sidebar and dropdown selection UI.
  return level.characters.map((character) => ({
    id: character.id,
    name: character.name
  }));
}

function buildResumePayload(session, level) {
  // Resume payload mirrors start payload so the frontend can hydrate from one shape.
  return {
    sessionId: session.id,
    level: serializePublicLevel(level),
    characters: serializeCharacterRoster(level),
    startedAt: session.startedAt,
    expiredAt: session.expiredAt,
    endedAt: session.endedAt,
    sessionStatus: session.status,
    // Convert join rows into the API shape expected by the client.
    foundCharacters: session.foundChars.map((foundChar) => foundChar.character.name),
    foundCharacterIds: session.foundChars.map((foundChar) => foundChar.character.id),
    markers: session.foundChars.map((foundChar) => ({
      characterId: foundChar.character.id,
      name: foundChar.character.name,
      xPercent: foundChar.character.xCoord,
      yPercent: foundChar.character.yCoord
    }))
  };
}

// Expire a game session and update its status.
// This is used when a session is resumed after its expiration time has passed.
async function listLevels(req, res) {
  try {
    const levels = await prisma.level.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return res.status(200).json({
      levels: levels.map((level) => ({
        id: level.id,
        name: level.name,
        imageUrl: level.imageUrl
      }))
    });
  } catch (error) {
    console.error('Error in listLevels:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


// Start a new game session for a given level, or resume an existing one if possible.
async function startGame(req, res) {
  try {
    const { levelId } = req.params;

    if (!levelId) {
      return res.status(400).json({
        error: 'Level ID is required'
      });
    }

    const level = await prisma.level.findUnique({
      where: { id: levelId },
      ...buildLevelQuery()
    });

    if (!level) {
      return res.status(404).json({
        error: 'Level not found'
      });
    }

    // Check for an existing session tied to this user session and handle it appropriately.
    const existingSessionId = req.session.gameSessionId;

    if (existingSessionId) {
      const existingSession = await prisma.gameSession.findUnique({
        where: { id: existingSessionId },
        include: {
          foundChars: {
            include: {
              character: { select: { id: true, name: true, xCoord: true, yCoord: true } }
            }
          }
        }
      });

      if (existingSession) {
        // Expired sessions are closed before we create a replacement below.
        const isExpired =
          existingSession.status === 'ACTIVE' &&
          existingSession.expiredAt < new Date();

        if (isExpired) {
          req.session.gameSessionId = null;
          await expireSessionNow(existingSession.id);
        } else if (existingSession.status === 'ACTIVE') {
          // An active session on the same level is resumed instead of duplicated.
          if (existingSession.levelId === levelId) {
            // Re-schedule expiry after a server restart or resume path.
            scheduleSessionExpiry(existingSession.id, existingSession.expiredAt);
            return res.status(200).json(buildResumePayload(existingSession, level));
          }

          // A different active level is treated as a conflict for this session.
          return res.status(409).json({
            error: 'An active game is already in progress'
          });
        }
      }
    }

    const now = new Date();
    const expiredAt = new Date(now.getTime() + SESSION_DURATION_MS);

    // No resumable session exists, so create a fresh one and bind it to the user session.
    const newSession = await prisma.gameSession.create({
      data: {
        levelId,
        expiredAt
      }
    });

    req.session.gameSessionId = newSession.id;
    // Start the backend expiry timer as soon as the session is created.
    scheduleSessionExpiry(newSession.id, expiredAt);

    return res.status(201).json({
      sessionId: newSession.id,
      level: serializePublicLevel(level),
      characters: serializeCharacterRoster(level),
      foundCharacters: [],
      foundCharacterIds: [],
      markers: [],
      startedAt: newSession.startedAt,
      expiredAt,
      endedAt: newSession.endedAt,
      sessionStatus: newSession.status
    });
  } catch (error) {
    console.error('Error in startGame:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listLevels,
  startGame
};
