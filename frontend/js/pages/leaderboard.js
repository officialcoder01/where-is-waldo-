import { getLeaderboard } from '../api/api.js';
import { createLeaderboardTable } from '../components/leaderboardTable.js';

function getLevelIdFromUrl() {
  return new URLSearchParams(window.location.search).get('levelId');
}

function renderLeaderboardShell(app) {
  app.innerHTML = `
    <main class="page page--leaderboard">
      <div class="loading-overlay" data-loading-overlay>
        <div class="loading-overlay__card">
          <div class="loading-spinner" aria-hidden="true"></div>
          <p class="loading-overlay__eyebrow">Loading Results</p>
          <h2 class="loading-overlay__title">Ranking the sharpest eyes...</h2>
        </div>
      </div>
      <section class="hero-panel hero-panel--compact">
        <p class="hero-panel__eyebrow">Leaderboard</p>
        <h1>Top scores, sorted by the fastest sharp-eyed runs.</h1>
        <p class="hero-panel__copy" data-leaderboard-copy>
          The best times rise to the top. Finish cleanly and claim your place.
        </p>
      </section>
      <section class="page-panel">
        <div class="section-heading">
          <div>
            <p class="section-heading__eyebrow">Rankings</p>
            <h2>Top Score</h2>
          </div>
          <a class="ghost-link" href="./index.html">Back Home</a>
        </div>
        <div data-leaderboard-table></div>
        <p class="page-error" data-leaderboard-error hidden></p>
      </section>
    </main>
  `;
}

export async function initLeaderboardPage() {
  const app = document.getElementById('app');
  renderLeaderboardShell(app);

  const levelId = getLevelIdFromUrl();
  const tableMount = app.querySelector('[data-leaderboard-table]');
  const errorElement = app.querySelector('[data-leaderboard-error]');
  const copyElement = app.querySelector('[data-leaderboard-copy]');
  const loadingOverlay = app.querySelector('[data-loading-overlay]');

  if (levelId) {
    copyElement.textContent = 'Showing the best runs for the level you just finished.';
  }

  try {
    const response = await getLeaderboard(levelId);
    tableMount.appendChild(createLeaderboardTable(response.entries ?? []));
  } catch (error) {
    errorElement.hidden = false;
    errorElement.textContent = error.message;
  } finally {
    loadingOverlay.hidden = true;
  }
}
