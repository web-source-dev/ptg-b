const Truck = require('../models/Truck');

/**
 * Create a new truck
 */
exports.createTruck = async (req, res) => {
  try {
    const truckData = req.body;

    // Add metadata
    if (req.user) {
      // Can track who created it if needed
    }

    // Create truck
    const truck = await Truck.create(truckData);

    res.status(201).json({
      success: true,
      message: 'Truck created successfully',
      data: {
        truck
      }
    });
  } catch (error) {
    console.error('Error creating truck:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create truck',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all trucks with pagination and filters
 */
exports.getAllTrucks = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, capacity, search } = req.query;

    // Build query
    let query = {};

    if (status) {
      query.status = status;
    }

    if (capacity) {
      query.capacity = capacity;
    }

    if (search) {
      query.$or = [
        { truckNumber: { $regex: search, $options: 'i' } },
        { licensePlate: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    const trucks = await Truck.find(query)
      .sort({ createdAt: -1 })
      .populate('currentDriver', 'firstName lastName email phoneNumber')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Truck.countDocuments(query);

    res.status(200).json({
      success: true,
      data: trucks,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching trucks:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch trucks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get single truck by ID
 */
exports.getTruckById = async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id)
      .populate('currentDriver', 'firstName lastName email phoneNumber');

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        truck
      }
    });
  } catch (error) {
    console.error('Error fetching truck:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch truck',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update truck
 */
exports.updateTruck = async (req, res) => {
  try {
    const truck = await Truck.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('currentDriver', 'firstName lastName email phoneNumber');

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Truck updated successfully',
      data: {
        truck
      }
    });
  } catch (error) {
    console.error('Error updating truck:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update truck',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete truck
 */
exports.deleteTruck = async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id);

    if (!truck) {
      return res.status(404).json({
        success: false,
        message: 'Truck not found'
      });
    }

    // Check if truck is currently in use
    if (truck.status === 'In Use') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete truck that is currently in use. Please change the status first.'
      });
    }

    await Truck.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Truck deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting truck:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete truck',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

