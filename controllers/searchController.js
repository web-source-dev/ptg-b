const Vehicle = require('../models/Vehicle');
const Truck = require('../models/Truck');
const TransportJob = require('../models/TransportJob');
const User = require('../models/User');

// Global search function
const globalSearch = async (req, res) => {
  try {
    const { q: query } = req.params;
    const { limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        data: [],
        total: 0
      });
    }

    const searchTerm = query.trim();
    const searchLimit = Math.min(parseInt(limit) || 10, 50); // Max 50 results
    const results = [];

    // Search Vehicles
    try {
      const vehicles = await Vehicle.find({
        $or: [
          { vin: { $regex: searchTerm, $options: 'i' } },
          { make: { $regex: searchTerm, $options: 'i' } },
          { model: { $regex: searchTerm, $options: 'i' } },
          { buyerName: { $regex: searchTerm, $options: 'i' } },
          { pickupLocationName: { $regex: searchTerm, $options: 'i' } },
          { dropLocationName: { $regex: searchTerm, $options: 'i' } }
        ]
      })
      .limit(searchLimit)
      .select('_id vin make model year buyerName pickupCity pickupState dropCity dropState status')
      .sort({ createdAt: -1 });

      vehicles.forEach(vehicle => {
        results.push({
          id: vehicle._id,
          type: 'vehicle',
          title: vehicle.vin,
          subtitle: `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Unknown Vehicle',
          description: `Buyer: ${vehicle.buyerName || 'N/A'} • ${vehicle.pickupCity}, ${vehicle.pickupState} → ${vehicle.dropCity}, ${vehicle.dropState}`,
          status: vehicle.status,
          statusColor: getStatusColor('vehicle', vehicle.status),
          route: `/vehicles/${vehicle._id}`
        });
      });
    } catch (error) {
      console.error('Vehicle search error:', error);
    }

    // Search Trucks
    try {
      const trucks = await Truck.find({
        $or: [
          { truckNumber: { $regex: searchTerm, $options: 'i' } },
          { licensePlate: { $regex: searchTerm, $options: 'i' } },
          { make: { $regex: searchTerm, $options: 'i' } },
          { model: { $regex: searchTerm, $options: 'i' } },
          { 'currentDriver.firstName': { $regex: searchTerm, $options: 'i' } },
          { 'currentDriver.lastName': { $regex: searchTerm, $options: 'i' } },
          { 'currentDriver.email': { $regex: searchTerm, $options: 'i' } }
        ]
      })
      .limit(searchLimit)
      .select('_id truckNumber licensePlate make model year capacity status currentDriver')
      .sort({ createdAt: -1 });

      trucks.forEach(truck => {
        const driverName = truck.currentDriver ?
          `${truck.currentDriver.firstName || ''} ${truck.currentDriver.lastName || ''}`.trim() ||
          truck.currentDriver.email || 'Unknown Driver' : 'No Driver Assigned';

        results.push({
          id: truck._id,
          type: 'truck',
          title: truck.truckNumber || truck.licensePlate || 'Unknown Truck',
          subtitle: `${truck.make || ''} ${truck.model || ''} ${truck.year || ''}`.trim() || 'Unknown Model',
          description: `Capacity: ${truck.capacity} • Driver: ${driverName}`,
          status: truck.status,
          statusColor: getStatusColor('truck', truck.status),
          route: `/trucks/${truck._id}`
        });
      });
    } catch (error) {
      console.error('Truck search error:', error);
    }

    // Search Transport Jobs
    try {
      const transportJobs = await TransportJob.find({
        $or: [
          { jobNumber: { $regex: searchTerm, $options: 'i' } },
          { carrier: { $regex: searchTerm, $options: 'i' } }
        ]
      })
      .populate('vehicleId', 'vin make model year buyerName')
      .limit(searchLimit)
      .select('_id jobNumber status carrier vehicleId plannedPickupDate plannedDeliveryDate')
      .sort({ createdAt: -1 });

      transportJobs.forEach(job => {
        const vehicle = job.vehicleId;
        const vehicleInfo = vehicle ? `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || vehicle.vin : 'Unknown Vehicle';

        results.push({
          id: job._id,
          type: 'transportJob',
          title: job.jobNumber || 'Unknown Job',
          subtitle: vehicleInfo,
          description: `${job.carrier} • ${formatDate(job.plannedPickupDate)} - ${formatDate(job.plannedDeliveryDate)}`,
          status: job.status,
          statusColor: getStatusColor('transportJob', job.status),
          route: job.carrier === 'Central Dispatch' ? `/transport-jobs/${job._id}/central-dispatch` : `/transport-jobs/${job._id}`
        });
      });
    } catch (error) {
      console.error('Transport Job search error:', error);
    }

    // Search Users (only if admin/dispatcher)
    if (req.user && ['ptgAdmin', 'ptgDispatcher'].includes(req.user.role)) {
      try {
        const users = await User.find({
          $or: [
            { firstName: { $regex: searchTerm, $options: 'i' } },
            { lastName: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
            { phoneNumber: { $regex: searchTerm, $options: 'i' } }
          ]
        })
        .limit(searchLimit)
        .select('_id firstName lastName email phoneNumber role city state')
        .sort({ createdAt: -1 });

        users.forEach(user => {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

          results.push({
            id: user._id,
            type: 'user',
            title: fullName,
            subtitle: user.email,
            description: `${user.role} • ${user.city && user.state ? `${user.city}, ${user.state}` : 'Location not set'}`,
            status: user.emailVerified ? 'Verified' : 'Not Verified',
            statusColor: user.emailVerified ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50',
            route: `/users/${user._id}`
          });
        });
      } catch (error) {
        console.error('User search error:', error);
      }
    }

    // Sort results by relevance (vehicles first, then trucks, jobs, users)
    const typeOrder = { vehicle: 0, truck: 1, transportJob: 2, user: 3 };
    results.sort((a, b) => {
      const typeDiff = typeOrder[a.type] - typeOrder[b.type];
      if (typeDiff !== 0) return typeDiff;
      return 0; // Keep original order within same type
    });

    // Limit total results
    const limitedResults = results.slice(0, searchLimit);

    res.json({
      success: true,
      data: limitedResults,
      total: limitedResults.length
    });

  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
};

// Helper function to get status colors
function getStatusColor(type, status) {
  switch (type) {
    case 'vehicle':
      switch (status) {
        case 'Intake Completed': return 'text-gray-600 bg-gray-50';
        case 'In Transport': return 'text-blue-600 bg-blue-50';
        case 'Delivered': return 'text-green-600 bg-green-50';
        case 'Cancelled': return 'text-red-600 bg-red-50';
        default: return 'text-gray-600 bg-gray-50';
      }
    case 'truck':
      switch (status) {
        case 'Available': return 'text-green-600 bg-green-50';
        case 'In Use': return 'text-blue-600 bg-blue-50';
        case 'Maintenance': return 'text-yellow-600 bg-yellow-50';
        case 'Out of Service': return 'text-red-600 bg-red-50';
        default: return 'text-gray-600 bg-gray-50';
      }
    case 'transportJob':
      switch (status) {
        case 'Pending': return 'text-yellow-600 bg-yellow-50';
        case 'In Progress': return 'text-blue-600 bg-blue-50';
        case 'Completed': return 'text-green-600 bg-green-50';
        case 'Cancelled': return 'text-red-600 bg-red-50';
        default: return 'text-gray-600 bg-gray-50';
      }
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

// Helper function to format dates
function formatDate(date) {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'N/A';
  }
}

module.exports = {
  globalSearch
};
