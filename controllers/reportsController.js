const TransportJob = require('../models/TransportJob');
const Vehicle = require('../models/Vehicle');
const Truck = require('../models/Truck');
const User = require('../models/User');

/**
 * Get transport job report with statistics
 */
exports.getTransportJobReport = async (req, res) => {
  try {
    const { startDate, endDate, driverId, truckId, status, carrier } = req.query;

    // Build query
    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    if (driverId) matchQuery.driverId = driverId;
    if (truckId) matchQuery.truckId = truckId;
    if (status) matchQuery.status = status;
    if (carrier) matchQuery.carrier = carrier;

    // Aggregate transport job statistics
    const jobStats = await TransportJob.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          completedJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          },
          inProgressJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
          },
          pendingJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
          },
          cancelledJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
          },
          totalRevenue: { $sum: { $ifNull: ['$carrierPayment', 0] } }
        }
      }
    ]);

    const stats = jobStats[0] || {
      totalJobs: 0,
      completedJobs: 0,
      inProgressJobs: 0,
      pendingJobs: 0,
      cancelledJobs: 0,
      totalRevenue: 0
    };

    stats.averageRevenue = stats.totalJobs > 0 ? stats.totalRevenue / stats.totalJobs : 0;

    // Jobs by carrier
    const jobsByCarrier = await TransportJob.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$carrier',
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$carrierPayment', 0] } }
        }
      },
      {
        $project: {
          carrier: '$_id',
          count: 1,
          revenue: 1,
          _id: 0
        }
      }
    ]);

    // Jobs by status
    const jobsByStatus = await TransportJob.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Jobs by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const jobsByDate = await TransportJob.aggregate([
      {
        $match: {
          ...matchQuery,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$carrierPayment', 0] } }
        }
      },
      {
        $project: {
          date: '$_id',
          count: 1,
          revenue: 1,
          _id: 0
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Recent jobs (last 10)
    const recentJobs = await TransportJob.find(matchQuery)
      .populate('vehicleId', 'vin make model year')
      .populate('driverId', 'firstName lastName email')
      .populate('truckId', 'truckNumber licensePlate')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('jobNumber status carrier plannedPickupDate plannedDeliveryDate carrierPayment createdAt');

    res.status(200).json({
      success: true,
      data: {
        ...stats,
        jobsByCarrier,
        jobsByStatus,
        jobsByDate,
        recentJobs
      }
    });
  } catch (error) {
    console.error('Error generating transport job report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate transport job report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get driver performance report
 */
exports.getDriverReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all drivers
    const drivers = await User.find({ role: 'ptgDriver' }).select('_id firstName lastName email');

    // Get driver statistics
    const driverStats = await TransportJob.aggregate([
      { $match: { driverId: { $exists: true }, ...dateFilter } },
      {
        $group: {
          _id: '$driverId',
          totalJobs: { $sum: 1 },
          completedJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          },
          totalRevenue: { $sum: { $ifNull: ['$carrierPayment', 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'driver'
        }
      },
      {
        $unwind: '$driver'
      },
      {
        $project: {
          driverId: '$_id',
          driverName: {
            $concat: ['$driver.firstName', ' ', '$driver.lastName']
          },
          totalJobs: 1,
          completedJobs: 1,
          totalRevenue: 1,
          _id: 0
        }
      }
    ]);

    const totalDrivers = drivers.length;
    const activeDrivers = driverStats.length;
    const totalJobs = driverStats.reduce((sum, driver) => sum + driver.totalJobs, 0);
    const completedJobs = driverStats.reduce((sum, driver) => sum + driver.completedJobs, 0);
    const totalRevenue = driverStats.reduce((sum, driver) => sum + driver.totalRevenue, 0);

    res.status(200).json({
      success: true,
      data: {
        totalDrivers,
        activeDrivers,
        totalJobs,
        completedJobs,
        totalRevenue,
        driverStats
      }
    });
  } catch (error) {
    console.error('Error generating driver report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate driver report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get truck utilization report
 */
exports.getTruckReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all trucks
    const trucks = await Truck.find({}).select('_id truckNumber licensePlate status');

    // Get truck statistics
    const truckStats = await TransportJob.aggregate([
      { $match: { truckId: { $exists: true }, ...dateFilter } },
      {
        $group: {
          _id: '$truckId',
          totalJobs: { $sum: 1 },
          completedJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          },
          totalRevenue: { $sum: { $ifNull: ['$carrierPayment', 0] } }
        }
      },
      {
        $lookup: {
          from: 'trucks',
          localField: '_id',
          foreignField: '_id',
          as: 'truck'
        }
      },
      {
        $unwind: '$truck'
      },
      {
        $project: {
          truckId: '$_id',
          truckNumber: '$truck.truckNumber',
          totalJobs: 1,
          completedJobs: 1,
          totalRevenue: 1,
          _id: 0
        }
      }
    ]);

    // Calculate utilization (completed jobs / total jobs as percentage) and ensure totalRevenue is a number
    truckStats.forEach(stat => {
      stat.utilization = stat.totalJobs > 0 ? (stat.completedJobs / stat.totalJobs) * 100 : 0;
      stat.totalRevenue = Number(stat.totalRevenue) || 0;
    });

    const totalTrucks = trucks.length;
    const availableTrucks = trucks.filter(truck => truck.status === 'Available').length;
    const inUseTrucks = trucks.filter(truck => truck.status === 'In Use').length;
    const maintenanceTrucks = trucks.filter(truck => truck.status === 'Maintenance').length;
    const totalJobs = truckStats.reduce((sum, truck) => sum + truck.totalJobs, 0);
    const completedJobs = truckStats.reduce((sum, truck) => sum + truck.completedJobs, 0);

    res.status(200).json({
      success: true,
      data: {
        totalTrucks,
        availableTrucks,
        inUseTrucks,
        maintenanceTrucks,
        totalJobs,
        completedJobs,
        truckStats
      }
    });
  } catch (error) {
    console.error('Error generating truck report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate truck report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get financial report
 */
exports.getFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate, carrier } = req.query;

    // Build query
    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    if (carrier) matchQuery.carrier = carrier;

    // Revenue by carrier
    const revenueByCarrier = await TransportJob.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$carrier',
          revenue: { $sum: { $ifNull: ['$carrierPayment', 0] } },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          carrier: '$_id',
          revenue: 1,
          count: 1,
          _id: 0
        }
      }
    ]);

    // Revenue by month (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const revenueByMonth = await TransportJob.aggregate([
      {
        $match: {
          ...matchQuery,
          createdAt: { $gte: oneYearAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: { $ifNull: ['$carrierPayment', 0] } },
          jobs: { $sum: 1 }
        }
      },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            ]
          },
          revenue: 1,
          jobs: 1,
          _id: 0
        }
      },
      { $sort: { month: 1 } }
    ]);

    const totalRevenue = revenueByCarrier.reduce((sum, item) => sum + item.revenue, 0);

    // For now, assume all payments are made (outstanding = 0)
    // In a real system, you'd track payment status
    const outstandingPayments = 0;
    const totalCarrierPayments = totalRevenue; // Assuming all revenue comes from carrier payments
    const netProfit = totalRevenue; // Simplified - in reality, subtract costs

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalCarrierPayments,
        netProfit,
        revenueByCarrier,
        revenueByMonth,
        outstandingPayments
      }
    });
  } catch (error) {
    console.error('Error generating financial report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate financial report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get dashboard statistics (combination of all reports)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get basic counts
    const [
      transportJobCount,
      vehicleCount,
      truckCount,
      driverCount,
      completedJobsCount,
      totalRevenue
    ] = await Promise.all([
      TransportJob.countDocuments(dateFilter),
      Vehicle.countDocuments(dateFilter),
      Truck.countDocuments(),
      User.countDocuments({ role: 'ptgDriver' }),
      TransportJob.countDocuments({ status: 'Completed', ...dateFilter }),
      TransportJob.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$carrierPayment', 0] } } } }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Get recent activity
    const recentJobs = await TransportJob.find(dateFilter)
      .populate('vehicleId', 'vin make model')
      .populate('driverId', 'firstName lastName')
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('jobNumber status carrier updatedAt vehicleId driverId');

    // Get status breakdown
    const statusBreakdown = await TransportJob.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalTransportJobs: transportJobCount,
          totalVehicles: vehicleCount,
          totalTrucks: truckCount,
          totalDrivers: driverCount,
          completedJobs: completedJobsCount,
          totalRevenue: totalRevenue,
          activeJobs: transportJobCount - completedJobsCount
        },
        recentActivity: recentJobs,
        statusBreakdown: statusBreakdown.map(item => ({
          status: item._id,
          count: item.count
        }))
      }
    });
  } catch (error) {
    console.error('Error generating dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate dashboard stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
