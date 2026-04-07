function createPreviewFallback(levelName) {
  const initials = levelName
    .split(' ')
    .map((word) => word[0]?.toUpperCase())
    .join('')
    .slice(0, 2);

  return `
    <div class="level-card__fallback">
      <span>${initials || 'LV'}</span>
    </div>
  `;
}

export function createLevelCard(level, onSelect) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'level-card';
  card.innerHTML = `
    <span class="level-card__media">
      <img src="${level.imageUrl ?? ''}" alt="${level.name}" loading="lazy">
      ${createPreviewFallback(level.name)}
    </span>
    <span class="level-card__meta">
      <span class="level-card__eyebrow">Level Select</span>
      <span class="level-card__title">${level.name}</span>
    </span>
  `;

  const image = card.querySelector('img');
  if (level.imageBackupUrl) {
    image.dataset.backupSrc = level.imageBackupUrl;
  }
  image?.addEventListener('error', () => {
    if (image?.dataset.backupSrc && !image.dataset.triedBackup) {
      image.dataset.triedBackup = 'true';
      image.src = image.dataset.backupSrc;
      return;
    }

    card.classList.add('has-preview-fallback');
  });

  card.addEventListener('click', () => onSelect(level));

  return card;
}
