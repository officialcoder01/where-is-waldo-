// Store session-scoped UI state so refreshes keep progress.
const STORAGE_KEY = 'waldo.game-state';

// Default shape for all UI + game data.
const defaultState = {
  levels: [],
  currentLevelId: null,
  sessionId: null,
  sessionStatus: 'IDLE',
  level: null,
  characters: [],
  foundCharacterIds: [],
  foundCharacters: [],
  markers: [],
  startedAt: null,
  expiredAt: null,
  endedAt: null,
  ui: {
    loading: false,
    error: '',
    activeTarget: null,
    zoomScale: 1,
    completionOpen: false,
    expiredOpen: false,
    restartingGame: false,
    submittingScore: false
  }
};

// Simple pub/sub to keep views in sync with state updates.
const listeners = new Set();

// Safe deep clone for plain data structures used in state.
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

// Hydrate state from session storage, with defaults as fallback.
function loadState() {
  try {
    const rawState = sessionStorage.getItem(STORAGE_KEY);

    if (!rawState) {
      return cloneState(defaultState);
    }

    const parsedState = JSON.parse(rawState);

    return {
      ...cloneState(defaultState),
      ...parsedState,
      ui: {
        ...cloneState(defaultState).ui,
        ...parsedState.ui
      }
    };
  } catch (error) {
    return cloneState(defaultState);
  }
}

// Module-level state container.
let state = loadState();

// Persist state to session storage on every update.
function persistState() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Broadcast state changes to subscribed renderers.
function notifyListeners() {
  listeners.forEach((listener) => listener(state));
}

export function getState() {
  // Read-only access to current state snapshot.
  return state;
}

export function setState(updater) {
  // Updater can be a function (recommended) or a partial object.
  state =
    typeof updater === 'function'
      ? updater(cloneState(state))
      : {
          ...state,
          ...updater
        };

  persistState();
  notifyListeners();
}

export function subscribe(listener) {
  // Subscribe to state changes; returns an unsubscribe fn.
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetGameState() {
  // Return to defaults for a fresh run or home navigation.
  state = cloneState(defaultState);
  persistState();
  notifyListeners();
}

export function syncLevels(levels) {
  // Cache level list for the home screen.
  setState((currentState) => ({
    ...currentState,
    levels
  }));
}

export function hydrateGameSession(payload, levelId) {
  // Normalize backend session payload into client state.
  const totalCharacters = payload.characters?.length ?? 0;
  const foundCount = payload.foundCharacterIds?.length ?? 0;
  const isComplete =
    (payload.sessionStatus ?? 'ACTIVE') === 'COMPLETED' &&
    totalCharacters > 0 &&
    foundCount >= totalCharacters;

  setState((currentState) => ({
    ...currentState,
    currentLevelId: levelId,
    sessionId: payload.sessionId,
    sessionStatus: payload.sessionStatus ?? 'ACTIVE',
    level: payload.level,
    characters: payload.characters ?? [],
    foundCharacterIds: payload.foundCharacterIds ?? [],
    foundCharacters: payload.foundCharacters ?? [],
    startedAt: payload.startedAt ?? null,
    expiredAt: payload.expiredAt ?? null,
    endedAt: payload.endedAt ?? null,
    markers: payload.markers ?? [],
    ui: {
      ...currentState.ui,
      loading: false,
      error: '',
      activeTarget: null,
      zoomScale: 1,
      completionOpen: isComplete,
      expiredOpen: false,
      restartingGame: false
    }
  }));
}

export function clearTransientUi() {
  // Clear transient click/target UI without touching core progress.
  setState((currentState) => ({
    ...currentState,
    ui: {
      ...currentState.ui,
      activeTarget: null
    }
  }));
}
