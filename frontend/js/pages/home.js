import { API_BASE_URL, getLevels, startLevel } from '../api/api.js';
import { createLevelCard } from '../components/levelCard.js';
import { getState, hydrateGameSession, resetGameState, setState, syncLevels } from '../state/gameState.js';

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
    </main>
  `;
}

function renderHomeLoading(state, loadingOverlay) {
  loadingOverlay.hidden = !state.ui.loading;
}

export async function initHomePage() {
  // Entry point for the home screen.
  const app = document.getElementById('app');
  renderHomeShell(app);

  const grid = app.querySelector('[data-level-grid]');
  const errorElement = app.querySelector('[data-home-error]');
  const loadingOverlay = app.querySelector('[data-loading-overlay]');

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
