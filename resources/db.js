const path = require('path')
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: path.join('C:/Users/akifo/Desktop', 'devices.db') // Path to the local SQLite database file
  },
  useNullAsDefault: true
})

// Log the database path for debugging
console.log('Database path:', path.join(__dirname, 'devices.db'))

// Create the 'devices' table if it doesn't exist
knex.schema
  .hasTable('devices')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('devices', (table) => {
        table.increments('id').primary()
        table.string('name').notNullable()
        table.string('imagePath').notNullable() // Store path to the ZIP file
        table.timestamp('created_at').defaultTo(knex.fn.now()) // Record creation timestamp
      })
    }
  })
  .then(() => {
    console.log('Database setup complete.')
  })
  .catch((error) => {
    console.error('Error setting up database:', error)
  })

// Create the 'device_locations' table if it doesn't exist
knex.schema
  .hasTable('device_locations')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('device_locations', (table) => {
        table.increments('id').primary()
        table
          .integer('deviceId')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('devices')
          .onDelete('CASCADE')
        table.float('latitude').notNullable()
        table.float('longitude').notNullable()
        table.float('speed').nullable()
        table.float('verticalAccuracy').nullable()
        table.float('horizontalAccuracy').nullable()
        table.timestamp('timestamp').notNullable()
      })
    }
  })
  .then(() => {
    console.log('Device locations table setup complete.')
  })
  .catch((error) => {
    console.error('Error setting up device locations table:', error)
  })

// Create the 'application_data' table if it doesn't exist
knex.schema
  .hasTable('application_data')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('application_data', (table) => {
        table.increments('id').primary()
        table
          .integer('deviceId')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('devices')
          .onDelete('CASCADE')
        table.timestamp('startTime').notNullable() // Start time of the focus/usage
        table.timestamp('endTime').notNullable() // End time of the focus/usage
        table.string('bundleIdentifier').notNullable() // App bundle identifier
        table.integer('duration').notNullable() // Duration of the focus/usage
        table.string('type').notNullable() // Either 'focus' or 'usage'
      })
    }
  })
  .then(() => {
    console.log('Application data table setup complete.')
  })
  .catch((error) => {
    console.error('Error setting up application data table:', error)
  })

// Create the 'ktx_files' table if it doesn't exist
knex.schema
  .hasTable('ktx_files')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('ktx_files', (table) => {
        table.increments('id').primary()
        table
          .integer('deviceId')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('devices')
          .onDelete('CASCADE')
        table.string('filename').notNullable() // Name of the .ktx file
        table.string('filepath').notNullable() // Full path to the .ktx file
        table.timestamp('timestamp').notNullable() // Original timestamp of the file
      })
    }
  })
  .then(() => {
    console.log('KTX files table setup complete.')
  })
  .catch((error) => {
    console.error('Error setting up KTX files table:', error)
  })

module.exports = knex
