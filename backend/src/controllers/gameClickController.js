const prisma = require('../config/prisma');
const { isWithinRadius } = require('../services/validationService');
const {
  clearSessionExpiryTimer,
  expireSessionNow
} = require('../services/sessionExpiryService');

function validateClickBody(body) {
  const errors = {};

  // The player must tell us which character they are trying to select.
  if (!body.characterId) {
    errors.characterId = 'Character ID is required';
  }

  // Missing coordinates get their own messages so the client can respond clearly.
  if (body.xCoord === undefined) {
    errors.xCoord = 'xCoord is required';
  }

  if (body.yCoord === undefined) {
    errors.yCoord = 'yCoord is required';
  }

  const hasBothCoordinates = body.xCoord !== undefined && body.yCoord !== undefined;

  // Once both coordinates exist, make sure they are real numbers before geometry checks.
  if (
    hasBothCoordinates &&
    (!Number.isFinite(body.xCoord) || !Number.isFinite(body.yCoord))
  ) {
    errors.coordinates = 'Coordinates must be valid numbers';
  }

  return errors;
}

// Validate a player's click against the active game session stored in the session cookie.
async function validateGameClick(req, res) {
  try {
    const { levelId } = req.params;
    const { characterId, xCoord, yCoord } = req.body;

    const bodyErrors = validateClickBody(req.body);

    if (Object.keys(bodyErrors).length > 0) {
      return res.status(400).json({ errors: bodyErrors });
    }

    // The Express session links the browser cookie to the active game session in the database.
    const gameSessionId = req.session.gameSessionId;

    if (!gameSessionId) {
      return res.status(401).json({
        error: 'No active game session found in the current session'
      });
    }

    // Pull back the current game state so we can validate status, duplicates, and level ownership.
    const gameSession = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        foundChars: {
          include: {
            character: {
              select: { id: true, name: true }
            }
          }
        },
        level: {
          include: {
            characters: true
          }
        }
      }
    });

    if (!gameSession) {
      req.session.gameSessionId = null;
      res.clearCookie('connect.sid');

      return res.status(404).json({
        error: 'Game session not found'
      });
    }

    // Prevent clicks from being applied to a different level than the active session.
    if (gameSession.levelId !== levelId) {
      return res.status(409).json({
        error: 'The active game session belongs to a different level'
      });
    }

    // Expired sessions are closed immediately so later requests cannot keep using them.
    const isExpired =
      gameSession.status === 'ACTIVE' &&
      gameSession.expiredAt < new Date();

    if (isExpired) {
      await expireSessionNow(gameSession.id);
      req.session.gameSessionId = null;
      res.clearCookie('connect.sid');

      return res.status(410).json({
        error: 'Game session has expired'
      });
    }

    if (gameSession.status !== 'ACTIVE') {
      return res.status(409).json({
        error: 'Game session is not active'
      });
    }

    // A click can only target characters that belong to the session's level.
    const character = gameSession.level.characters.find(
      (levelCharacter) => levelCharacter.id === characterId
    );

    if (!character) {
      return res.status(404).json({
        status: 'character_not_found',
        correct: false
      });
    }

    // The player cannot find the same character twice in one session.
    const alreadyFound = gameSession.foundChars.some(
      (foundCharacter) => foundCharacter.characterId === characterId
    );

    if (alreadyFound) {
      return res.status(409).json({
        status: 'already_found',
        correct: false
      });
    }

    // The geometry service is the source of truth for hit detection.
    const isCorrectClick = isWithinRadius(
      character.xCoord,
      character.yCoord,
      xCoord,
      yCoord,
      character.radius
    );

    if (!isCorrectClick) {
      return res.status(200).json({
        status: 'incorrect',
        correct: false
      });
    }

    const totalCharacterCount = gameSession.level.characters.length;
    const completed = gameSession.foundChars.length + 1 === totalCharacterCount;
    const endedAt = completed ? new Date() : null;

    // Persist the successful click and complete the game in one transaction when needed.
    await prisma.$transaction(async (tx) => {
      await tx.foundCharacter.create({
        data: {
          sessionId: gameSession.id,
          characterId: character.id
        }
      });

      if (completed) {
        await tx.gameSession.update({
          where: { id: gameSession.id },
          data: {
            status: 'COMPLETED',
            endedAt
          }
        });
      }
    });

    if (completed) {
      // Completion closes the session lifecycle, so the expiry timer is no longer needed.
      clearSessionExpiryTimer(gameSession.id);
    }

    return res.status(200).json({
      correct: true,
      status: completed ? 'game_completed' : 'correct',
      character: {
        id: character.id,
        name: character.name
      },
      foundCharacters: [
        ...gameSession.foundChars.map((foundCharacter) => foundCharacter.character.name),
        character.name
      ],
      foundCharacterIds: [
        ...gameSession.foundChars.map((foundCharacter) => foundCharacter.characterId),
        character.id
      ],
      sessionStatus: completed ? 'COMPLETED' : 'ACTIVE',
      startedAt: gameSession.startedAt,
      expiredAt: gameSession.expiredAt,
      endedAt
    });
  } catch (error) {
    console.error('Error in validateGameClick:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  validateGameClick,
  validateClickBody
};
