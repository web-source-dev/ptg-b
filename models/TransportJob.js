const mongoose = require('mongoose');
const { TRANSPORT_JOB_STATUS } = require('../constants/status');
const { getDefaultPickupChecklist, getDefaultDropChecklist } = require('../utils/checklistDefaults');

const transportJobSchema = new mongoose.Schema({
  // Job Identification
  jobNumber: {
    type: String,
    trim: true
  },

  // Vehicle Reference
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },

  // Status Tracking
  status: {
    type: String,
    enum: Object.values(TRANSPORT_JOB_STATUS),
    default: TRANSPORT_JOB_STATUS.PENDING
  },

  // Carrier Information
  carrier: {
    type: String,
    default: 'PTG'
  },
  externalCarrierName: {
    type: String,
    trim: true
  },

  // Central Dispatch
  centralDispatchLoadId: {
    type: String,
    trim: true
  },
  centralDispatchPosted: {
    type: Boolean,
    default: false
  },
  centralDispatchPostedAt: {
    type: Date
  },

  // Driver and Truck Assignment (for PTG jobs)
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  truckId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck'
  },

  // Scheduling - Planned dates set by dispatcher when creating job
  // All location info comes from Vehicle model (pickupCity, pickupState, dropCity, dropState, etc.)
  // All customer preference dates come from Vehicle model (pickupDateStart, dropDateEnd, etc.)
  plannedPickupDate: {
    type: Date
  },
  plannedDeliveryDate: {
    type: Date
  },

  // Proof of Delivery - Vehicle Condition Photos
  pickupPhotos: [{
    url: {
      type: String,
      trim: true,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      latitude: Number,
      longitude: Number
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  deliveryPhotos: [{
    url: {
      type: String,
      trim: true,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      latitude: Number,
      longitude: Number
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  billOfLading: {
    type: String,
    trim: true
  },

  // Pickup Checklist
  pickupChecklist: [{
    item: {
      type: String,
      trim: true,
      required: true
    },
    checked: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      trim: true
    },
    completedAt: {
      type: Date
    }
  }],

  // Drop Checklist
  dropChecklist: [{
    item: {
      type: String,
      trim: true,
      required: true
    },
    checked: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      trim: true
    },
    completedAt: {
      type: Date
    }
  }],

  // Pickup Notes
  pickupNotes: {
    type: String,
    trim: true
  },

  // Delivery Notes
  deliveryNotes: {
    type: String,
    trim: true
  },

  // Central Dispatch Manual Updates (for info tracking)
  centralDispatchTruckInfo: {
    type: String,
    trim: true
  },
  centralDispatchAmount: {
    type: Number
  },
  centralDispatchNotes: {
    type: String,
    trim: true
  },

  // Pricing
  carrierPayment: {
    type: Number
  },

  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  externalUserId: {
    type: String,
    trim: true
  },
  externalUserEmail: {
    type: String,
    trim: true
  },
}, {
  timestamps: true
});

// Index for efficient queries
transportJobSchema.index({ jobNumber: 1 });
transportJobSchema.index({ vehicleId: 1 });
transportJobSchema.index({ status: 1 });
transportJobSchema.index({ carrier: 1 });
transportJobSchema.index({ driverId: 1 });
transportJobSchema.index({ truckId: 1 });
transportJobSchema.index({ centralDispatchLoadId: 1 });
transportJobSchema.index({ createdAt: -1 });

// Pre-save middleware to generate job number and initialize checklists
transportJobSchema.pre('save', async function(next) {
  if (this.isNew && !this.jobNumber) {
    // Generate job number like TJ-20241222-001
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('TransportJob').countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });
    this.jobNumber = `TJ-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }

  // Initialize checklists if not provided
  if (!this.pickupChecklist || this.pickupChecklist.length === 0) {
    this.pickupChecklist = getDefaultPickupChecklist();
  }
  if (!this.dropChecklist || this.dropChecklist.length === 0) {
    this.dropChecklist = getDefaultDropChecklist();
  }

  next();
});

module.exports = mongoose.model('TransportJob', transportJobSchema);
