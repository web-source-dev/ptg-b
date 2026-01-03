/**
 * Default Checklist Items for Transport Jobs
 * 
 * Provides default checklist items for pickup and drop operations
 */

/**
 * Get default checklist items for pickup
 * @returns {Array} Array of checklist items
 */
const getDefaultPickupChecklist = () => {
  return [
    { item: 'Verify vehicle VIN matches paperwork', checked: false },
    { item: 'Inspect vehicle for existing damage', checked: false },
    { item: 'Take vehicle condition photos', checked: false },
    { item: 'Collect all required paperwork', checked: false },
    { item: 'Verify pickup location matches order', checked: false },
    { item: 'Confirm contact person and obtain signature', checked: false },
    { item: 'Secure vehicle on truck properly', checked: false },
    { item: 'Complete Bill of Lading', checked: false }
  ];
};

/**
 * Get default checklist items for drop/delivery
 * @returns {Array} Array of checklist items
 */
const getDefaultDropChecklist = () => {
  return [
    { item: 'Verify delivery location matches order', checked: false },
    { item: 'Inspect vehicle for damage during transport', checked: false },
    { item: 'Take delivery condition photos', checked: false },
    { item: 'Obtain delivery confirmation signature', checked: false },
    { item: 'Complete delivery paperwork', checked: false },
    { item: 'Unload vehicle safely', checked: false },
    { item: 'Verify contact person identity', checked: false },
    { item: 'Confirm all paperwork is complete', checked: false }
  ];
};

module.exports = {
  getDefaultPickupChecklist,
  getDefaultDropChecklist
};

