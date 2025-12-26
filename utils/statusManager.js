/**
 * Status Management Utility
 * 
 * This utility handles automatic status updates across Vehicle, TransportJob, Route, and Truck models
 * to ensure status consistency throughout the application lifecycle.
 */

const Vehicle = require('../models/Vehicle');
const TransportJob = require('../models/TransportJob');
const Route = require('../models/Route');
const Truck = require('../models/Truck');
const {
  VEHICLE_STATUS,
  TRANSPORT_JOB_STATUS,
  ROUTE_STATUS,
  TRUCK_STATUS,
  ROUTE_STOP_STATUS
} = require('../constants/status');

/**
 * Update vehicle status when vehicle is created/submitted
 */
exports.updateVehicleOnCreate = async (vehicleId) => {
  try {
    await Vehicle.findByIdAndUpdate(vehicleId, {
      status: VEHICLE_STATUS.INTAKE_COMPLETE // This maps to 'Intake Completed'
    });
  } catch (error) {
    console.error('Error updating vehicle status on create:', error);
  }
};

/**
 * Update vehicle and transport job status when transport job is created
 */
exports.updateStatusOnTransportJobCreate = async (transportJobId, vehicleId) => {
  try {
    // Update transport job status to "Needs Dispatch"
    await TransportJob.findByIdAndUpdate(transportJobId, {
      status: TRANSPORT_JOB_STATUS.NEEDS_DISPATCH
    });

    // Update vehicle status to "Ready for Transport"
    if (vehicleId) {
      await Vehicle.findByIdAndUpdate(vehicleId, {
        status: VEHICLE_STATUS.READY_FOR_TRANSPORT
      });
    }
  } catch (error) {
    console.error('Error updating status on transport job create:', error);
  }
};

/**
 * Update statuses when route is created
 */
exports.updateStatusOnRouteCreate = async (routeId, selectedTransportJobs, truckId) => {
  try {
    // Update route status to "Planned" (default, but ensure it's set)
    const route = await Route.findById(routeId);
    if (route && route.status !== ROUTE_STATUS.PLANNED) {
      route.status = ROUTE_STATUS.PLANNED;
      await route.save();
    }

    // Update transport jobs status to "Dispatched"
    if (selectedTransportJobs && Array.isArray(selectedTransportJobs)) {
      for (const jobId of selectedTransportJobs) {
        await TransportJob.findByIdAndUpdate(jobId, {
          status: TRANSPORT_JOB_STATUS.DISPATCHED
        });

        // Get transport job to find vehicle
        const job = await TransportJob.findById(jobId).populate('vehicleId');
        if (job && job.vehicleId) {
          await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
            status: VEHICLE_STATUS.READY_FOR_TRANSPORT
          });
        }
      }
    }

    // Update truck status to "In Use"
    if (truckId) {
      await Truck.findByIdAndUpdate(truckId, {
        status: TRUCK_STATUS.IN_USE
      });
    }
  } catch (error) {
    console.error('Error updating status on route create:', error);
  }
};

/**
 * Update statuses when route status changes
 */
exports.updateStatusOnRouteStatusChange = async (routeId, newStatus, oldStatus) => {
  try {
    const route = await Route.findById(routeId)
      .populate('selectedTransportJobs')
      .populate('truckId');

    if (!route) return;

    // Get all transport jobs from selectedTransportJobs and stops
    const transportJobIds = new Set();
    
    if (route.selectedTransportJobs && Array.isArray(route.selectedTransportJobs)) {
      route.selectedTransportJobs.forEach(job => {
        const jobId = typeof job === 'object' ? (job._id || job.id) : job;
        if (jobId) transportJobIds.add(jobId.toString());
      });
    }

    if (route.stops && Array.isArray(route.stops)) {
      route.stops.forEach(stop => {
        if (stop.transportJobId) {
          const jobId = typeof stop.transportJobId === 'object' 
            ? (stop.transportJobId._id || stop.transportJobId.id) 
            : stop.transportJobId;
          if (jobId) transportJobIds.add(jobId.toString());
        }
      });
    }

    // Update statuses based on route status
    if (newStatus === ROUTE_STATUS.IN_PROGRESS) {
      // Route started - update transport jobs and vehicles
      for (const jobId of transportJobIds) {
        await TransportJob.findByIdAndUpdate(jobId, {
          status: TRANSPORT_JOB_STATUS.IN_TRANSIT
        });

        const job = await TransportJob.findById(jobId).populate('vehicleId');
        if (job && job.vehicleId) {
          await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
            status: VEHICLE_STATUS.IN_TRANSPORT
          });
        }
      }

      // Update truck status
      if (route.truckId) {
        await Truck.findByIdAndUpdate(route.truckId._id || route.truckId, {
          status: TRUCK_STATUS.IN_USE
        });
      }
    } else if (newStatus === ROUTE_STATUS.COMPLETED) {
      // Route completed - check if all stops are completed
      const allStopsCompleted = route.stops && route.stops.length > 0 
        ? route.stops.every(stop => stop.status === ROUTE_STOP_STATUS.COMPLETED)
        : false;

      if (allStopsCompleted) {
        // All stops completed - mark transport jobs and vehicles as delivered
        for (const jobId of transportJobIds) {
          await TransportJob.findByIdAndUpdate(jobId, {
            status: TRANSPORT_JOB_STATUS.DELIVERED
          });

          const job = await TransportJob.findById(jobId).populate('vehicleId');
          if (job && job.vehicleId) {
            await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
              status: VEHICLE_STATUS.DELIVERED
            });
          }
        }
      }

      // Update truck status to Available
      if (route.truckId) {
        await Truck.findByIdAndUpdate(route.truckId._id || route.truckId, {
          status: TRUCK_STATUS.AVAILABLE,
          currentDriver: undefined
        });
      }
    } else if (newStatus === ROUTE_STATUS.CANCELLED) {
      // Route cancelled - revert transport jobs and vehicles
      for (const jobId of transportJobIds) {
        await TransportJob.findByIdAndUpdate(jobId, {
          status: TRANSPORT_JOB_STATUS.NEEDS_DISPATCH
        });

        const job = await TransportJob.findById(jobId).populate('vehicleId');
        if (job && job.vehicleId) {
          await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
            status: VEHICLE_STATUS.READY_FOR_TRANSPORT
          });
        }
      }

      // Update truck status to Available
      if (route.truckId) {
        await Truck.findByIdAndUpdate(route.truckId._id || route.truckId, {
          status: TRUCK_STATUS.AVAILABLE,
          currentDriver: undefined
        });
      }
    }
  } catch (error) {
    console.error('Error updating status on route status change:', error);
  }
};

/**
 * Update statuses when a stop is updated
 * Note: This should be called after the route has been saved with updated stops
 */
exports.updateStatusOnStopUpdate = async (routeId, stopIndex, newStopStatus, stopType, transportJobId) => {
  try {
    // Reload route to get latest stop statuses
    const route = await Route.findById(routeId);
    if (!route) return;

    // If stop is completed and it's a drop stop, update transport job and vehicle
    if (newStopStatus === ROUTE_STOP_STATUS.COMPLETED && stopType === 'drop' && transportJobId) {
      const jobId = typeof transportJobId === 'object' 
        ? (transportJobId._id || transportJobId.id) 
        : transportJobId;

      // Check if all drop stops for this transport job are completed
      const allDropStopsCompleted = route.stops.filter(stop => {
        const stopJobId = typeof stop.transportJobId === 'object'
          ? (stop.transportJobId._id || stop.transportJobId.id)
          : stop.transportJobId;
        return stopJobId && stopJobId.toString() === jobId.toString() && stop.stopType === 'drop';
      }).every(stop => stop.status === ROUTE_STOP_STATUS.COMPLETED);

      if (allDropStopsCompleted) {
        // All drop stops completed - mark transport job and vehicle as delivered
        await TransportJob.findByIdAndUpdate(jobId, {
          status: TRANSPORT_JOB_STATUS.DELIVERED
        });

        const job = await TransportJob.findById(jobId).populate('vehicleId');
        if (job && job.vehicleId) {
          await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
            status: VEHICLE_STATUS.DELIVERED
          });
        }
      }
    }

    // If stop is completed and it's a pickup stop, update vehicle status to "In Transport"
    if (newStopStatus === ROUTE_STOP_STATUS.COMPLETED && stopType === 'pickup' && transportJobId) {
      const jobId = typeof transportJobId === 'object' 
        ? (transportJobId._id || transportJobId.id) 
        : transportJobId;

      const job = await TransportJob.findById(jobId).populate('vehicleId');
      if (job && job.vehicleId) {
        // Only update if not already delivered
        const vehicle = await Vehicle.findById(job.vehicleId._id || job.vehicleId);
        if (vehicle && vehicle.status !== VEHICLE_STATUS.DELIVERED) {
          await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
            status: VEHICLE_STATUS.IN_TRANSPORT
          });
        }
      }
    }

    // Check if all stops are completed and update route status
    if (route.stops && route.stops.length > 0) {
      const allStopsCompleted = route.stops.every(stop => 
        stop.status === ROUTE_STOP_STATUS.COMPLETED
      );

      if (allStopsCompleted && route.status !== ROUTE_STATUS.COMPLETED) {
        route.status = ROUTE_STATUS.COMPLETED;
        await route.save();

        // Update truck status
        if (route.truckId) {
          await Truck.findByIdAndUpdate(route.truckId, {
            status: TRUCK_STATUS.AVAILABLE,
            currentDriver: undefined
          });
        }

        // Update all transport jobs and vehicles as delivered
        const transportJobIds = new Set();
        if (route.selectedTransportJobs && Array.isArray(route.selectedTransportJobs)) {
          route.selectedTransportJobs.forEach(job => {
            const jobId = typeof job === 'object' ? (job._id || job.id) : job;
            if (jobId) transportJobIds.add(jobId.toString());
          });
        }

        // Also get job IDs from stops
        route.stops.forEach(stop => {
          if (stop.transportJobId) {
            const jobId = typeof stop.transportJobId === 'object'
              ? (stop.transportJobId._id || stop.transportJobId.id)
              : stop.transportJobId;
            if (jobId) transportJobIds.add(jobId.toString());
          }
        });

        for (const jobId of transportJobIds) {
          await TransportJob.findByIdAndUpdate(jobId, {
            status: TRANSPORT_JOB_STATUS.DELIVERED
          });

          const job = await TransportJob.findById(jobId).populate('vehicleId');
          if (job && job.vehicleId) {
            await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
              status: VEHICLE_STATUS.DELIVERED
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error updating status on stop update:', error);
  }
};

/**
 * Update statuses when transport job is removed from route
 */
exports.updateStatusOnTransportJobRemoved = async (transportJobId) => {
  try {
    // Update transport job status back to "Needs Dispatch"
    await TransportJob.findByIdAndUpdate(transportJobId, {
      status: TRANSPORT_JOB_STATUS.NEEDS_DISPATCH,
      $unset: { routeId: 1 }
    });

    // Update vehicle status back to "Ready for Transport"
    const job = await TransportJob.findById(transportJobId).populate('vehicleId');
    if (job && job.vehicleId) {
      await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
        status: VEHICLE_STATUS.READY_FOR_TRANSPORT
      });
    }
  } catch (error) {
    console.error('Error updating status on transport job removed:', error);
  }
};

