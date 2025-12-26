const Route = require('../models/Route');
const TransportJob = require('../models/TransportJob');
const Truck = require('../models/Truck');

/**
 * Create a new route
 */
exports.createRoute = async (req, res) => {
  try {
    const routeData = req.body;

    // Add metadata
    if (req.user) {
      routeData.createdBy = req.user._id;
      routeData.lastUpdatedBy = req.user._id;
    }

    // Validate driver and truck exist
    if (routeData.driverId && routeData.truckId) {
      // Check if truck is available
      const truck = await Truck.findById(routeData.truckId);
      if (!truck) {
        return res.status(404).json({
          success: false,
          message: 'Truck not found'
        });
      }

      // Update truck status if route is being created
      if (routeData.status === 'In Progress' || routeData.status === 'Planned') {
        truck.status = 'In Use';
        truck.currentDriver = routeData.driverId;
        await truck.save();
      }
    }

    // Create route
    const route = await Route.create(routeData);

    // Update transport jobs with route reference based on selectedTransportJobs and stops
    if (routeData.selectedTransportJobs && Array.isArray(routeData.selectedTransportJobs)) {
      for (const jobId of routeData.selectedTransportJobs) {
        await TransportJob.findByIdAndUpdate(jobId, {
            routeId: route._id
          });
        }
    }

    // Also update based on stops that have transportJobId
    if (routeData.stops && Array.isArray(routeData.stops)) {
      const jobIds = new Set();
      routeData.stops.forEach(stop => {
        if (stop.transportJobId) {
          jobIds.add(stop.transportJobId.toString());
        }
      });
      for (const jobId of jobIds) {
        await TransportJob.findByIdAndUpdate(jobId, {
          routeId: route._id
        });
      }
    }

    // Populate before sending response
    const populatedRoute = await Route.findById(route._id)
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .populate({
        path: 'selectedTransportJobs',
        select: 'jobNumber status vehicleId',
        populate: {
          path: 'vehicleId',
          select: 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone'
        }
      })
      .populate({
        path: 'stops.transportJobId',
        select: 'jobNumber status vehicleId',
        populate: {
          path: 'vehicleId',
          select: 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone'
        }
      });

    res.status(201).json({
      success: true,
      message: 'Route created successfully',
      data: {
        route: populatedRoute
      }
    });
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create route',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all routes with pagination and filters
 */
exports.getAllRoutes = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, driverId, truckId, search } = req.query;

    // Build query
    let query = {};

    if (status) {
      query.status = status;
    }

    if (driverId) {
      query.driverId = driverId;
    }

    if (truckId) {
      query.truckId = truckId;
    }

    if (search) {
      query.$or = [
        { routeNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const routes = await Route.find(query)
      .sort({ createdAt: -1 })
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Route.countDocuments(query);

    res.status(200).json({
      success: true,
      data: routes,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch routes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get single route by ID
 */
exports.getRouteById = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id)
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year status')
      .populate({
        path: 'selectedTransportJobs',
        select: 'jobNumber status vehicleId',
        populate: {
          path: 'vehicleId',
          select: 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone'
        }
      })
      .populate({
        path: 'stops.transportJobId',
        populate: {
          path: 'vehicleId',
          select: 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone'
        }
      })
      .populate('createdBy', 'firstName lastName email')
      .populate('lastUpdatedBy', 'firstName lastName email');

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        route
      }
    });
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch route',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update route
 */
exports.updateRoute = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      lastUpdatedBy: req.user ? req.user._id : undefined
    };

    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Handle truck status update if route status changes
    if (updateData.status && updateData.status !== route.status) {
      const truck = await Truck.findById(route.truckId);
      if (truck) {
        if (updateData.status === 'Completed' || updateData.status === 'Cancelled') {
          truck.status = 'Available';
          truck.currentDriver = undefined;
        } else if (updateData.status === 'In Progress' || updateData.status === 'Planned') {
          truck.status = 'In Use';
          if (updateData.driverId) {
            truck.currentDriver = updateData.driverId;
          }
        }
        await truck.save();
      }
    }

    // Handle selectedTransportJobs updates
    if (updateData.selectedTransportJobs !== undefined) {
      // Remove route reference from old transport jobs
      const oldJobIds = route.selectedTransportJobs 
        ? route.selectedTransportJobs.map(id => id.toString())
        : [];
      
      // Also get job IDs from old stops
      if (route.stops && Array.isArray(route.stops)) {
        route.stops.forEach(stop => {
          if (stop.transportJobId) {
            oldJobIds.push(stop.transportJobId.toString());
          }
        });
      }

      const uniqueOldJobIds = [...new Set(oldJobIds)];
      for (const jobId of uniqueOldJobIds) {
        await TransportJob.findByIdAndUpdate(jobId, {
          $unset: { routeId: 1 }
        });
      }

      // Add route reference to new selected transport jobs
      if (Array.isArray(updateData.selectedTransportJobs)) {
        for (const jobId of updateData.selectedTransportJobs) {
          await TransportJob.findByIdAndUpdate(jobId, {
              routeId: route._id
            });
        }
      }
    }

    // Handle stops updates - ensure sequence is set and update transport job references
    if (updateData.stops !== undefined && Array.isArray(updateData.stops)) {
      // Ensure sequence is set for all stops
      updateData.stops.forEach((stop, index) => {
        if (stop.sequence === undefined) {
          stop.sequence = index + 1;
            }
      });

      // Update transport job references from stops
      const jobIds = new Set();
      updateData.stops.forEach(stop => {
        if (stop.transportJobId) {
          jobIds.add(stop.transportJobId.toString());
        }
      });
      for (const jobId of jobIds) {
        await TransportJob.findByIdAndUpdate(jobId, {
          routeId: route._id
        });
      }
    }

    // Update route
    const updatedRoute = await Route.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .populate({
        path: 'selectedTransportJobs',
        select: 'jobNumber status vehicleId',
        populate: {
          path: 'vehicleId',
          select: 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone'
        }
      })
      .populate({
        path: 'stops.transportJobId',
        populate: {
          path: 'vehicleId',
          select: 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone'
        }
      });

    res.status(200).json({
      success: true,
      message: 'Route updated successfully',
      data: {
        route: updatedRoute
      }
    });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update route',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Remove transport job from route
 */
exports.removeTransportJobFromRoute = async (req, res) => {
  try {
    const { routeId } = req.params;
    const { transportJobId } = req.body;

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Remove transport job from selectedTransportJobs
    if (route.selectedTransportJobs) {
      route.selectedTransportJobs = route.selectedTransportJobs.filter(
        id => id.toString() !== transportJobId
      );
    }

    // Remove all stops associated with this transport job
    if (route.stops) {
      route.stops = route.stops.filter(
        stop => stop.transportJobId?.toString() !== transportJobId
    );
    
      // Re-sequence remaining stops
      route.stops.forEach((stop, index) => {
        stop.sequence = index + 1;
    });
    }

    await route.save();

    // Remove route reference from transport job
    await TransportJob.findByIdAndUpdate(transportJobId, {
      $unset: { routeId: 1 }
    });

    const updatedRoute = await Route.findById(routeId)
      .populate('driverId', 'firstName lastName email phoneNumber')
      .populate('truckId', 'truckNumber licensePlate make model year')
      .populate({
        path: 'selectedTransportJobs',
        select: 'jobNumber status vehicleId',
        populate: {
          path: 'vehicleId',
          select: 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone'
        }
      })
      .populate({
        path: 'stops.transportJobId',
        populate: {
          path: 'vehicleId',
          select: 'vin year make model pickupLocationName pickupCity pickupState pickupZip dropLocationName dropCity dropState dropZip pickupContactName pickupContactPhone dropContactName dropContactPhone'
        }
      });

    res.status(200).json({
      success: true,
      message: 'Transport job removed from route successfully',
      data: {
        route: updatedRoute
      }
    });
  } catch (error) {
    console.error('Error removing transport job from route:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove transport job from route',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete route
 */
exports.deleteRoute = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Remove route reference from all transport jobs in selectedTransportJobs
    if (route.selectedTransportJobs && Array.isArray(route.selectedTransportJobs)) {
      for (const jobId of route.selectedTransportJobs) {
        await TransportJob.findByIdAndUpdate(jobId, {
        $unset: { routeId: 1 }
      });
      }
    }

    // Also remove route reference from transport jobs in stops
    if (route.stops && Array.isArray(route.stops)) {
      const jobIds = new Set();
      route.stops.forEach(stop => {
        if (stop.transportJobId) {
          jobIds.add(stop.transportJobId.toString());
        }
      });
      for (const jobId of jobIds) {
        await TransportJob.findByIdAndUpdate(jobId, {
          $unset: { routeId: 1 }
        });
      }
    }

    // Update truck status
    if (route.truckId) {
      const truck = await Truck.findById(route.truckId);
      if (truck) {
        truck.status = 'Available';
        truck.currentDriver = undefined;
        await truck.save();
      }
    }

    // Delete route
    await Route.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Route deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete route',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

