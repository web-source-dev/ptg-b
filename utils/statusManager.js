/**
 * Status Management Utility
 * 
 * This utility handles automatic status updates across Vehicle, TransportJob, and Truck models
 * to ensure status consistency throughout the application lifecycle.
 */

const Vehicle = require('../models/Vehicle');
const TransportJob = require('../models/TransportJob');
const Truck = require('../models/Truck');
const {
  VEHICLE_STATUS,
  TRANSPORT_JOB_STATUS,
  TRUCK_STATUS
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
    // Transport job status remains "Pending" (default) until assigned
    // Update vehicle status to "In Transport" when transport job is created
    if (vehicleId) {
      await Vehicle.findByIdAndUpdate(vehicleId, {
        status: VEHICLE_STATUS.IN_TRANSPORT
      });
    }
  } catch (error) {
    console.error('Error updating status on transport job create:', error);
  }
};

/**
 * Update statuses when transport job is assigned to driver/truck
 */
exports.updateStatusOnTransportJobAssigned = async (transportJobId, driverId, truckId) => {
  try {
    // Update transport job status to "In Progress"
    await TransportJob.findByIdAndUpdate(transportJobId, {
      status: TRANSPORT_JOB_STATUS.IN_PROGRESS
    });

    // Update vehicle status to "In Transport"
    const job = await TransportJob.findById(transportJobId).populate('vehicleId');
    if (job && job.vehicleId) {
      await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
        status: VEHICLE_STATUS.IN_TRANSPORT
      });
    }

    // Update truck status to "In Use" and set currentDriver
    if (truckId) {
      await Truck.findByIdAndUpdate(truckId, {
        status: TRUCK_STATUS.IN_USE,
        currentDriver: driverId || undefined
      });
    }
  } catch (error) {
    console.error('Error updating status on transport job assigned:', error);
  }
};

/**
 * Update statuses when transport job pickup is completed
 */
exports.updateStatusOnTransportJobPickup = async (transportJobId) => {
  try {
    // Update transport job status to "In Progress"
    await TransportJob.findByIdAndUpdate(transportJobId, {
      status: TRANSPORT_JOB_STATUS.IN_PROGRESS
    });

    // Update vehicle status to "In Transport"
    const job = await TransportJob.findById(transportJobId).populate('vehicleId');
    if (job && job.vehicleId) {
      await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
        status: VEHICLE_STATUS.IN_TRANSPORT
      });
    }
  } catch (error) {
    console.error('Error updating status on transport job pickup:', error);
  }
};

/**
 * Update statuses when transport job drop/delivery is completed
 */
exports.updateStatusOnTransportJobDrop = async (transportJobId) => {
  try {
    // Update transport job status to "Completed"
    await TransportJob.findByIdAndUpdate(transportJobId, {
      status: TRANSPORT_JOB_STATUS.COMPLETED
    });

    // Update vehicle status to "Delivered"
    const job = await TransportJob.findById(transportJobId).populate('vehicleId');
    if (job && job.vehicleId) {
      await Vehicle.findByIdAndUpdate(job.vehicleId._id || job.vehicleId, {
        status: VEHICLE_STATUS.DELIVERED
      });
    }

    // Update truck status if no other jobs assigned
    if (job && job.truckId) {
      const otherActiveJobs = await TransportJob.countDocuments({
        truckId: job.truckId,
        _id: { $ne: transportJobId },
        status: TRANSPORT_JOB_STATUS.IN_PROGRESS
      });

      if (otherActiveJobs === 0) {
        await Truck.findByIdAndUpdate(job.truckId, {
          status: TRUCK_STATUS.AVAILABLE,
          currentDriver: undefined
        });
      }
    }
  } catch (error) {
    console.error('Error updating status on transport job drop:', error);
  }
};
