/**
 * Status Enums for VOS-PTG System
 * 
 * This file contains all status enums used across the application.
 * Use these constants to ensure consistency across the codebase.
 */

// Transport Job Status
const TRANSPORT_JOB_STATUS = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

// Truck Status
const TRUCK_STATUS = {
  AVAILABLE: 'Available',
  IN_USE: 'In Use',
  MAINTENANCE: 'Maintenance',
  OUT_OF_SERVICE: 'Out of Service'
};

// Vehicle Status
const VEHICLE_STATUS = {
  INTAKE_COMPLETE: 'Intake Completed',
  IN_TRANSPORT: 'In Transport',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled'
};

// Truck Capacity
const TRUCK_CAPACITY = {
  SINGLE: 'Single',
  DOUBLE: 'Double',
  TRIPLE: 'Triple',
  QUAD: 'Quad'
};

// Carrier Types
const CARRIER = {
  PTG: 'PTG',
  CENTRAL_DISPATCH: 'Central Dispatch'
};

// Get all status enums for API response
const getAllStatusEnums = () => {
  return {
    transportJob: {
      values: Object.values(TRANSPORT_JOB_STATUS),
      labels: {
        [TRANSPORT_JOB_STATUS.PENDING]: 'Pending',
        [TRANSPORT_JOB_STATUS.IN_PROGRESS]: 'In Progress',
        [TRANSPORT_JOB_STATUS.COMPLETED]: 'Completed',
        [TRANSPORT_JOB_STATUS.CANCELLED]: 'Cancelled'
      }
    },
    truck: {
      values: Object.values(TRUCK_STATUS),
      labels: {
        [TRUCK_STATUS.AVAILABLE]: 'Available',
        [TRUCK_STATUS.IN_USE]: 'In Use',
        [TRUCK_STATUS.MAINTENANCE]: 'Maintenance',
        [TRUCK_STATUS.OUT_OF_SERVICE]: 'Out of Service'
      }
    },
    vehicle: {
      values: Object.values(VEHICLE_STATUS),
      labels: {
        [VEHICLE_STATUS.INTAKE_COMPLETE]: 'Intake Completed',
        [VEHICLE_STATUS.IN_TRANSPORT]: 'In Transport',
        [VEHICLE_STATUS.DELIVERED]: 'Delivered',
        [VEHICLE_STATUS.CANCELLED]: 'Cancelled'
      }
    },
    truckCapacity: {
      values: Object.values(TRUCK_CAPACITY),
      labels: {
        [TRUCK_CAPACITY.SINGLE]: 'Single',
        [TRUCK_CAPACITY.DOUBLE]: 'Double',
        [TRUCK_CAPACITY.TRIPLE]: 'Triple',
        [TRUCK_CAPACITY.QUAD]: 'Quad'
      }
    },
    carrier: {
      values: Object.values(CARRIER),
      labels: {
        [CARRIER.PTG]: 'PTG (Own Service)',
        [CARRIER.CENTRAL_DISPATCH]: 'Central Dispatch'
      }
    }
  };
};

module.exports = {
  TRANSPORT_JOB_STATUS,
  TRUCK_STATUS,
  VEHICLE_STATUS,
  TRUCK_CAPACITY,
  CARRIER,
  getAllStatusEnums
};

