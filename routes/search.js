const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { protect } = require('../middleware/auth');

// Global search endpoint
router.get('/:q', protect, globalSearch);

module.exports = router;
