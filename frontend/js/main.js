import { initGamePage } from './pages/game.js';
import { initHomePage } from './pages/home.js';
import { initLeaderboardPage } from './pages/leaderboard.js';

const page = document.body.dataset.page;

if (page === 'home') {
  initHomePage();
}

if (page === 'game') {
  initGamePage();
}

if (page === 'leaderboard') {
  initLeaderboardPage();
}
