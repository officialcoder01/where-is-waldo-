import { getCharacterImageForCharacter } from './characterList.js';

export function createDropdown(levelName, allCharacters, options, onSelect) {
  // Dropdown is rendered near the click point and only includes remaining characters.
  const menu = document.createElement('div');
  menu.className = 'target-dropdown';

  if (options.length === 0) {
    menu.innerHTML = '<p class="target-dropdown__empty">All characters found</p>';
    return menu;
  }

  const title = document.createElement('p');
  title.className = 'target-dropdown__title';
  title.textContent = 'Who did you spot?';
  menu.appendChild(title);

  const optionRow = document.createElement('div');
  optionRow.className = 'target-dropdown__row';

  options.forEach((option) => {
    // Each option is a compact horizontal passport card with the character portrait.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'target-dropdown__option';
    button.innerHTML = `
      <img class="target-dropdown__avatar" src="${getCharacterImageForCharacter(levelName, allCharacters, option.id)}" alt="${option.name}">
      <span class="target-dropdown__meta">
        <span class="target-dropdown__passport">Passport</span>
        <span class="target-dropdown__name">${option.name}</span>
      </span>
    `;
    button.addEventListener('click', () => onSelect(option));
    optionRow.appendChild(button);
  });

  menu.appendChild(optionRow);

  return menu;
}
