const Route = require('../models/Route');
const TransportJob = require('../models/TransportJob');
const {
  updateStatusOnRouteStatusChange,
  updateStatusOnStopUpdate
} = require('../utils/statusManager');

/**
 * Get all routes for the authenticated driver
 */
exports.getMyRoutes = async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const driverId = req.user._id;

    // Build query - only routes assigned to this driver
    let query = { driverId };

    if (status) {
      query.status = status;
    }

    const routes = await Route.find(query)
      .sort({ createdAt: -1 })
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
      })
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
    console.error('Error fetching driver routes:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch routes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get single route by ID (only if assigned to the driver)
 */
exports.getMyRouteById = async (req, res) => {
  try {
    const driverId = req.user._id;
    const routeId = req.params.id;

    const route = await Route.findOne({ _id: routeId, driverId })
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
        message: 'Route not found or not assigned to you'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        route
      }
    });
  } catch (error) {
    console.error('Error fetching driver route:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch route',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update route (driver can only update certain fields like status, actual dates, stop status, photos)
 */
exports.updateMyRoute = async (req, res) => {
  try {
    const driverId = req.user._id;
    const routeId = req.params.id;

    const route = await Route.findOne({ _id: routeId, driverId });
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found or not assigned to you'
      });
    }

    // Drivers can only update specific fields
    const allowedFields = [
      'status',
      'actualStartDate',
      'actualEndDate',
      'stops', // For updating stop status, photos, actual dates
      'reports'
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // If route status is changing to "In Progress", automatically set first stop to "In Progress"
    if (updateData.status === 'In Progress' && route.status !== 'In Progress') {
      if (route.stops && route.stops.length > 0) {
        // Sort stops by sequence
        const sortedStops = [...route.stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
        // Find first pending stop and set it to "In Progress"
        const firstPendingStop = sortedStops.find(s => !s.status || s.status === 'Pending');
        if (firstPendingStop) {
          // Update the stops array
          if (!updateData.stops) {
            updateData.stops = route.stops.map(s => {
              if (s._id && s._id.toString() === firstPendingStop._id.toString()) {
                const stopObj = s.toObject ? s.toObject() : s;
                return { ...stopObj, status: 'In Progress' };
              }
              return s.toObject ? s.toObject() : s;
            });
          } else {
            // If stops are being updated, find and update the first pending one
            updateData.stops = updateData.stops.map(s => {
              const stopId = s._id ? s._id.toString() : (s.id ? s.id.toString() : null);
              const firstPendingId = firstPendingStop._id ? firstPendingStop._id.toString() : (firstPendingStop.id ? firstPendingStop.id.toString() : null);
              if (stopId && firstPendingId && stopId === firstPendingId) {
                return { ...s, status: 'In Progress' };
              }
              return s;
            });
          }
        }
      }
    }

    // If updating stops, ensure sequence is maintained and validate
    if (updateData.stops !== undefined && Array.isArray(updateData.stops)) {
      updateData.stops.forEach((stop, index) => {
        if (stop.sequence === undefined) {
          stop.sequence = index + 1;
        }
      });

      // Check if any stop was marked as completed, and if so, set the next pending stop to "In Progress"
      // Compare with original route stops to detect changes
      const originalStops = route.stops || [];
      const sortedOriginalStops = [...originalStops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      const sortedUpdatedStops = [...updateData.stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      
      // Find stops that were just marked as completed
      const newlyCompletedStops = sortedUpdatedStops.filter(updatedStop => {
        const updatedStatus = updatedStop.status;
        if (updatedStatus !== 'Completed') return false;
        
        // Find corresponding original stop
        const originalStop = sortedOriginalStops.find(orig => {
          const origId = orig._id ? orig._id.toString() : (orig.id ? orig.id.toString() : null);
          const updatedId = updatedStop._id ? updatedStop._id.toString() : (updatedStop.id ? updatedStop.id.toString() : null);
          return origId && updatedId && origId === updatedId;
        });
        
        // Check if status changed from non-Completed to Completed
        return originalStop && originalStop.status !== 'Completed';
      });
      
      // If a stop was just completed, set the next pending stop to "In Progress"
      if (newlyCompletedStops.length > 0) {
        const inProgressStops = sortedUpdatedStops.filter(s => s.status === 'In Progress');
        
        // Only set next stop to "In Progress" if there's no stop currently in progress
        if (inProgressStops.length === 0) {
          const nextPendingStop = sortedUpdatedStops.find(s => {
            const status = s.status;
            return !status || status === 'Pending';
          });
          
          if (nextPendingStop) {
            const stopIndex = updateData.stops.findIndex(s => {
              const stopId = s._id ? s._id.toString() : (s.id ? s.id.toString() : null);
              const pendingId = nextPendingStop._id ? nextPendingStop._id.toString() : (nextPendingStop.id ? nextPendingStop.id.toString() : null);
              return stopId && pendingId && stopId === pendingId;
            });
            
            if (stopIndex !== -1) {
              updateData.stops[stopIndex].status = 'In Progress';
            }
          }
        }
      }
    }

    updateData.lastUpdatedBy = req.user._id;

    const updatedRoute = await Route.findByIdAndUpdate(
      routeId,
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

    // Handle route status change after save
    if (updateData.status && updateData.status !== route.status) {
      await updateStatusOnRouteStatusChange(routeId, updateData.status, route.status);
    }

    // Handle stop updates after save
    if (updateData.stops && Array.isArray(updateData.stops)) {
      const originalStops = route.stops || [];
      for (let index = 0; index < updateData.stops.length; index++) {
        const updatedStop = updateData.stops[index];
        const originalStop = originalStops.find(s => {
          const origId = s._id ? s._id.toString() : (s.id ? s.id.toString() : null);
          const updatedId = updatedStop._id ? updatedStop._id.toString() : (updatedStop.id ? updatedStop.id.toString() : null);
          return origId && updatedId && origId === updatedId;
        });

        if (originalStop && updatedStop.status && updatedStop.status !== originalStop.status) {
          await updateStatusOnStopUpdate(
            routeId,
            index,
            updatedStop.status,
            updatedStop.stopType,
            updatedStop.transportJobId
          );
        }
      }
    }

    // Reload route to get updated statuses
    const finalRoute = await Route.findById(routeId)
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
        route: finalRoute || updatedRoute
      }
    });
  } catch (error) {
    console.error('Error updating driver route:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update route',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a specific stop (for adding photos, updating status, actual dates)
 */
exports.updateMyRouteStop = async (req, res) => {
  try {
    const driverId = req.user._id;
    const routeId = req.params.id;
    const stopId = req.params.stopId;

    const route = await Route.findOne({ _id: routeId, driverId });
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found or not assigned to you'
      });
    }

    const stopIndex = route.stops.findIndex(s => 
      (s._id && s._id.toString() === stopId) || 
      (s._id === stopId)
    );

    if (stopIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stop not found'
      });
    }

    // Drivers can only update specific stop fields
    const allowedFields = [
      'status',
      'actualDate',
      'actualTime',
      'photos',
      'notes'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        route.stops[stopIndex][field] = req.body[field];
      }
    });

    route.lastUpdatedBy = req.user._id;
    await route.save();

    // Update statuses based on stop update (after save)
    const stop = route.stops[stopIndex];
    if (req.body.status && req.body.status !== stop.status) {
      await updateStatusOnStopUpdate(
        routeId,
        stopIndex,
        req.body.status,
        stop.stopType,
        stop.transportJobId
      );
    }

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
      message: 'Stop updated successfully',
      data: {
        route: updatedRoute
      }
    });
  } catch (error) {
    console.error('Error updating driver route stop:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update stop',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

