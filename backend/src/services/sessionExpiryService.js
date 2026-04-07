const prisma = require('../config/prisma');

const sessionTimers = new Map();

// Remove any existing timer so one session only ever has one scheduled expiry.
function clearSessionExpiryTimer(sessionId) {
  const timerId = sessionTimers.get(sessionId);

  if (timerId) {
    clearTimeout(timerId);
    sessionTimers.delete(sessionId);
  }
}

// Expire a session immediately and stamp endedAt with the scheduled expiry boundary.
async function expireSessionNow(sessionId) {
  clearSessionExpiryTimer(sessionId);

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session || session.status !== 'ACTIVE') {
    return;
  }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      status: 'EXPIRED',
      endedAt: session.expiredAt
    }
  });
}

// Schedule backend expiry so the DB state closes even if the client goes idle.
function scheduleSessionExpiry(sessionId, expiredAt) {
  clearSessionExpiryTimer(sessionId);

  const delay = new Date(expiredAt).getTime() - Date.now();

  if (delay <= 0) {
    void expireSessionNow(sessionId);
    return;
  }

  const timerId = setTimeout(() => {
    void expireSessionNow(sessionId);
  }, delay);

  sessionTimers.set(sessionId, timerId);
}

module.exports = {
  clearSessionExpiryTimer,
  expireSessionNow,
  scheduleSessionExpiry
};
