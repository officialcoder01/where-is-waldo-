// Checks if a click occurred within a circular hit zone around a character.
function isWithinRadius(characterX, characterY, clickX, clickY, radius) {
  // Measure the click distance from the character center.
  const dx = clickX - characterX;
  const dy = clickY - characterY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance <= radius;
}

function wasCharacterAlreadyFound(foundChars, characterId) {
  return foundChars.some((foundChar) => {
    return foundChar.characterId === characterId || foundChar.character?.id === characterId;
  });
}

// Validate a click against the current in-memory session state.
// This service mirrors the Prisma-backed shape used by the controllers.
async function validateClick({ session, character, clickX, clickY }) {
  // No session means there is no game state to validate against.
  if (!session) {
    return { status: 'session_not_found' };
  }

  // The service expects the current Prisma-style session shape.
  const foundChars = session.foundChars ?? [];
  const levelCharacters = session.level?.characters ?? [];

  if (session.status === 'COMPLETED') {
    return { status: 'game_completed' };
  }

  if (session.status === 'EXPIRED') {
    return { status: 'game_expired' };
  }

  if (session.status !== 'ACTIVE') {
    return { status: 'game_not_active' };
  }

  if (!character) {
    return { status: 'character_not_found' };
  }

  if (wasCharacterAlreadyFound(foundChars, character.id)) {
    return { status: 'already_found' };
  }

  const valid = isWithinRadius(
    character.xCoord,
    character.yCoord,
    clickX,
    clickY,
    character.radius
  );

  if (!valid) {
    return { status: 'incorrect' };
  }

  // Mutate the passed session state so callers can inspect the updated progress.
  foundChars.push({
    characterId: character.id,
    character: {
      id: character.id,
      name: character.name
    }
  });

  session.foundChars = foundChars;

  const totalCharacterCount = levelCharacters.length;

  // If every level character has now been found, mark the session complete.
  if (foundChars.length === totalCharacterCount) {
    session.status = 'COMPLETED';
    return { status: 'game_completed' };
  }

  return { status: 'correct' };
}

module.exports = {
  isWithinRadius,
  validateClick
};
