export function formatDuration(timeInMs) {
  // Format milliseconds as mm:ss.cc for the UI.
  const safeTime = Math.max(0, Math.floor(timeInMs));
  const minutes = Math.floor(safeTime / 60000);
  const seconds = Math.floor((safeTime % 60000) / 1000);
  const centiseconds = Math.floor((safeTime % 1000) / 10);

  return [
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ].join(':') + `.${String(centiseconds).padStart(2, '0')}`;
}

export function getElapsedTime(startedAt, endedAt = null) {
  // Use backend timestamps as the source of truth for elapsed time.
  if (!startedAt) {
    return 0;
  }

  const startMs = new Date(startedAt).getTime();
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();

  return Math.max(0, endMs - startMs);
}

export function createTimer({ startedAt, expiredAt = null, endedAt, onTick, onExpire }) {
  // Run a lightweight interval that syncs the display to backend time.
  const getEffectiveEndTime = () => {
    if (endedAt) {
      return endedAt;
    }

    // When the expiry window passes, treat expiredAt as the final clock value.
    if (expiredAt && Date.now() >= new Date(expiredAt).getTime()) {
      return expiredAt;
    }

    return null;
  };

  onTick(getElapsedTime(startedAt, getEffectiveEndTime()));

  if (!startedAt || endedAt) {
    // Nothing to tick when time is fixed or missing.
    return () => {};
  }

  const timerId = window.setInterval(() => {
    const effectiveEndTime = getEffectiveEndTime();

    onTick(getElapsedTime(startedAt, effectiveEndTime));

    if (effectiveEndTime === expiredAt) {
      // Notify the caller once so it can lock the UI and show expiry feedback.
      window.clearInterval(timerId);
      onExpire?.(expiredAt);
    }
  }, 50);

  return () => window.clearInterval(timerId);
}
