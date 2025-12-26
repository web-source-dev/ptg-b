const mongoose = require('mongoose');

const truckSchema = new mongoose.Schema({
  // Truck Identification
  truckNumber: {
    type: String,
    trim: true
  },
  licensePlate: {
    type: String,
    trim: true
  },
  make: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  year: {
    type: Number
  },

  // Capacity Information
  capacity: {
    type: String,
    enum: ['Single', 'Double', 'Triple', 'Quad'],
    default: 'Single'
  },

  // Status
  status: {
    type: String,
    enum: ['Available', 'In Use', 'Maintenance', 'Out of Service'],
    default: 'Available'
  },

  // Current Assignment (optional)
  currentDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Verizon Connect Integration
  verizonConnectDeviceId: {
    type: String,
    trim: true
  },
  verizonConnectVehicleId: {
    type: String,
    trim: true
  },
  lastKnownLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date,
    address: String
  },

  // Notes
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
truckSchema.index({ truckNumber: 1 });
truckSchema.index({ status: 1 });
truckSchema.index({ capacity: 1 });
truckSchema.index({ verizonConnectDeviceId: 1 });

module.exports = mongoose.model('Truck', truckSchema);
