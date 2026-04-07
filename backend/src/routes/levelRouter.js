const express = require("express");
const router = express.Router();
const startGameController = require("../controllers/startGameController");
const gameClickController = require("../controllers/gameClickController");

router.get('/', startGameController.listLevels);
router.post('/:levelId/start', startGameController.startGame);
router.post('/:levelId/click', gameClickController.validateGameClick);

module.exports = router;
