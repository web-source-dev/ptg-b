const TransportJob = require('../models/TransportJob');
const Vehicle = require('../models/Vehicle');
const { updateStatusOnTransportJobDrop, updateStatusOnTransportJobPickup } = require('../utils/statusManager');

/**
 * Get all transport jobs for the authenticated driver
 */
exports.getMyTransportJobs = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const driverId = req.user._id;

    // Build query - only transport jobs assigned to this driver
    let query = { driverId };

    if (status) {
      query.status = status;
    }

    const transportJobs = await TransportJob.find(query)
      .sort({ createdAt: -1 })
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .populate('vehicleId', 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone')
      .populate('createdBy', 'firstName lastName email')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await TransportJob.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transportJobs,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching driver transport jobs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch transport jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get single transport job by ID (only if assigned to the driver)
 */
exports.getMyTransportJobById = async (req, res) => {
  try {
    const driverId = req.user._id;
    const jobId = req.params.id;

    const transportJob = await TransportJob.findOne({ _id: jobId, driverId })
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .populate('vehicleId')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email');

    if (!transportJob) {
      return res.status(404).json({
        success: false,
        message: 'Transport job not found or not assigned to you'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        transportJob
      }
    });
  } catch (error) {
    console.error('Error fetching driver transport job:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch transport job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update transport job pickup (driver can update pickup photos, checklist, notes, actual dates)
 */
exports.updateMyTransportJobPickup = async (req, res) => {
  try {
    const driverId = req.user._id;
    const jobId = req.params.id;

    const transportJob = await TransportJob.findOne({ _id: jobId, driverId });
    if (!transportJob) {
      return res.status(404).json({
        success: false,
        message: 'Transport job not found or not assigned to you'
      });
    }

    // Drivers can only update pickup-related fields
    const updateData = {
      lastUpdatedBy: req.user._id
    };

    if (req.body.pickupPhotos !== undefined) {
      updateData.pickupPhotos = req.body.pickupPhotos;
    }
    if (req.body.pickupChecklist !== undefined) {
      updateData.pickupChecklist = req.body.pickupChecklist;
    }
    if (req.body.pickupNotes !== undefined) {
      updateData.pickupNotes = req.body.pickupNotes;
    }

    // Update status when pickup data is provided
    const hasPickupData = (updateData.pickupPhotos && updateData.pickupPhotos.length > 0) ||
                         (updateData.pickupChecklist && updateData.pickupChecklist.length > 0) ||
                         (updateData.pickupNotes !== undefined);

    if (hasPickupData && transportJob.status !== 'In Progress') {
      // Update status to "In Progress"
      await updateStatusOnTransportJobPickup(jobId);
    }

    const updatedJob = await TransportJob.findByIdAndUpdate(
      jobId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .populate('vehicleId');

    res.status(200).json({
      success: true,
      message: 'Pickup updated successfully',
      data: {
        transportJob: updatedJob
      }
    });
  } catch (error) {
    console.error('Error updating driver transport job pickup:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update pickup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update transport job drop/delivery (driver can update delivery photos, checklist, notes, actual dates)
 */
exports.updateMyTransportJobDrop = async (req, res) => {
  try {
    const driverId = req.user._id;
    const jobId = req.params.id;

    const transportJob = await TransportJob.findOne({ _id: jobId, driverId });
    if (!transportJob) {
      return res.status(404).json({
        success: false,
        message: 'Transport job not found or not assigned to you'
      });
    }

    // Drivers can only update drop-related fields
    const updateData = {
      lastUpdatedBy: req.user._id
    };

    if (req.body.deliveryPhotos !== undefined) {
      updateData.deliveryPhotos = req.body.deliveryPhotos;
    }
    if (req.body.dropChecklist !== undefined) {
      updateData.dropChecklist = req.body.dropChecklist;
    }
    if (req.body.deliveryNotes !== undefined) {
      updateData.deliveryNotes = req.body.deliveryNotes;
    }

    // Update status when delivery data is provided
    const hasDeliveryData = (updateData.deliveryPhotos && updateData.deliveryPhotos.length > 0) ||
                           (updateData.dropChecklist && updateData.dropChecklist.length > 0) ||
                           (updateData.deliveryNotes !== undefined);

    if (hasDeliveryData && transportJob.status !== 'Completed') {
      // Update status to "Completed"
      updateData.status = 'Completed';
      await updateStatusOnTransportJobDrop(jobId);
    }

    const updatedJob = await TransportJob.findByIdAndUpdate(
      jobId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .populate('vehicleId');

    res.status(200).json({
      success: true,
      message: 'Delivery updated successfully',
      data: {
        transportJob: updatedJob
      }
    });
  } catch (error) {
    console.error('Error updating driver transport job drop:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update delivery',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
