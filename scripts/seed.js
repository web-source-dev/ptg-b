/**
 * Database Seed Script
 * 
 * This script populates the database with sample data for testing and development.
 * Run with: node scripts/seed.js
 * 
 * To clear existing data first, run: node scripts/seed.js --clear
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// Import models
const User = require('../models/User');
const Truck = require('../models/Truck');
const Vehicle = require('../models/Vehicle');
const TransportJob = require('../models/TransportJob');

// Import status constants
const {
  TRANSPORT_JOB_STATUS,
  TRUCK_STATUS,
  VEHICLE_STATUS,
  TRUCK_CAPACITY,
  CARRIER
} = require('../constants/status');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

// Clear all collections
const clearDatabase = async () => {
  try {
    console.log('🗑️  Clearing database...');
    await TransportJob.deleteMany({});
    await Vehicle.deleteMany({});
    await Truck.deleteMany({});
    await User.deleteMany({});
    console.log('✅ Database cleared');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
};

// Create sample users
const createUsers = async () => {
  try {
    console.log('👥 Creating users...');
    
    const hashedPassword = await bcrypt.hash('Password123!', 12);
    
    const users = [
      {
        email: 'admin@ptg.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Admin',
        phoneNumber: '555-0101',
        role: 'ptgAdmin',
        emailVerified: true
      },
      {
        email: 'dispatcher@ptg.com',
        password: hashedPassword,
        firstName: 'Jane',
        lastName: 'Dispatcher',
        phoneNumber: '555-0102',
        role: 'ptgDispatcher',
        emailVerified: true
      },
      {
        email: 'driver1@ptg.com',
        password: hashedPassword,
        firstName: 'Mike',
        lastName: 'Driver',
        phoneNumber: '555-0201',
        role: 'ptgDriver',
        emailVerified: true
      },
      {
        email: 'driver2@ptg.com',
        password: hashedPassword,
        firstName: 'Sarah',
        lastName: 'Driver',
        phoneNumber: '555-0202',
        role: 'ptgDriver',
        emailVerified: true
      },
      {
        email: 'driver3@ptg.com',
        password: hashedPassword,
        firstName: 'Tom',
        lastName: 'Driver',
        phoneNumber: '555-0203',
        role: 'ptgDriver',
        emailVerified: true
      }
    ];

    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users`);
    return createdUsers;
  } catch (error) {
    console.error('❌ Error creating users:', error);
    throw error;
  }
};

// Create sample trucks
const createTrucks = async () => {
  try {
    console.log('🚛 Creating trucks...');
    
    const trucks = [
      {
        truckNumber: 'TRK-001',
        licensePlate: 'ABC-123',
        make: 'Freightliner',
        model: 'Cascadia',
        year: 2022,
        capacity: TRUCK_CAPACITY.DOUBLE,
        status: TRUCK_STATUS.AVAILABLE
      },
      {
        truckNumber: 'TRK-002',
        licensePlate: 'DEF-456',
        make: 'Peterbilt',
        model: '579',
        year: 2021,
        capacity: TRUCK_CAPACITY.SINGLE,
        status: TRUCK_STATUS.AVAILABLE
      },
      {
        truckNumber: 'TRK-003',
        licensePlate: 'GHI-789',
        make: 'Kenworth',
        model: 'T680',
        year: 2023,
        capacity: TRUCK_CAPACITY.DOUBLE,
        status: TRUCK_STATUS.AVAILABLE
      },
      {
        truckNumber: 'TRK-004',
        licensePlate: 'JKL-012',
        make: 'Volvo',
        model: 'VNL',
        year: 2022,
        capacity: TRUCK_CAPACITY.TRIPLE,
        status: TRUCK_STATUS.AVAILABLE
      }
    ];

    const createdTrucks = await Truck.insertMany(trucks);
    console.log(`✅ Created ${createdTrucks.length} trucks`);
    return createdTrucks;
  } catch (error) {
    console.error('❌ Error creating trucks:', error);
    throw error;
  }
};

// Create sample vehicles
const createVehicles = async () => {
  try {
    console.log('🚗 Creating vehicles...');
    
    const vehicles = [
      {
        vin: '1HGBH41JXMN109186',
        year: 2020,
        make: 'Toyota',
        model: 'Camry',
        color: 'Silver',
        mileage: 35000,
        pickupCity: 'Dallas',
        pickupState: 'TX',
        pickupZip: '75201',
        dropCity: 'Phoenix',
        dropState: 'AZ',
        dropZip: '85001',
        status: VEHICLE_STATUS.INTAKE_COMPLETE
      },
      {
        vin: '2HGFC2F59MH543210',
        year: 2021,
        make: 'Honda',
        model: 'Accord',
        color: 'Black',
        mileage: 25000,
        pickupCity: 'Houston',
        pickupState: 'TX',
        pickupZip: '77001',
        dropCity: 'Los Angeles',
        dropState: 'CA',
        dropZip: '90001',
        status: VEHICLE_STATUS.INTAKE_COMPLETE
      },
      {
        vin: '3VW2B7AJ5HM123456',
        year: 2019,
        make: 'Ford',
        model: 'F-150',
        color: 'Red',
        mileage: 45000,
        pickupCity: 'Atlanta',
        pickupState: 'GA',
        pickupZip: '30301',
        dropCity: 'Miami',
        dropState: 'FL',
        dropZip: '33101',
        status: VEHICLE_STATUS.INTAKE_COMPLETE
      },
      {
        vin: '4T1BF1FK5EU234567',
        year: 2022,
        make: 'Tesla',
        model: 'Model 3',
        color: 'White',
        mileage: 15000,
        pickupCity: 'Chicago',
        pickupState: 'IL',
        pickupZip: '60601',
        dropCity: 'Denver',
        dropState: 'CO',
        dropZip: '80201',
        status: VEHICLE_STATUS.INTAKE_COMPLETE
      },
      {
        vin: '5YJ3E1EA1KF345678',
        year: 2020,
        make: 'Chevrolet',
        model: 'Silverado',
        color: 'Blue',
        mileage: 40000,
        pickupCity: 'Seattle',
        pickupState: 'WA',
        pickupZip: '98101',
        dropCity: 'Portland',
        dropState: 'OR',
        dropZip: '97201',
        status: VEHICLE_STATUS.INTAKE_COMPLETE
      },
      {
        vin: '6G1ZE5H30EU456789',
        year: 2021,
        make: 'BMW',
        model: '3 Series',
        color: 'Gray',
        mileage: 20000,
        pickupCity: 'Boston',
        pickupState: 'MA',
        pickupZip: '02101',
        dropCity: 'New York',
        dropState: 'NY',
        dropZip: '10001',
        status: VEHICLE_STATUS.INTAKE_COMPLETE
      },
      {
        vin: '7G1ZE5H30EU567890',
        year: 2018,
        make: 'Mercedes-Benz',
        model: 'C-Class',
        color: 'Silver',
        mileage: 50000,
        pickupCity: 'Nashville',
        pickupState: 'TN',
        pickupZip: '37201',
        dropCity: 'Charlotte',
        dropState: 'NC',
        dropZip: '28201',
        status: VEHICLE_STATUS.INTAKE_COMPLETE
      }
    ];

    const createdVehicles = await Vehicle.insertMany(vehicles);
    console.log(`✅ Created ${createdVehicles.length} vehicles`);
    return createdVehicles;
  } catch (error) {
    console.error('❌ Error creating vehicles:', error);
    throw error;
  }
};

// Create sample transport jobs
const createTransportJobs = async (vehicles) => {
  try {
    console.log('📦 Creating transport jobs...');
    
    const admin = await User.findOne({ role: 'ptgAdmin' });
    const drivers = await User.find({ role: 'ptgDriver' });
    const trucks = await Truck.find({ status: TRUCK_STATUS.AVAILABLE });
    
    const now = new Date();
    
    const jobs = [
      {
        vehicleId: vehicles[0]._id,
        status: TRANSPORT_JOB_STATUS.PENDING,
        carrier: CARRIER.PTG,
        driverId: drivers[0]._id,
        truckId: trucks[0]._id,
        plannedPickupDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        plannedDeliveryDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        carrierPayment: 1200,
        createdBy: admin?._id
      },
      {
        vehicleId: vehicles[1]._id,
        status: TRANSPORT_JOB_STATUS.PENDING,
        carrier: CARRIER.PTG,
        driverId: drivers[0]._id,
        truckId: trucks[0]._id,
        plannedPickupDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        plannedDropDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        carrierPayment: 1500,
        createdBy: admin?._id
      },
      {
        vehicleId: vehicles[2]._id,
        status: TRANSPORT_JOB_STATUS.IN_PROGRESS,
        carrier: CARRIER.PTG,
        driverId: drivers[1]._id,
        truckId: trucks[2]._id,
        plannedPickupDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        plannedDropDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        carrierPayment: 1800,
        createdBy: admin?._id
      },
      {
        vehicleId: vehicles[3]._id,
        status: TRANSPORT_JOB_STATUS.IN_PROGRESS,
        carrier: CARRIER.PTG,
        driverId: drivers[1]._id,
        truckId: trucks[2]._id,
        plannedPickupDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        plannedDropDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        carrierPayment: 2000,
        createdBy: admin?._id
      },
      {
        vehicleId: vehicles[4]._id,
        status: TRANSPORT_JOB_STATUS.IN_PROGRESS,
        carrier: CARRIER.PTG,
        driverId: drivers[0]._id,
        truckId: trucks[1]._id,
        plannedPickupDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        plannedDropDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        carrierPayment: 1600,
        createdBy: admin?._id
      },
      {
        vehicleId: vehicles[5]._id,
        status: TRANSPORT_JOB_STATUS.PENDING,
        carrier: CARRIER.PTG,
        driverId: drivers[2]._id,
        truckId: trucks[3]._id,
        plannedPickupDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
        plannedDropDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
        carrierPayment: 1400,
        createdBy: admin?._id
      },
      {
        vehicleId: vehicles[6]._id,
        status: TRANSPORT_JOB_STATUS.PENDING,
        carrier: CARRIER.PTG,
        driverId: drivers[0]._id,
        truckId: trucks[0]._id,
        plannedPickupDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        plannedDropDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        carrierPayment: 1300,
        createdBy: admin?._id
      }
    ];

    const createdJobs = await TransportJob.insertMany(jobs);
    console.log(`✅ Created ${createdJobs.length} transport jobs`);
    
    // Update vehicle transportJobId references
    for (let i = 0; i < createdJobs.length; i++) {
      await Vehicle.findByIdAndUpdate(vehicles[i]._id, {
        transportJobId: createdJobs[i]._id
      });
    }
    
    // Update truck statuses for assigned trucks
    const assignedTruckIds = [...new Set(jobs.map(j => j.truckId?.toString()).filter(Boolean))];
    for (const truckId of assignedTruckIds) {
      await Truck.findByIdAndUpdate(truckId, {
        status: TRUCK_STATUS.IN_USE
      });
    }
    
    return createdJobs;
  } catch (error) {
    console.error('❌ Error creating transport jobs:', error);
    throw error;
  }
};

// Create sample routes - DEPRECATED: Routes are no longer used
// Transport jobs are now directly assigned to drivers and trucks
const createRoutes = async (users, trucks, transportJobs) => {
  try {
    console.log('✅ Routes removed - transport jobs are now directly assigned to drivers and trucks');
    
    // Routes are no longer used - transport jobs are directly assigned to drivers and trucks
    return [];
  } catch (error) {
    console.error('❌ Error creating routes:', error);
    throw error;
  }
};

// Main seed function
const seedDatabase = async () => {
  try {
    const shouldClear = process.argv.includes('--clear');
    
    if (shouldClear) {
      await clearDatabase();
    }

    console.log('🌱 Starting database seed...\n');

    // Create data in order (respecting dependencies)
    const users = await createUsers();
    const trucks = await createTrucks();
    const vehicles = await createVehicles();
    const transportJobs = await createTransportJobs(vehicles);
    // Routes are no longer used - transport jobs are directly assigned to drivers and trucks
    // const routes = await createRoutes(users, trucks, transportJobs);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Trucks: ${trucks.length}`);
    console.log(`   - Vehicles: ${vehicles.length}`);
    console.log(`   - Transport Jobs: ${transportJobs.length}`);
    console.log('\n🔑 Login Credentials:');
    console.log('   Admin: admin@ptg.com / Password123!');
    console.log('   Dispatcher: dispatcher@ptg.com / Password123!');
    console.log('   Driver 1: driver1@ptg.com / Password123!');
    console.log('   Driver 2: driver2@ptg.com / Password123!');
    console.log('   Driver 3: driver3@ptg.com / Password123!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run seed if called directly
if (require.main === module) {
  connectDB().then(() => {
    seedDatabase();
  });
}

module.exports = { seedDatabase, clearDatabase };
