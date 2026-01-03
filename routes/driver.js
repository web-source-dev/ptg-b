const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect, isPTG_Driver } = require('../middleware/auth');

// All driver routes require authentication and driver role
router.use(protect);
router.use(isPTG_Driver);

// Routes for driver transport jobs

// GET /api/driver/transport-jobs - Get all transport jobs for the authenticated driver
router.get('/transport-jobs', driverController.getMyTransportJobs);

// GET /api/driver/transport-jobs/:id - Get single transport job by ID (only if assigned to driver)
router.get('/transport-jobs/:id', driverController.getMyTransportJobById);

// PUT /api/driver/transport-jobs/:id/pickup - Update transport job pickup
router.put('/transport-jobs/:id/pickup', driverController.updateMyTransportJobPickup);

// PUT /api/driver/transport-jobs/:id/drop - Update transport job drop/delivery
router.put('/transport-jobs/:id/drop', driverController.updateMyTransportJobDrop);

module.exports = router;

