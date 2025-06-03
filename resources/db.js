const { app } = require('electron');

const path = require('path')

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: path.join(app.getPath('userData'), 'devices.db') // Path to the local SQLite database file
  },
  useNullAsDefault: true
})

// Log the database path for debugging
console.log('Database path:', path.join(app.getPath('userData'), 'devices.db'))

knex.raw('PRAGMA foreign_keys = ON')

// Create the 'devices' table
knex.schema
  .hasTable('devices')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('devices', (table) => {
        table.increments('id').primary()
        table.integer('caseId').unsigned()
        table.string('name').notNullable()
        table.string('imagePath') // Store path to the ZIP file (can be null now)
        table.text('imagePaths') // Store JSON string of multiple paths
        table.timestamp('created_at').defaultTo(knex.fn.now()) // Record creation timestamp
      })
    } else {
      // Check if the imagePaths column exists, and add it if it doesn't
      return knex.schema.hasColumn('devices', 'imagePaths').then((hasColumn) => {
        if (!hasColumn) {
          return knex.schema.table('devices', (table) => {
            table.text('imagePaths')
          });
        }
      });
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

// Create the 'cases' table if it doesn't exist
knex.schema
  .hasTable('cases')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('cases', (table) => {
        table.increments('id').primary() // Primary key
        table.string('name').notNullable() // Name of the case
        table.text('description').nullable() // Description of the case
        table.timestamp('createdAt').defaultTo(knex.fn.now()) // Timestamp for when the case was created
      })
    }
  })
  .then(() => {
    console.log('Cases table setup complete.')
  })
  .catch((error) => {
    console.error('Error setting up cases table:', error)
  })

// Create the 'wifi_locations' table if it doesn't exist
knex.schema
  .hasTable('wifi_locations')
  .then((exists) => {
    if (!exists) {
      return knex.schema.createTable('wifi_locations', (table) => {
        table.increments('id').primary() // Auto-increment primary key

        table
          .integer('deviceId')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('devices')
          .onDelete('CASCADE')

        table.bigInteger('mac').notNullable()
        table.integer('channel').nullable()
        table.integer('infoMask').nullable()
        table.float('timestamp').notNullable()
        table.float('latitude').notNullable()
        table.float('longitude').notNullable()
        table.float('horizontalAccuracy').nullable()
        table.float('altitude').nullable()
        table.float('verticalAccuracy').nullable()
        table.float('speed').nullable()
        table.float('course').nullable()
        table.integer('confidence').nullable()
        table.integer('score').nullable()
        table.integer('reach').nullable()
        table.integer('fenceForeignKey').nullable()
        table.integer('zaxisHarvestTraces').nullable()
      })
    }
  })
  .then(() => {
    console.log('WiFi locations table setup complete.')
  })
  .catch((error) => {
    console.error('Error setting up wifi_locations table:', error)
  })

module.exports = knex
