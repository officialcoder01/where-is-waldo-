import { API_BASE_URL, getLevels, startLevel } from '../api/api.js';
import { createLevelCard } from '../components/levelCard.js';
import { getState, hydrateGameSession, resetGameState, setState, syncLevels } from '../state/gameState.js';

const HOME_GUIDE_STORAGE_KEY = 'where-is-waldo-home-guide-dismissed';
const MOBILE_GUIDE_BREAKPOINT = '(max-width: 560px)';

function buildPreviewSources(path) {
  const localUrl = new URL(path, window.location.href).toString();
  const remoteUrl = `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  return { localUrl, remoteUrl };
}

function getPreviewImage(level) {
  const name = (level.name ?? '').toLowerCase();

  if (name.includes('level 1')) {
    return buildPreviewSources('/assets/level1/map1.png');
  }

  if (name.includes('level 2')) {
    return buildPreviewSources('/assets/level2/map2.png');
  }

  return {
    localUrl: level.imageUrl ?? '',
    remoteUrl: level.imageUrl ?? ''
  };
}

function renderHomeShell(app) {
  // Static shell for the home page; cards are rendered after fetch.
  app.innerHTML = `
    <main class="page page--home">
      <div class="loading-overlay" data-loading-overlay>
        <div class="loading-overlay__card">
          <div class="loading-spinner" aria-hidden="true"></div>
          <p class="loading-overlay__eyebrow">Preparing The Hunt</p>
          <h2 class="loading-overlay__title">Scanning the scene...</h2>
        </div>
      </div>
      <section class="hero-panel">
        <p class="hero-panel__eyebrow">Find ME</p>
        <h1>Choose a crowded scene and start the chase.</h1>
        <p class="hero-panel__copy">
          Pick a level and race the clock without losing your rhythm.
        </p>
      </section>
      <section class="page-panel">
        <div class="section-heading">
          <div>
            <p class="section-heading__eyebrow">Home</p>
            <h2>Available Levels</h2>
          </div>
          <p class="section-heading__copy">Each card launches a fresh run or resumes the active one for that level.</p>
        </div>
        <div class="level-grid" data-level-grid></div>
        <p class="page-error" data-home-error hidden></p>
      </section>
      <div class="modal-backdrop modal-backdrop--guide" data-home-guide hidden>
        <div class="modal-card modal-card--guide">
          <p class="section-heading__eyebrow">Field Briefing</p>
          <h2>How to spot everyone without losing the clock.</h2>
          <p class="section-heading__copy" data-guide-copy>
            Before you dive into the crowd, here is the quick survival guide for sharp-eyed detectives.
          </p>
          <div class="guide-steps">
            <article class="guide-step" data-guide-step>
              <span class="guide-step__number">01</span>
              <div>
                <h3>Pick a level and lock in</h3>
                <p>Choose any scene from the home page. Your timer starts as soon as the round opens.</p>
              </div>
            </article>
            <article class="guide-step" data-guide-step>
              <span class="guide-step__number">02</span>
              <div>
                <h3>Tap the scene where you spotted someone</h3>
                <p>A target marker appears exactly where you clicked so you can confirm the guess.</p>
              </div>
            </article>
            <article class="guide-step" data-guide-step>
              <span class="guide-step__number">03</span>
              <div>
                <h3>Choose the correct character</h3>
                <p>Use the pop-up selector to name who you found. Correct picks stay marked on the map.</p>
              </div>
            </article>
            <article class="guide-step" data-guide-step>
              <span class="guide-step__number">04</span>
              <div>
                <h3>Zoom, scan, and finish clean</h3>
                <p>Pinch your focus with zoom controls, sweep the full image, then submit your fastest time to the leaderboard.</p>
              </div>
            </article>
          </div>
          <div class="modal-actions">
            <button type="button" class="primary-button" data-guide-dismiss>Start The Hunt</button>
          </div>
        </div>
      </div>
    </main>
  `;
}

function renderHomeLoading(state, loadingOverlay) {
  loadingOverlay.hidden = !state.ui.loading;
}

function shouldShowHomeGuide() {
  return window.localStorage.getItem(HOME_GUIDE_STORAGE_KEY) !== 'true';
}

function dismissHomeGuide(guideModal) {
  window.localStorage.setItem(HOME_GUIDE_STORAGE_KEY, 'true');
  guideModal.hidden = true;
}

function syncGuideContent(app) {
  const guideCopy = app.querySelector('[data-guide-copy]');
  const guideSteps = [...app.querySelectorAll('[data-guide-step]')];
  const isMobileGuide = window.matchMedia(MOBILE_GUIDE_BREAKPOINT).matches;

  if (guideCopy) {
    guideCopy.textContent = isMobileGuide
      ? 'Quick heads-up: pick a scene, tap where you found someone, then confirm the name before the timer runs out.'
      : 'Before you dive into the crowd, here is the quick survival guide for sharp-eyed detectives.';
  }

  guideSteps.forEach((step, index) => {
    step.hidden = isMobileGuide && index === guideSteps.length - 1;
  });
}

export async function initHomePage() {
  // Entry point for the home screen.
  const app = document.getElementById('app');
  renderHomeShell(app);

  const grid = app.querySelector('[data-level-grid]');
  const errorElement = app.querySelector('[data-home-error]');
  const loadingOverlay = app.querySelector('[data-loading-overlay]');
  const guideModal = app.querySelector('[data-home-guide]');
  const guideDismissButton = app.querySelector('[data-guide-dismiss]');
  const guideMediaQuery = window.matchMedia(MOBILE_GUIDE_BREAKPOINT);

  syncGuideContent(app);
  guideModal.hidden = !shouldShowHomeGuide();
  guideDismissButton.addEventListener('click', () => {
    dismissHomeGuide(guideModal);
  });
  guideMediaQuery.addEventListener('change', () => {
    syncGuideContent(app);
  });

  resetGameState();
  // Make sure UI reflects the loading state while fetching levels.
  setState((currentState) => ({
    ...currentState,
    ui: {
      ...currentState.ui,
      loading: true
    }
  }));
  renderHomeLoading(getState(), loadingOverlay);

  try {
    const response = await getLevels();
    const levels = response.levels ?? [];
    syncLevels(levels);

    if (levels.length === 0) {
      // Handle empty list gracefully.
      grid.innerHTML = '<p class="empty-state">No levels are available yet.</p>';
      return;
    }

    levels.forEach((level) => {
      const preview = getPreviewImage(level);
      const card = createLevelCard(
        {
          ...level,
          imageUrl: preview.localUrl,
          imageBackupUrl: preview.remoteUrl
        },
        async (selectedLevel) => {
        // Start a session and move to the game screen.
        errorElement.hidden = true;
        setState((currentState) => ({
          ...currentState,
          ui: {
            ...currentState.ui,
            loading: true
          }
        }));
        renderHomeLoading(getState(), loadingOverlay);

        try {
          const startPayload = await startLevel(selectedLevel.id);
          hydrateGameSession(startPayload, selectedLevel.id);
          window.location.href = `./game.html?levelId=${encodeURIComponent(selectedLevel.id)}`;
        } catch (error) {
          setState((currentState) => ({
            ...currentState,
            ui: {
              ...currentState.ui,
              loading: false
            }
          }));
          renderHomeLoading(getState(), loadingOverlay);
          errorElement.hidden = false;
          errorElement.textContent = error.message;
        }
      });

      grid.appendChild(card);
    });
  } catch (error) {
    errorElement.hidden = false;
    errorElement.textContent = error.message;
  } finally {
    setState((currentState) => ({
      ...currentState,
      ui: {
        ...currentState.ui,
        loading: false
      }
    }));
    renderHomeLoading(getState(), loadingOverlay);
  }
}
