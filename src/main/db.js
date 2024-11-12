const path = require('path');
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: path.join('C:/Users/Purdu/Desktop', 'devices.db'), // Path to the local SQLite database file
  },
  useNullAsDefault: true,
});

// Log the database path for debugging
console.log('Database path:', path.join(__dirname, 'devices.db'));

// Create the 'devices' table if it doesn't exist
knex.schema.hasTable('devices').then((exists) => {
  if (!exists) {
    return knex.schema.createTable('devices', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('icon').notNullable(); // Store the icon selection for each device
      table.string('imagePath').notNullable(); // Store path to the ZIP file
      table.timestamp('created_at').defaultTo(knex.fn.now()); // Record creation timestamp
    });
  }
}).then(() => {
  console.log('Database setup complete.'); // Success message for setup completion
}).catch((error) => {
  console.error('Error setting up database:', error); // Enhanced error message for debugging
});

// Create the 'device_locations' table if it doesn't exist
knex.schema.hasTable('device_locations').then((exists) => {
  if (!exists) {
    return knex.schema.createTable('device_locations', (table) => {
      table.increments('id').primary();
      table.integer('deviceId').unsigned().notNullable().references('id').inTable('devices').onDelete('CASCADE');
      table.float('latitude').notNullable();
      table.float('longitude').notNullable();
      table.float('speed').nullable(); // Allow null if speed data is unavailable
      table.float('verticalAccuracy').nullable(); // Allow null if vertical accuracy data is unavailable
      table.float('horizontalAccuracy').nullable(); // Allow null if horizontal accuracy data is unavailable
      table.timestamp('timestamp').notNullable();
    });
  }
}).then(() => {
  console.log('Device locations table setup complete.');
}).catch((error) => {
  console.error('Error setting up device locations table:', error);
});

module.exports = knex;
