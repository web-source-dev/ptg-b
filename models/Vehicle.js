const mongoose = require('mongoose');
const { VEHICLE_STATUS } = require('../constants/status');

const vehicleSchema = new mongoose.Schema({
  // Vehicle Identity
  vin: {
    type: String,
    uppercase: true,
    trim: true
  },
  year: {
    type: Number
  },
  make: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },

  // Purchase Details
  purchaseSource: {
    type: String,
    trim: true
  },
  purchaseDate: {
    type: Date
  },
  purchasePrice: {
    type: Number
  },
  buyerName: {
    type: String,
    trim: true
  },

  // Pickup Information
  pickupLocationName: {
    type: String,
    trim: true
  },
  pickupCity: {
    type: String,
    trim: true
  },
  pickupState: {
    type: String,
    trim: true
  },
  pickupZip: {
    type: String,
    trim: true
  },
  pickupContactName: {
    type: String,
    trim: true
  },
  pickupContactPhone: {
    type: String,
    trim: true
  },
  availableToShipDate: {
    type: Date
  },
  twicRequired: {
    type: Boolean,
    default: false
  },

  // Drop Information
  dropDestinationType: {
    type: String,
    trim: true
  },
  dropLocationName: {
    type: String,
    trim: true
  },
  dropCity: {
    type: String,
    trim: true
  },
  dropState: {
    type: String,
    trim: true
  },
  dropZip: {
    type: String,
    trim: true
  },
  dropContactName: {
    type: String,
    trim: true
  },
  dropContactPhone: {
    type: String,
    trim: true
  },

  // Status
  status: {
    type: String,
    enum: Object.values(VEHICLE_STATUS),
    default: VEHICLE_STATUS.PURCHASED_INTAKE_NEEDED
  },

  // Transport Job Reference
  transportJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransportJob'
  },
  createdBy: {
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
  source: {
    type: String,
    default: 'PTG'
  },
}, {
  timestamps: true
});

// Index for efficient queries
vehicleSchema.index({ vin: 1 });
vehicleSchema.index({ status: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
