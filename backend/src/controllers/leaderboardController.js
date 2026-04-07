const prisma = require('../config/prisma');

function validateLeaderboardName(name) {
  const errors = {};

  // Only accept real strings so trimming and length checks behave predictably.
  if (typeof name !== 'string') {
    errors.name = 'Name must be a string';
    return { errors };
  }

  // Store the cleaned display name instead of preserving accidental outer spaces.
  const trimmedName = name.trim();

  if (!trimmedName) {
    errors.name = 'Name is required';
  } else if (trimmedName.length > 20) {
    errors.name = 'Name must be 20 characters or fewer';
  }

  return {
    errors,
    trimmedName
  };
}

async function getLeaderboard(req, res) {
  try {
    // When levelId is present, only show scores earned on that level.
    const where = req.query.levelId
      ? {
          session: {
            levelId: req.query.levelId
          }
        }
      : {};

    // The leaderboard is always the fastest times first, capped to the top 10.
    const entries = await prisma.leaderboardEntry.findMany({
      where,
      orderBy: [
        { timeInMs: 'asc' },
        { createdAt: 'asc' }
      ],
      take: 10,
      include: {
        session: {
          select: {
            id: true,
            levelId: true
          }
        }
      }
    });

    return res.status(200).json({
      entries: entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        timeInMs: entry.timeInMs,
        levelId: entry.session.levelId,
        sessionId: entry.sessionId,
        createdAt: entry.createdAt
      }))
    });
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function submitLeaderboardEntry(req, res) {
  try {
    // Step 1: validate and normalize the submitted display name.
    const { errors, trimmedName } = validateLeaderboardName(req.body.name);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Step 2: the browser session cookie is how we find the active game session.
    const gameSessionId = req.session.gameSessionId;

    if (!gameSessionId) {
      return res.status(401).json({
        error: 'No active game session found in the current session'
      });
    }

    // Step 3: load the game session and its leaderboard relation for state checks.
    const gameSession = await prisma.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        leaderboardEntry: true
      }
    });

    if (!gameSession) {
      // Clean up broken session state so later requests do not keep pointing at missing data.
      req.session.gameSessionId = null;
      res.clearCookie('connect.sid');

      return res.status(404).json({
        error: 'Game session not found'
      });
    }

    if (gameSession.status === 'ACTIVE') {
      const isExpired = gameSession.expiredAt < new Date();

      if (isExpired) {
        // Active sessions can age into expiry, so persist that status before rejecting submission.
        await prisma.gameSession.update({
          where: { id: gameSession.id },
          data: {
            status: 'EXPIRED',
            endedAt: gameSession.endedAt ?? new Date()
          }
        });

        req.session.gameSessionId = null;
        res.clearCookie('connect.sid');

        return res.status(410).json({
          error: 'Game session has expired'
        });
      }

      return res.status(409).json({
        error: 'Only completed sessions may submit to the leaderboard'
      });
    }

    if (gameSession.status === 'EXPIRED') {
      // Expired sessions are closed game cycles and cannot be converted into leaderboard scores.
      req.session.gameSessionId = null;
      res.clearCookie('connect.sid');

      return res.status(409).json({
        error: 'Expired sessions cannot submit to the leaderboard'
      });
    }

    if (gameSession.leaderboardEntry) {
      // Session is the true identity of a run, so duplicates are blocked by session, not by name.
      req.session.gameSessionId = null;
      res.clearCookie('connect.sid');

      return res.status(409).json({
        error: 'Leaderboard entry already exists for this session'
      });
    }

    if (!gameSession.endedAt) {
      return res.status(409).json({
        error: 'Completed session is missing an end time'
      });
    }

    // Step 5: compute the final score from the completed session window in milliseconds.
    const timeInMs = gameSession.endedAt.getTime() - gameSession.startedAt.getTime();

    // Step 6: create the leaderboard entry using the session as the unique run identity.
    const entry = await prisma.leaderboardEntry.create({
      data: {
        name: trimmedName,
        timeInMs,
        sessionId: gameSession.id
      },
      include: {
        session: {
          select: {
            levelId: true
          }
        }
      }
    });

    // Step 7: once the run has been submitted, clear the cookie to complete the game cycle.
    req.session.gameSessionId = null;
    res.clearCookie('connect.sid');

    return res.status(201).json({
      entry: {
        id: entry.id,
        name: entry.name,
        timeInMs: entry.timeInMs,
        levelId: entry.session.levelId,
        sessionId: entry.sessionId,
        createdAt: entry.createdAt
      }
    });
  } catch (error) {
    console.error('Error in submitLeaderboardEntry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getLeaderboard,
  submitLeaderboardEntry,
  validateLeaderboardName
};
