const express = require('express');
const router = express.Router();

const healthRoutes = require('./healthRoutes');

// Gắn các routes phân hệ
router.use('/', healthRoutes);

module.exports = router;

