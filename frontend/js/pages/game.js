import { API_BASE_URL, startLevel, submitLeaderboard, submitLevelClick } from '../api/api.js';
import { createCharacterList } from '../components/characterList.js';
import { createDropdown } from '../components/dropDown.js';
import { createMarker } from '../components/marker.js';
import {
  clearTransientUi,
  getState,
  hydrateGameSession,
  resetGameState,
  setState,
  subscribe
} from '../state/gameState.js';
import {
  arePointsNear,
  getDropdownPosition,
  getRelativeClickPosition,
  isEventOutsideRadius
} from '../utils/coordinate.js';
import { createTimer, formatDuration, getElapsedTime } from '../utils/timer.js';

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
const DRAG_DISTANCE_THRESHOLD = 6;

function getLevelIdFromUrl() {
  // Preserve level selection when navigating directly to the game screen.
  return new URLSearchParams(window.location.search).get('levelId');
}

function renderGameShell(app) {
  // Static shell; dynamic data is injected via state-driven render.
  app.innerHTML = `
    <main class="page page--game">
      <div class="loading-overlay" data-loading-overlay>
        <div class="loading-overlay__card">
          <div class="loading-spinner" aria-hidden="true"></div>
          <p class="loading-overlay__eyebrow">Entering Level</p>
          <h2 class="loading-overlay__title">Finding the crowd...</h2>
        </div>
      </div>
      <section class="page-panel page-panel--game">
        <header class="game-nav">
          <button type="button" class="ghost-button" data-home-button>Home</button>
          <div class="timer-pill">
            <span>Timer</span>
            <strong data-timer>00:00.00</strong>
          </div>
        </header>
        <div class="game-layout">
          <section class="game-stage">
            <div class="stage-toolbar">
              <div class="zoom-controls">
                <button type="button" class="ghost-button zoom-controls__button" data-zoom-out>-</button>
                <span class="zoom-controls__value" data-zoom-value>100%</span>
                <button type="button" class="ghost-button zoom-controls__button" data-zoom-in>+</button>
                <button type="button" class="ghost-button zoom-controls__reset" data-zoom-reset>Reset</button>
              </div>
            </div>
            <div class="stage-frame">
              <div class="stage-viewport" data-stage-viewport>
                <div class="stage-overlay" data-stage-overlay>
                  <img data-level-image class="stage-image" alt="Level scene">
                </div>
              </div>
            </div>
            <p class="page-error" data-game-error hidden></p>
          </section>
          <aside class="game-sidebar">
            <div class="section-heading section-heading--compact">
              <div>
                <p class="section-heading__eyebrow">Targets</p>
                <h2 data-level-title>Current Level</h2>
              </div>
              <p class="section-heading__copy" data-remaining-copy></p>
            </div>
            <div data-character-list></div>
          </aside>
        </div>
      </section>
      <div class="modal-backdrop" data-completion-modal hidden>
        <div class="modal-card">
          <p class="section-heading__eyebrow">Run Complete</p>
          <h2>You found every character.</h2>
          <p class="modal-time" data-completion-time>00:00.00</p>
          <form data-score-form>
            <label class="field-label" for="leaderboard-name">Submit to leaderboard</label>
            <input id="leaderboard-name" name="name" maxlength="20" placeholder="Enter your name" required>
            <p class="page-error" data-score-error hidden></p>
            <button type="submit" class="primary-button">Submit Score</button>
          </form>
        </div>
      </div>
      <div class="modal-backdrop" data-expired-modal hidden>
        <div class="modal-card">
          <p class="section-heading__eyebrow">Session Expired</p>
          <h2>You ran out of time.</h2>
          <p class="section-heading__copy">
            Start a fresh run for this level or head back home to choose again.
          </p>
          <div class="modal-actions">
            <button type="button" class="primary-button" data-restart-button>Restart Game</button>
            <button type="button" class="ghost-button modal-actions__secondary" data-expired-home-button>Home</button>
          </div>
        </div>
      </div>
    </main>
  `;
}

function resolveLevelImageUrl(level) {
  // Prefer the provided map assets for known seeded levels.
  const normalizedLevelName = (level?.name ?? '').toLowerCase();

  if (normalizedLevelName.includes('level 1')) {
    return `${API_BASE_URL}/assets/level1/map1.png`;
  }

  if (normalizedLevelName.includes('level 2')) {
    return `${API_BASE_URL}/assets/level2/map2.png`;
  }

  if (!level?.imageUrl) {
    return '';
  }

  if (level.imageUrl.startsWith('http')) {
    return level.imageUrl;
  }

  if (level.imageUrl.startsWith('/')) {
    return `${API_BASE_URL}${level.imageUrl}`;
  }

  return level.imageUrl;
}

function getRemainingCharacters(state) {
  // Keep UI derived from state to avoid out-of-sync lists.
  return state.characters.filter(
    (character) => !state.foundCharacterIds.includes(character.id)
  );
}

function renderImageState(state, overlay) {
  // Clear transient UI and re-render persistent markers/dropdown.
  overlay.querySelectorAll('.found-marker, .target-box, .target-dropdown').forEach((element) => {
    element.remove();
  });

  state.markers.forEach((marker) => {
    overlay.appendChild(createMarker(marker));
  });

  if (!state.ui.activeTarget) {
    return;
  }

  overlay.appendChild(
    createMarker(state.ui.activeTarget, {
      temporary: true,
      shaking: state.ui.activeTarget.shaking
    })
  );

  const dropdown = createDropdown(
    state.level?.name,
    state.characters,
    getRemainingCharacters(state),
    state.ui.activeTarget.onSelect
  );
  overlay.appendChild(dropdown);

  const dropdownPosition = getDropdownPosition(
    state.ui.activeTarget,
    {
      width: overlay.clientWidth,
      height: overlay.clientHeight
    },
    {
      width: dropdown.offsetWidth,
      height: dropdown.offsetHeight
    }
  );

  dropdown.style.left = `${dropdownPosition.left}px`;
  dropdown.style.top = `${dropdownPosition.top}px`;
  dropdown.dataset.placement = dropdownPosition.placement;
}

function renderGameState(state, elements) {
  // Single render pass for all game UI that depends on state.
  const remainingCharacters = getRemainingCharacters(state);
  elements.levelTitle.textContent = state.level?.name ?? 'Current Level';
  elements.remainingCopy.textContent = `${remainingCharacters.length} character${remainingCharacters.length === 1 ? '' : 's'} remaining`;
  elements.image.src = resolveLevelImageUrl(state.level);
  elements.image.alt = state.level?.name ?? 'Waldo level';
  elements.error.hidden = !state.ui.error;
  elements.error.textContent = state.ui.error;
  elements.loadingOverlay.hidden = !state.ui.loading;
  elements.zoomValue.textContent = `${Math.round(state.ui.zoomScale * 100)}%`;
  elements.zoomOutButton.disabled = state.ui.zoomScale <= MIN_ZOOM;
  elements.zoomInButton.disabled = state.ui.zoomScale >= MAX_ZOOM;
  elements.zoomResetButton.disabled = state.ui.zoomScale === MIN_ZOOM;
  elements.overlay.style.transform = `scale(${state.ui.zoomScale})`;
  elements.characterList.innerHTML = '';
  elements.characterList.appendChild(
    createCharacterList(state.level?.name, state.characters, state.foundCharacterIds)
  );
  renderImageState(state, elements.overlay);

  const elapsed = getElapsedTime(state.startedAt, state.endedAt);
  elements.timer.textContent = formatDuration(elapsed);
  elements.modal.hidden = !state.ui.completionOpen;
  elements.expiredModal.hidden = !state.ui.expiredOpen;
  elements.completionTime.textContent = formatDuration(elapsed);
  elements.scoreSubmitButton.disabled = state.ui.submittingScore;
  elements.scoreSubmitButton.textContent = state.ui.submittingScore
    ? 'Submitting...'
    : 'Submit Score';
  elements.restartButton.disabled = state.ui.restartingGame;
  elements.restartButton.textContent = state.ui.restartingGame
    ? 'Restarting...'
    : 'Restart Game';
}

function setZoomScale(nextZoomScale) {
  setState((currentState) => ({
    ...currentState,
    ui: {
      ...currentState.ui,
      zoomScale: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomScale))
    }
  }));
}

function adjustViewportScroll(viewport, previousZoom, nextZoom, anchorXRatio = 0.5, anchorYRatio = 0.5) {
  if (!viewport || previousZoom === nextZoom) {
    return;
  }

  const targetLeft = (viewport.scrollLeft + viewport.clientWidth * anchorXRatio) / previousZoom;
  const targetTop = (viewport.scrollTop + viewport.clientHeight * anchorYRatio) / previousZoom;

  viewport.scrollLeft = targetLeft * nextZoom - viewport.clientWidth * anchorXRatio;
  viewport.scrollTop = targetTop * nextZoom - viewport.clientHeight * anchorYRatio;
}

function updateViewportDragState(viewport, isDragging) {
  // Mirror drag state in the cursor so panning feels deliberate.
  viewport.classList.toggle('is-panning', isDragging);
}

function updateViewportZoomState(viewport, zoomScale) {
  // Only disable native touch scrolling when we actually need drag-to-pan.
  viewport.classList.toggle('is-zoomed', zoomScale > 1);
}

function createTargetSelectionHandler(levelId) {
  // Validate a dropdown selection against the backend.
  return async function handleTargetSelection(character) {
    const state = getState();
    const activeTarget = state.ui.activeTarget;

    if (
      !activeTarget ||
      state.sessionStatus !== 'ACTIVE' ||
      state.foundCharacterIds.includes(character.id)
    ) {
      return;
    }

    try {
      const response = await submitLevelClick(levelId, {
        characterId: character.id,
        xCoord: activeTarget.xPercent,
        yCoord: activeTarget.yPercent
      });

      if (!response.correct) {
        // Light feedback for incorrect guesses.
        setState((currentState) => ({
          ...currentState,
          ui: {
            ...currentState.ui,
            activeTarget: currentState.ui.activeTarget
              ? {
                  ...currentState.ui.activeTarget,
                  shaking: true
                }
              : null
          }
        }));

        window.setTimeout(() => {
          setState((currentState) => ({
            ...currentState,
            ui: {
              ...currentState.ui,
              activeTarget: null
            }
          }));
        }, 420);

        return;
      }

      setState((currentState) => {
        // Prevent duplicate markers for the same character.
        const markerExists = currentState.markers.some(
          (marker) => marker.characterId === response.character.id
        );

        return {
          ...currentState,
          foundCharacterIds: response.foundCharacterIds ?? currentState.foundCharacterIds,
          foundCharacters: response.foundCharacters ?? currentState.foundCharacters,
          sessionStatus: response.sessionStatus ?? currentState.sessionStatus,
          expiredAt: response.expiredAt ?? currentState.expiredAt,
          endedAt: response.endedAt ?? currentState.endedAt,
          markers: markerExists
            ? currentState.markers
            : [
                ...currentState.markers,
                {
                  characterId: response.character.id,
                  name: response.character.name,
                  xPercent: activeTarget.xPercent,
                  yPercent: activeTarget.yPercent
                }
              ],
          ui: {
            ...currentState.ui,
            activeTarget: null,
            completionOpen: response.sessionStatus === 'COMPLETED'
          }
        };
      });
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        ui: {
          ...currentState.ui,
          error: error.message,
          activeTarget: null
        }
      }));
    }
  };
}

export async function initGamePage() {
  // Entry point for the game screen.
  const levelId = getLevelIdFromUrl();

  if (!levelId) {
    window.location.href = './index.html';
    return;
  }

  const app = document.getElementById('app');
  renderGameShell(app);

  const elements = {
    timer: app.querySelector('[data-timer]'),
    homeButton: app.querySelector('[data-home-button]'),
    image: app.querySelector('[data-level-image]'),
    viewport: app.querySelector('[data-stage-viewport]'),
    overlay: app.querySelector('[data-stage-overlay]'),
    characterList: app.querySelector('[data-character-list]'),
    levelTitle: app.querySelector('[data-level-title]'),
    remainingCopy: app.querySelector('[data-remaining-copy]'),
    error: app.querySelector('[data-game-error]'),
    modal: app.querySelector('[data-completion-modal]'),
    expiredModal: app.querySelector('[data-expired-modal]'),
    completionTime: app.querySelector('[data-completion-time]'),
    scoreForm: app.querySelector('[data-score-form]'),
    scoreError: app.querySelector('[data-score-error]'),
    scoreSubmitButton: app.querySelector('[data-score-form] button[type="submit"]'),
    zoomOutButton: app.querySelector('[data-zoom-out]'),
    zoomInButton: app.querySelector('[data-zoom-in]'),
    zoomResetButton: app.querySelector('[data-zoom-reset]'),
    zoomValue: app.querySelector('[data-zoom-value]'),
    restartButton: app.querySelector('[data-restart-button]'),
    loadingOverlay: app.querySelector('[data-loading-overlay]'),
    expiredHomeButton: app.querySelector('[data-expired-home-button]')
  };

  let stopTimer = () => {};
  const dragState = {
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    hasDragged: false,
    suppressClick: false
  };

  // Clear any persisted completion modal before hydrating a new session.
  setState((currentState) => ({
      ...currentState,
      ui: {
        ...currentState.ui,
        loading: true,
        completionOpen: false,
        expiredOpen: false,
        activeTarget: null,
        zoomScale: 1,
        error: ''
      }
  }));

  const syncTimer = (state) => {
    // Keep the timer synced to backend session times.
    stopTimer();
    stopTimer = createTimer({
      startedAt: state.startedAt,
      expiredAt: state.expiredAt,
      endedAt: state.sessionStatus === 'COMPLETED' ? state.endedAt : null,
      onTick: (elapsed) => {
        elements.timer.textContent = formatDuration(elapsed);

        if (getState().ui.completionOpen) {
          elements.completionTime.textContent = formatDuration(elapsed);
        }
      },
      onExpire: (expiredAt) => {
        // Freeze the game client-side the moment the backend session window ends.
        setState((currentState) => ({
          ...currentState,
          sessionStatus: 'EXPIRED',
          endedAt: expiredAt,
          ui: {
            ...currentState.ui,
            activeTarget: null,
            completionOpen: false,
            expiredOpen: true,
            error: 'Game session has expired'
          }
        }));
      }
    });
  };

  const unsubscribe = subscribe((state) => {
    renderGameState(state, elements);
    syncTimer(state);
    updateViewportZoomState(elements.viewport, state.ui.zoomScale);
  });

  try {
    // Start or resume the backend session before binding click flow.
    const payload = await startLevel(levelId);
    hydrateGameSession(payload, levelId);
  } catch (error) {
    setState((currentState) => ({
      ...currentState,
        ui: {
          ...currentState.ui,
          loading: false,
          error: error.message,
          completionOpen: false,
          expiredOpen: false
      }
    }));
  }

  const onCharacterSelect = createTargetSelectionHandler(levelId);

  elements.image.addEventListener('click', (event) => {
    // Capture relative click position and open the target dropdown.
    if (dragState.suppressClick) {
      dragState.suppressClick = false;
      return;
    }

    const state = getState();

    if (state.sessionStatus !== 'ACTIVE' || !state.level || !state.characters.length) {
      return;
    }

    const position = getRelativeClickPosition(event, elements.image);
    const baseX = (position.xPercent / 100) * elements.overlay.clientWidth;
    const baseY = (position.yPercent / 100) * elements.overlay.clientHeight;
    const nextTarget = {
      xPercent: position.xPercent,
      yPercent: position.yPercent,
      // Keep overlay children in the image's unscaled coordinate space so zoom does not offset them.
      xPx: baseX,
      yPx: baseY,
      clientX: event.clientX,
      clientY: event.clientY,
      shaking: false,
      onSelect: onCharacterSelect
    };

    if (arePointsNear(state.ui.activeTarget, nextTarget)) {
      return;
    }

    setState((currentState) => ({
      ...currentState,
      ui: {
        ...currentState.ui,
        activeTarget: nextTarget,
        error: ''
      }
    }));
  });

  elements.zoomInButton.addEventListener('click', () => {
    const previousZoom = getState().ui.zoomScale;
    const nextZoom = Math.min(MAX_ZOOM, previousZoom + ZOOM_STEP);
    setZoomScale(nextZoom);
    requestAnimationFrame(() => {
      adjustViewportScroll(elements.viewport, previousZoom, nextZoom);
    });
  });

  elements.zoomOutButton.addEventListener('click', () => {
    const previousZoom = getState().ui.zoomScale;
    const nextZoom = Math.max(MIN_ZOOM, previousZoom - ZOOM_STEP);
    setZoomScale(nextZoom);
    requestAnimationFrame(() => {
      adjustViewportScroll(elements.viewport, previousZoom, nextZoom);
    });
  });

  elements.zoomResetButton.addEventListener('click', () => {
    const previousZoom = getState().ui.zoomScale;
    setZoomScale(MIN_ZOOM);
    requestAnimationFrame(() => {
      adjustViewportScroll(elements.viewport, previousZoom, MIN_ZOOM);
    });
  });

  elements.viewport.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();

    const previousZoom = getState().ui.zoomScale;
    const nextZoom = event.deltaY < 0
      ? Math.min(MAX_ZOOM, previousZoom + ZOOM_STEP)
      : Math.max(MIN_ZOOM, previousZoom - ZOOM_STEP);
    const rect = elements.viewport.getBoundingClientRect();
    const anchorXRatio = (event.clientX - rect.left) / rect.width;
    const anchorYRatio = (event.clientY - rect.top) / rect.height;

    setZoomScale(nextZoom);
    requestAnimationFrame(() => {
      adjustViewportScroll(elements.viewport, previousZoom, nextZoom, anchorXRatio, anchorYRatio);
    });
  }, { passive: false });

  elements.viewport.addEventListener('pointerdown', (event) => {
    // Drag the zoomed stage itself, but avoid hijacking clicks on interactive UI.
    if (
      event.button !== 0 ||
      getState().ui.zoomScale <= 1 ||
      event.target.closest('button, input, form, .target-dropdown')
    ) {
      return;
    }

    dragState.pointerId = event.pointerId;
    dragState.startClientX = event.clientX;
    dragState.startClientY = event.clientY;
    dragState.startScrollLeft = elements.viewport.scrollLeft;
    dragState.startScrollTop = elements.viewport.scrollTop;
    dragState.hasDragged = false;
    updateViewportDragState(elements.viewport, false);
  });

  window.addEventListener('pointermove', (event) => {
    if (dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;

    if (!dragState.hasDragged) {
      dragState.hasDragged = Math.hypot(deltaX, deltaY) >= DRAG_DISTANCE_THRESHOLD;
    }

    if (!dragState.hasDragged) {
      return;
    }

    updateViewportDragState(elements.viewport, true);
    elements.viewport.scrollLeft = dragState.startScrollLeft - deltaX;
    elements.viewport.scrollTop = dragState.startScrollTop - deltaY;
  });

  const stopDragging = (event) => {
    if (dragState.pointerId !== event.pointerId) {
      return;
    }

    dragState.suppressClick = dragState.hasDragged;
    dragState.pointerId = null;
    dragState.hasDragged = false;
    updateViewportDragState(elements.viewport, false);
  };

  window.addEventListener('pointerup', stopDragging);
  window.addEventListener('pointercancel', stopDragging);

  document.addEventListener('pointerdown', (event) => {
    // Close dropdown when clicking away from the target area.
    const activeTarget = getState().ui.activeTarget;

    if (!activeTarget) {
      return;
    }

    const clickedDropdown = event.target.closest('.target-dropdown');
    const clickedTarget = event.target.closest('.target-box');

    if (clickedDropdown || clickedTarget) {
      return;
    }

    if (!elements.overlay.contains(event.target) || isEventOutsideRadius(event, activeTarget)) {
      clearTransientUi();
    }
  });

  elements.homeButton.addEventListener('click', () => {
    // Reset local state and return to home.
    resetGameState();
    window.location.href = './index.html';
  });

  elements.expiredHomeButton.addEventListener('click', () => {
    // Expired runs can be abandoned back to the home screen.
    resetGameState();
    window.location.href = './index.html';
  });

  elements.restartButton.addEventListener('click', async () => {
    // Start a fresh session for the same level after a timeout.
    try {
      setState((currentState) => ({
        ...currentState,
        ui: {
          ...currentState.ui,
          expiredOpen: false,
          completionOpen: false,
          activeTarget: null,
          loading: true,
          restartingGame: true,
          error: ''
        }
      }));

      const payload = await startLevel(levelId);
      hydrateGameSession(payload, levelId);
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        ui: {
          ...currentState.ui,
          loading: false,
          expiredOpen: true,
          restartingGame: false,
          error: error.message
        }
      }));
    }
  });

  elements.scoreForm.addEventListener('submit', async (event) => {
    // Submit completion name to leaderboard once the run is finished.
    event.preventDefault();
    const formData = new FormData(elements.scoreForm);
    const name = String(formData.get('name') ?? '');
    elements.scoreError.hidden = true;

    try {
      setState((currentState) => ({
        ...currentState,
        ui: {
          ...currentState.ui,
          loading: true,
          submittingScore: true
        }
      }));

      await submitLeaderboard(name);
      const finishedLevelId = getState().currentLevelId;
      resetGameState();
      window.location.href = `./leaderboard.html?levelId=${encodeURIComponent(finishedLevelId)}`;
    } catch (error) {
      elements.scoreError.hidden = false;
      elements.scoreError.textContent = error.message;

      setState((currentState) => ({
        ...currentState,
        ui: {
          ...currentState.ui,
          loading: false,
          submittingScore: false
        }
      }));
    }
  });

  window.addEventListener('beforeunload', () => {
    // Cleanup timers/listeners on page exit.
    stopTimer();
    unsubscribe();
  });
}
