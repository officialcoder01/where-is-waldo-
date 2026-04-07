export function clamp(value, min, max) {
  // Keep values within an inclusive range.
  return Math.min(Math.max(value, min), max);
}

export function roundPercent(value) {
  // Limit percent precision to avoid noisy float diffs.
  return Number(value.toFixed(3));
}

export function getRelativeClickPosition(event, imageElement) {
  // Normalize click coordinates to percentages for responsive scaling.
  const rect = imageElement.getBoundingClientRect();
  const xPercent = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
  const yPercent = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);

  return {
    xPercent: roundPercent(xPercent),
    yPercent: roundPercent(yPercent),
    xPx: event.clientX - rect.left,
    yPx: event.clientY - rect.top,
    rect
  };
}

export function arePointsNear(firstPoint, secondPoint, threshold = 0.35) {
  // Prevent duplicate markers for nearly identical clicks.
  if (!firstPoint || !secondPoint) {
    return false;
  }

  const deltaX = Math.abs(firstPoint.xPercent - secondPoint.xPercent);
  const deltaY = Math.abs(firstPoint.yPercent - secondPoint.yPercent);

  return deltaX <= threshold && deltaY <= threshold;
}

export function getDropdownPosition(targetPoint, imageRect, dropdownSize) {
  // Choose a side with enough room before clamping inside the visible stage area.
  const gap = 18;
  const menuWidth = dropdownSize.width;
  const menuHeight = dropdownSize.height;
  const roomRight = imageRect.width - targetPoint.xPx;
  const roomLeft = targetPoint.xPx;
  const roomBottom = imageRect.height - targetPoint.yPx;
  const roomTop = targetPoint.yPx;

  let left = targetPoint.xPx + gap;
  let top = targetPoint.yPx + gap;
  let placement = 'bottom-right';

  if (roomBottom >= menuHeight + gap) {
    top = targetPoint.yPx + gap;
    placement = 'bottom';
  } else if (roomTop >= menuHeight + gap) {
    top = targetPoint.yPx - menuHeight - gap;
    placement = 'top';
  } else {
    top = clamp(targetPoint.yPx - menuHeight / 2, 12, Math.max(12, imageRect.height - menuHeight - 12));
    placement = roomRight >= roomLeft ? 'right' : 'left';
  }

  if (roomRight >= menuWidth + gap) {
    left = targetPoint.xPx + gap;
    placement = placement.includes('top') ? 'top-right' : placement.includes('bottom') ? 'bottom-right' : 'right';
  } else if (roomLeft >= menuWidth + gap) {
    left = targetPoint.xPx - menuWidth - gap;
    placement = placement.includes('top') ? 'top-left' : placement.includes('bottom') ? 'bottom-left' : 'left';
  } else {
    left = clamp(targetPoint.xPx - menuWidth / 2, 12, Math.max(12, imageRect.width - menuWidth - 12));
  }

  return {
    left: clamp(left, 12, Math.max(12, imageRect.width - menuWidth - 12)),
    top: clamp(top, 12, Math.max(12, imageRect.height - menuHeight - 12)),
    placement
  };
}

export function isEventOutsideRadius(event, point, radius = 160) {
  // Used to close dropdown when clicking far away from the target spot.
  const deltaX = event.clientX - point.clientX;
  const deltaY = event.clientY - point.clientY;

  return Math.hypot(deltaX, deltaY) > radius;
}
