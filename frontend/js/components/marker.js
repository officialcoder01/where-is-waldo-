export function createMarker(marker, { temporary = false, shaking = false } = {}) {
  const element = document.createElement('div');
  element.className = [
    temporary ? 'target-box' : 'found-marker',
    shaking ? 'is-shaking' : ''
  ]
    .filter(Boolean)
    .join(' ');
  element.style.left = `${marker.xPercent}%`;
  element.style.top = `${marker.yPercent}%`;

  if (!temporary) {
    element.innerHTML = `
      <span class="found-marker__pulse"></span>
      <span class="found-marker__dot"></span>
      <span class="found-marker__label">${marker.name}</span>
    `;
  }

  return element;
}
