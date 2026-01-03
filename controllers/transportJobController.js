const TransportJob = require('../models/TransportJob');
const Vehicle = require('../models/Vehicle');
const Truck = require('../models/Truck');
const { updateStatusOnTransportJobCreate, updateStatusOnTransportJobAssigned } = require('../utils/statusManager');

/**
 * Create a new transport job
 */
exports.createTransportJob = async (req, res) => {
  try {
    const jobData = req.body;

    // Add metadata
    if (req.user) {
      jobData.createdBy = req.user._id;
      jobData.lastUpdatedBy = req.user._id;
    }

    // Create transport job
    const transportJob = await TransportJob.create(jobData);

    // If vehicleId is provided, update vehicle with transport job reference
    if (jobData.vehicleId) {
      await Vehicle.findByIdAndUpdate(jobData.vehicleId, {
        transportJobId: transportJob._id
      });
    }

    // Update statuses: transport job stays "Pending", vehicle to "In Transport"
    await updateStatusOnTransportJobCreate(transportJob._id, jobData.vehicleId);

    // Reload transport job to get updated status
    const updatedTransportJob = await TransportJob.findById(transportJob._id)
      .populate('vehicleId', 'vin year make model');

    res.status(201).json({
      success: true,
      message: 'Transport job created successfully',
      data: {
        transportJob: updatedTransportJob
      }
    });
  } catch (error) {
    console.error('Error creating transport job:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create transport job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all transport jobs with pagination and filters
 */
exports.getAllTransportJobs = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, carrier, search, driverId, truckId } = req.query;

    // Build query
    let query = {};

    if (status) {
      query.status = status;
    }

    if (carrier) {
      query.carrier = carrier;
    }

    if (driverId) {
      query.driverId = driverId;
    }

    if (truckId) {
      query.truckId = truckId;
    }

    if (search) {
      query.$or = [
        { jobNumber: { $regex: search, $options: 'i' } },
        { centralDispatchLoadId: { $regex: search, $options: 'i' } }
      ];
    }

    const transportJobs = await TransportJob.find(query)
      .sort({ createdAt: -1 })
      .populate('vehicleId', 'vin year make model pickupCity pickupState dropCity dropState')
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
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
    console.error('Error fetching transport jobs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch transport jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get single transport job by ID
 */
exports.getTransportJobById = async (req, res) => {
  try {
    const transportJob = await TransportJob.findById(req.params.id)
      .populate('vehicleId')
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email');

    if (!transportJob) {
      return res.status(404).json({
        success: false,
        message: 'Transport job not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        transportJob
      }
    });
  } catch (error) {
    console.error('Error fetching transport job:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch transport job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update transport job
 */
exports.updateTransportJob = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      lastUpdatedBy: req.user ? req.user._id : undefined
    };

    const oldJob = await TransportJob.findById(req.params.id);
    if (!oldJob) {
      return res.status(404).json({
        success: false,
        message: 'Transport job not found'
      });
    }

    // Handle driver/truck assignment
    if (updateData.driverId || updateData.truckId) {
      // If assigning to driver/truck, update truck status and currentDriver
      if (updateData.truckId) {
        const truck = await Truck.findById(updateData.truckId);
        if (truck) {
          truck.status = 'In Use';
          if (updateData.driverId) {
            truck.currentDriver = updateData.driverId;
          }
          await truck.save();
        }
      }

      // Update status to "In Progress" when assigned
      if (updateData.driverId && updateData.truckId) {
        updateData.status = 'In Progress';
      }

      // Update statuses
      await updateStatusOnTransportJobAssigned(req.params.id, updateData.driverId, updateData.truckId);
    }

    const transportJob = await TransportJob.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('vehicleId', 'vin year make model')
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year');

    if (!transportJob) {
      return res.status(404).json({
        success: false,
        message: 'Transport job not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Transport job updated successfully',
      data: {
        transportJob
      }
    });
  } catch (error) {
    console.error('Error updating transport job:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update transport job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete transport job
 */
exports.deleteTransportJob = async (req, res) => {
  try {
    const transportJob = await TransportJob.findById(req.params.id);

    if (!transportJob) {
      return res.status(404).json({
        success: false,
        message: 'Transport job not found'
      });
    }

    // Check if transport job is assigned to driver/truck
    if (transportJob.driverId || transportJob.truckId) {
      // Update truck status if needed
      if (transportJob.truckId) {
        const truck = await Truck.findById(transportJob.truckId);
        if (truck) {
          // Check if truck has other assigned jobs
          const otherJobs = await TransportJob.countDocuments({ 
            truckId: transportJob.truckId,
            _id: { $ne: transportJob._id },
            status: 'In Progress'
          });
          
          if (otherJobs === 0) {
            truck.status = 'Available';
            truck.currentDriver = undefined;
            await truck.save();
          }
        }
      }
    }

    // Remove transport job reference from vehicle
    if (transportJob.vehicleId) {
      await Vehicle.findByIdAndUpdate(transportJob.vehicleId, {
        $unset: { transportJobId: 1 }
      });
    }

    await TransportJob.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Transport job deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting transport job:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete transport job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

