const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  // Route Identification
  routeNumber: {
    type: String,
    trim: true
  },

  // Assignment
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  truckId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    required: true
  },

  // Journey Schedule
  plannedStartDate: {
    type: Date,
    required: true
  },
  plannedEndDate: {
    type: Date,
    required: true
  },
  actualStartDate: {
    type: Date
  },
  actualEndDate: {
    type: Date
  },

  // Journey Locations (Start and End of entire route)
  journeyStartLocation: {
    name: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zip: {
      type: String,
      trim: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  journeyEndLocation: {
    name: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    zip: {
      type: String,
      trim: true
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },

  // Selected Transport Jobs (references only - for selection stage)
  selectedTransportJobs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransportJob'
  }],

  // Stops on this Route (pickup, drop, break, rest)
  stops: [{
    // Stop Type
    stopType: {
      type: String,
      enum: ['pickup', 'drop', 'break', 'rest'],
      required: true
    },
    
    // Transport Job Reference (required for pickup and drop stops)
    transportJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportJob',
      required: function() {
        return this.stopType === 'pickup' || this.stopType === 'drop';
      }
    },

    // Sequence number (order of stops in the route)
    sequence: {
      type: Number,
      required: true
    },

    // Location Details
    location: {
      name: {
        type: String,
        trim: true
      },
      address: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      zip: {
        type: String,
        trim: true
      },
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },

    // Scheduled Date and Time
    scheduledDate: {
      type: Date,
      required: true
    },
    scheduledTimeStart: {
      type: Date
    },
    scheduledTimeEnd: {
      type: Date
    },

    // Actual Date and Time (filled when stop is completed)
    actualDate: {
      type: Date
    },
    actualTime: {
      type: Date
    },

    // Stop Photos (photos taken at this stop)
    photos: [{
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
      },
      photoType: {
        type: String,
        enum: ['vehicle', 'stop'],
        default: 'stop'
      }
    }],

    // Stop Notes
    notes: {
      type: String,
      trim: true
    },

    // Stop Status
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed', 'Skipped'],
      default: 'Pending'
    }
  }],

  // Status
  status: {
    type: String,
    enum: ['Planned', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Planned'
  },


  // Route Reports
  reports: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    report: {
      type: String,
      trim: true,
      required: true
    },
    location: {
      latitude: Number,
      longitude: Number
    }
  }],

  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
routeSchema.index({ driverId: 1 });
routeSchema.index({ truckId: 1 });
routeSchema.index({ status: 1 });
routeSchema.index({ plannedStartDate: 1 });
routeSchema.index({ 'selectedTransportJobs': 1 });
routeSchema.index({ 'stops.transportJobId': 1 });
routeSchema.index({ 'stops.sequence': 1 });
routeSchema.index({ createdAt: -1 });

// Pre-save middleware to generate route number
routeSchema.pre('save', async function(next) {
  if (this.isNew && !this.routeNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('Route').countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });
    this.routeNumber = `RT-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Route', routeSchema);

