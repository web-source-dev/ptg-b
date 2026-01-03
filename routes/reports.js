const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { protect, authorizeRoles } = require('../middleware/auth');

// All report routes require authentication
router.use(protect);

// Routes for reports

// GET /api/reports/dashboard - Get dashboard statistics
router.get('/dashboard', reportsController.getDashboardStats);

// GET /api/reports/transport-jobs - Get transport job report
router.get('/transport-jobs', reportsController.getTransportJobReport);

// GET /api/reports/drivers - Get driver performance report
router.get('/drivers', reportsController.getDriverReport);

// GET /api/reports/trucks - Get truck utilization report
router.get('/trucks', reportsController.getTruckReport);

// GET /api/reports/financial - Get financial report
router.get('/financial', reportsController.getFinancialReport);

module.exports = router;
