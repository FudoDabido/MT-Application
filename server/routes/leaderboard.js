const router = require("express").Router();
const { getLeaderboard, getUserStats } = require("../controllers/leaderboardController");
const auth = require("../middleware/auth");

router.get("/", auth, getLeaderboard);
router.get("/user/:userId", auth, getUserStats);

module.exports = router;
