import { formatDuration } from '../utils/timer.js';

export function createLeaderboardTable(entries) {
  // Build a small leaderboard card for the top scores list.
  const wrapper = document.createElement('div');
  wrapper.className = 'leaderboard-card';

  if (entries.length === 0) {
    // Empty state keeps layout consistent when no scores exist.
    wrapper.innerHTML = `
      <div class="leaderboard-card__empty">
        <h3>No scores yet</h3>
        <p>Be the first to finish this hunt and set the pace.</p>
      </div>
    `;

    return wrapper;
  }

  // Render a basic table for ranked results.
  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Time</th>
      </tr>
    </thead>
  `;

  const body = document.createElement('tbody');

  entries.forEach((entry, index) => {
    // Rank is derived from the sorted list order.
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.name}</td>
      <td>${formatDuration(entry.timeInMs)}</td>
    `;
    body.appendChild(row);
  });

  table.appendChild(body);
  wrapper.appendChild(table);

  return wrapper;
}
