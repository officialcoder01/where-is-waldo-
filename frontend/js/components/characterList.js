import { API_BASE_URL } from '../api/api.js';

// Resolve the provided character portrait assets by level and character order.
export function getCharacterImage(levelName, index) {
  const normalizedLevelName = (levelName ?? '').toLowerCase();

  if (normalizedLevelName.includes('level 1')) {
    return `${API_BASE_URL}/assets/level1/image${index + 1}.png`;
  }

  if (normalizedLevelName.includes('level 2')) {
    return `${API_BASE_URL}/assets/level2/image${index + 1}.png`;
  }

  return '';
}

// Keep portrait lookup stable even when filtered character lists change order.
export function getCharacterImageForCharacter(levelName, allCharacters, characterId) {
  const characterIndex = allCharacters.findIndex((character) => character.id === characterId);
  return getCharacterImage(levelName, Math.max(characterIndex, 0));
}

export function createCharacterList(levelName, characters, foundCharacterIds) {
  // Render character cards with clear found/remaining states.
  const container = document.createElement('div');
  container.className = 'character-list';

  characters.forEach((character, index) => {
    const found = foundCharacterIds.includes(character.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `character-card${found ? ' is-found' : ''}`;
    card.disabled = found;
    card.setAttribute('aria-label', `${character.name}${found ? ' found' : ' remaining'}`);
    card.innerHTML = `
      <span class="character-card__passport">Passport</span>
      <img class="character-card__avatar" src="${getCharacterImage(levelName, index)}" alt="${character.name}">
      <span class="character-card__name">${character.name}</span>
      <span class="character-card__status">${found ? 'Found' : 'Searching'}</span>
    `;

    container.appendChild(card);
  });

  return container;
}
