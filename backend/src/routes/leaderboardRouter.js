const express = require('express');
const {
  getLeaderboard,
  submitLeaderboardEntry
} = require('../controllers/leaderboardController');

const router = express.Router();

router.get('/', getLeaderboard);
router.post('/', submitLeaderboardEntry);

module.exports = router;
