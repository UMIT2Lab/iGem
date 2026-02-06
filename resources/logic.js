const fs = require('fs')
const sqlite3 = require('sqlite3')
const { execFile } = require('child_process')
const yauzl = require('yauzl')
const path = require('path')

const { ipcMain } = require('electron')
const knex = require('./db')

const IOS_TO_UNIX_EPOCH_OFFSET = 978307200 // Difference in seconds between iOS epoch and Unix epoch

// Define the path to the Python script
const pythonScriptPath = './src/main/ios_ktx2png.py'
const pythonExecutable = 'python' // Adjust if using 'python3' on your system
const exePath = path.join(__dirname, 'ios_ktx2png.exe')
console.log(exePath)

ipcMain.handle('convert-ktx-to-png', async (event, ktxFilePath) => {
  console.log(exePath)
  return new Promise((resolve, reject) => {
    execFile(exePath, [ktxFilePath], (error, stdout, stderr) => {
      if (error) {
        console.error('Error converting .ktx to .png:', stderr)
        return reject(stderr)
      }
      const outputPngPath = ktxFilePath + '.png'
      const imageBuffer = fs.readFileSync(outputPngPath)
      const base64Image = imageBuffer.toString('base64')
      console.log(base64Image)
      resolve(`data:image/png;base64,${base64Image}`)
    })
  })
})

ipcMain.handle('extract-knowledge-db', async (event, zipFilePath, extractDir, deviceId) => {
  try {
    const targetFilePathInZip = /.*\/private\/var\/mobile\/Library\/CoreDuet\/Knowledge\/knowledgeC\.db/;
    
    // Get the device to access all image paths
    const device = await knex('devices').where('id', deviceId.id).first();
    let imagePaths = [];
    
    // Parse the stored imagePaths if available
    if (device.imagePaths) {
      try {
        imagePaths = JSON.parse(device.imagePaths);
      } catch (e) {
        console.error('Error parsing imagePaths:', e);
        if (device.imagePath) {
          imagePaths = [device.imagePath];
        }
      }
    } else if (device.imagePath) {
      imagePaths = [device.imagePath];
    }
    
    // If zipFilePath is provided directly, prioritize that
    if (zipFilePath && !imagePaths.includes(zipFilePath)) {
      imagePaths.unshift(zipFilePath);
    }
    
    if (imagePaths.length === 0) {
      throw new Error('No image paths found for processing');
    }

    // Create the extraction directory if it doesn't exist
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    // Try each zip file until we find the target files
    let extractedDbPath = null;
    let successfulZipPath = null;
    
    for (const zipPath of imagePaths) {
      try {
        console.log(`Trying to extract knowledge DB from: ${zipPath}`);
        extractedDbPath = await extractFileFromZip(zipPath, targetFilePathInZip, extractDir);
        successfulZipPath = zipPath;
        console.log(`Successfully extracted knowledge DB from: ${zipPath}`);
        break; // Exit the loop if extraction is successful
      } catch (zipError) {
        console.log(`Could not extract knowledge DB from ${zipPath}: ${zipError.message}`);
        // Continue to the next zip file
      }
    }
    
    if (!extractedDbPath) {
      throw new Error('Could not find the knowledge database in any of the provided zip files');
    }

    // Open the extracted SQLite database
    const cacheDb = new sqlite3.Database(extractedDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) throw new Error(`Could not open knowledgeC.db: ${err.message}`);
    });

    const focusQuery = `
SELECT
  ZOBJECT.ZSTARTDATE AS "Start Time",
  ZOBJECT.ZENDDATE AS "End Time",
  ZOBJECT.ZVALUESTRING AS "Bundle Identifier",
  ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE AS "Focus Duration (Seconds)"
FROM
  ZOBJECT
WHERE
  ZOBJECT.ZSTREAMNAME = "/app/inFocus"
ORDER BY
  ZOBJECT.ZSTARTDATE DESC;
`

    const usageQuery = `
SELECT
  ZOBJECT.ZSTARTDATE AS "Start Time",
  ZOBJECT.ZENDDATE AS "End Time",
  ZOBJECT.ZVALUESTRING AS "Bundle Identifier",
  ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE AS "Usage Duration (Seconds)"
FROM
  ZOBJECT
WHERE
  ZOBJECT.ZSTREAMNAME = "/app/usage"
ORDER BY
  ZOBJECT.ZSTARTDATE DESC;
`

    return new Promise((resolve, reject) => {
      const processQuery = (query, type) => {
        return new Promise((resolveQuery, rejectQuery) => {
          cacheDb.all(query, (err, rows) => {
            if (err) {
              console.error(`Error querying ZOBJECT for ${type}:`, err.message)
              return rejectQuery(err.message)
            }

            // Map rows to application_data format
            const appUsageData = rows.map((row) => ({
              deviceId: deviceId.id,
              bundleIdentifier: row['Bundle Identifier'],
              startTime: new Date((row['Start Time'] + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
              endTime: new Date((row['End Time'] + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
              duration:
                row[type === 'focus' ? 'Focus Duration (Seconds)' : 'Usage Duration (Seconds)'],
              type
            }))

            resolveQuery(appUsageData)
          })
        })
      }

      Promise.all([processQuery(focusQuery, 'focus'), processQuery(usageQuery, 'usage')])
        .then(async ([focusData, usageData]) => {
          const allData = [...focusData, ...usageData]

          // Insert in batches to avoid "too many terms in compound SELECT"
          const chunks = chunkArray(allData, 100) // Adjust the batch size as needed
          try {
            for (const chunk of chunks) {
              await knex('application_data').insert(chunk)
            }
            resolve({ success: true, message: 'Data successfully transferred to application_data' })
          } catch (insertError) {
            console.error('Error inserting into application_data:', insertError.message)
            reject({ success: false, error: insertError.message })
          } finally {
            cacheDb.close()
          }
        })
        .catch((queryError) => {
          console.error('Error processing queries:', queryError)
          cacheDb.close()
          reject({ success: false, error: queryError })
        })
    })
  } catch (error) {
    console.error('Error processing ZIP file:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})


ipcMain.handle('extract-wifi-locations', async (event, zipFilePath, extractDir, deviceId) => {
  try {
    const targetFilePathInZip = /.*\/private\/var\/root\/Library\/Caches\/locationd\/cache_encryptedB\.db/;

    const device = await knex('devices').where('id', deviceId.id).first();
    let imagePaths = [];

    if (device.imagePaths) {
      try {
        imagePaths = JSON.parse(device.imagePaths);
      } catch (e) {
        console.error('Error parsing imagePaths:', e);
        if (device.imagePath) {
          imagePaths = [device.imagePath];
        }
      }
    } else if (device.imagePath) {
      imagePaths = [device.imagePath];
    }

    if (zipFilePath && !imagePaths.includes(zipFilePath)) {
      imagePaths.unshift(zipFilePath);
    }

    if (imagePaths.length === 0) {
      throw new Error('No image paths found for processing');
    }

    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    let extractedDbPath = null;
    let successfulZipPath = null;

    for (const zipPath of imagePaths) {
      try {
        console.log(`Trying to extract WiFi DB from: ${zipPath}`);
        extractedDbPath = await extractFileFromZip(zipPath, targetFilePathInZip, extractDir);
        successfulZipPath = zipPath;
        console.log(`Successfully extracted WiFi DB from: ${zipPath}`);
        break;
      } catch (zipError) {
        console.log(`Could not extract WiFi DB from ${zipPath}: ${zipError.message}`);
      }
    }

    if (!extractedDbPath) {
      throw new Error('Could not find the cache_encryptedB.db in any of the provided zip files');
    }

    const wifiDb = new sqlite3.Database(extractedDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) throw new Error(`Could not open cache_encryptedB.db: ${err.message}`);
    });

    const query = `
      SELECT
        MAC, Channel, InfoMask, Timestamp, Latitude, Longitude,
        HorizontalAccuracy, Altitude, VerticalAccuracy, Speed,
        Course, Confidence, Score, Reach, FenceForeignKey
      FROM WifiLocation
    `;

    return new Promise((resolve, reject) => {
      wifiDb.all(query, async (err, rows) => {
        if (err) {
          console.error('Error querying WifiLocations:', err.message);
          wifiDb.close();
          return reject({ success: false, error: err.message });
        }

        console.log(`Found ${rows.length} WiFi location records`);
        console.log(rows[0])
        const wifiData = rows.map((row) => ({
          deviceId: deviceId.id,
          mac: row.MAC,
          channel: row.Channel,
          infoMask: row.InfoMask,
          timestamp: new Date((row.Timestamp + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
          latitude: row.Latitude,
          longitude: row.Longitude,
          horizontalAccuracy: row.HorizontalAccuracy,
          altitude: row.Altitude,
          verticalAccuracy: row.VerticalAccuracy,
          speed: row.Speed,
          course: row.Course,
          confidence: row.Confidence,
          score: row.Score,
          reach: row.Reach,
          fenceForeignKey: row.FenceForeignKey,
        }));

        const chunks = chunkArray(wifiData, 100);
        try {
          for (const chunk of chunks) {
            await knex('wifi_locations').insert(chunk);
          }
          resolve({ success: true, message: 'WiFi location data successfully inserted' });
        } catch (insertError) {
          console.error('Error inserting into wifi_locations:', insertError.message);
          reject({ success: false, error: insertError.message });
        } finally {
          wifiDb.close();
        }
      });
    });
  } catch (error) {
    console.error('Error processing WiFi DB extraction:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});


ipcMain.handle('get-ktx-files', async (event, deviceId) => {
  try {
    const ktxFiles = await knex('ktx_files')
      .where('deviceId', deviceId)
      .select('id', 'filename', 'filepath', 'timestamp')

    return { success: true, data: ktxFiles }
  } catch (error) {
    console.error('Error fetching KTX files:', error)
    return { success: false, error: error.message }
  }
})

// Convert wildcard pattern to a regular expression
const wildcardToRegex = (pattern) => {
  return new RegExp(
    '^' +
      pattern
        .replace(/\//g, '\\/') // Ensure slashes are interpreted correctly
        .replace(/\./g, '\\.') // Escape dots
        .replace(/\*/g, '.*') // Replace * with .*
        .replace(/\?/g, '.') + // Replace ? with .
      '$'
  )
}

const extractFilesAndSaveToDB = async (
  zipFilePath,
  extractDir,
  deviceId, // Pass deviceId to associate files with a device
  pattern
) => {
  const regexPattern = wildcardToRegex(pattern)
  const ktxFolder = path.join(extractDir, 'ktx_files')
  fs.mkdirSync(ktxFolder, { recursive: true }) // Ensure ktx_files folder exists

  return new Promise((resolve, reject) => {
    yauzl.open(zipFilePath, { decodeStrings: false, lazyEntries: true }, (err, zipFile) => {
      if (err) return reject(err)

      zipFile.readEntry()
      zipFile.on('entry', (entry) => {
        const decodedFileName = entry.fileName.toString("utf8");

        if (regexPattern.test(decodedFileName)) {
          const filename = path.basename(decodedFileName)
          const filepath = path.join(ktxFolder, filename)

          zipFile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err)

            const writeStream = fs.createWriteStream(filepath)
            readStream.pipe(writeStream)

            readStream.on('end', () => {
              // Get original timestamp and set it on the extracted file
              const originalTime = entry.getLastModDate()
              // Insert file details into the database
              knex('ktx_files')
                .insert({
                  deviceId: deviceId.id,
                  filename,
                  filepath,
                  timestamp: originalTime
                })
                .then(() => {
                  console.log(`Inserted ${filename} into ktx_files`)
                })
                .catch((dbError) => {
                  console.error('Error inserting into ktx_files:', dbError)
                })
              zipFile.readEntry()
            })

            writeStream.on('finish', () => console.log(`Extracted ${filename} to ${filepath}`))
          })
        } else {
          zipFile.readEntry() // Skip entries that don’t match the pattern
        }
      })

      zipFile.on('end', () => resolve())
      zipFile.on('error', reject)
    })
  })
}

ipcMain.handle('extract-matching-files', async (event, zipFilePath, extractDir, deviceId) => {
  console.log(extractDir);
  const matchingPathPattern =
    '*/private/var/mobile/Containers/Data/Application/*/Library/SplashBoard/Snapshots/*/*.ktx';
  
  try {
    // Get the device to access all image paths
    const device = await knex('devices').where('id', deviceId.id).first();
    let imagePaths = [];
    
    // Parse the stored imagePaths if available
    if (device.imagePaths) {
      try {
        imagePaths = JSON.parse(device.imagePaths);
      } catch (e) {
        console.error('Error parsing imagePaths:', e);
        if (device.imagePath) {
          imagePaths = [device.imagePath];
        }
      }
    } else if (device.imagePath) {
      imagePaths = [device.imagePath];
    }
    
    // If zipFilePath is provided directly, prioritize that
    if (zipFilePath && !imagePaths.includes(zipFilePath)) {
      imagePaths.unshift(zipFilePath);
    }
    
    if (imagePaths.length === 0) {
      throw new Error('No image paths found for processing');
    }
    
    // Try each zip file and extract matching files
    let successCount = 0;
    let errors = [];
    
    for (const zipPath of imagePaths) {
      try {
        console.log(`Extracting KTX files from: ${zipPath}`);
        await extractFilesAndSaveToDB(zipPath, extractDir, deviceId, matchingPathPattern);
        successCount++;
      } catch (zipError) {
        console.log(`Error extracting from ${zipPath}: ${zipError.message}`);
        errors.push(`${zipPath}: ${zipError.message}`);
      }
    }
    
    if (successCount > 0) {
      return { 
        success: true, 
        message: `Extracted KTX files from ${successCount} archives.`,
        errors: errors.length > 0 ? errors : undefined
      };
    } else {
      return { 
        success: false, 
        message: 'Failed to extract KTX files from any archive.',
        errors
      };
    }
  } catch (error) {
    console.error('Extraction or database insertion error:', error);
    return { success: false, message: error.message };
  }
});

// Handler to retrieve device locations from the database
ipcMain.handle('get-device-locations', async (event, deviceId) => {
  try {
    // Query locations based on deviceId
    const locations = await knex('device_locations')
      .select(
        'latitude',
        'longitude',
        'speed',
        'verticalAccuracy',
        'horizontalAccuracy',
        'timestamp'
      )
      .where({ deviceId })

    return { success: true, data: locations }
  } catch (error) {
    console.error('Error fetching device locations:', error)
    return { success: false, error: error.message }
  }
})

async function extractFileFromZip(zipFilePath, targetFilePathInZip, outputDir) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFilePath, { decodeStrings: false, lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err)

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        const decodedFileName = entry.fileName.toString("utf8");

        if (targetFilePathInZip.test(decodedFileName)) {
          const extractedFilePath = path.join(outputDir, path.basename(decodedFileName))
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err)

            const writeStream = fs.createWriteStream(extractedFilePath)
            readStream.pipe(writeStream)

            writeStream.on('finish', () => {
              zipfile.close()
              resolve(extractedFilePath) // Path of the extracted file
            })

            writeStream.on('error', (writeErr) => {
              zipfile.close()
              reject(writeErr)
            })
          })
        } else {
          zipfile.readEntry() // Skip other files
        }
      })

      zipfile.on('end', () => {
        reject(new Error(`File "${targetFilePathInZip}" not found in the ZIP archive.`))
      })

      zipfile.on('error', (zipErr) => {
        reject(zipErr)
      })
    })
  })
}

// Extract all files matching a pattern from ZIP in a single pass
async function extractMatchingFilesFromZip(zipFilePath, targetPattern, outputDir) {
  return new Promise((resolve, reject) => {
    const extractedFiles = []
    
    yauzl.open(zipFilePath, { decodeStrings: false, lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err)

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        const decodedFileName = entry.fileName.toString("utf8");
        
        if (targetPattern.test(decodedFileName)) {
          const extractedFilePath = path.join(outputDir, path.basename(decodedFileName))
          
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error('Error opening stream:', err)
              return zipfile.readEntry()
            }

            const writeStream = fs.createWriteStream(extractedFilePath)
            readStream.pipe(writeStream)

            writeStream.on('finish', () => {
              extractedFiles.push(extractedFilePath)
              zipfile.readEntry()
            })

            writeStream.on('error', (writeErr) => {
              console.error('Error writing file:', writeErr)
              zipfile.readEntry()
            })
          })
        } else {
          zipfile.readEntry() // Skip non-matching files
        }
      })

      zipfile.on('end', () => {
        zipfile.close()
        resolve(extractedFiles)
      })

      zipfile.on('error', (zipErr) => {
        reject(zipErr)
      })
    })
  })
}

function chunkArray(array, size) {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

ipcMain.handle('process-zip-file', async (event, { icon, zipFilePath, extractDir, deviceId }) => {
  try {
    console.log('=== Starting ZIP file processing ===');
    console.log('Device ID:', deviceId);
    console.log('Extract directory:', extractDir);
    console.log('Provided zipFilePath:', zipFilePath);
    
    // Get the device to access all image paths
    const device = await knex('devices').where('id', deviceId.id).first();
    if (!device) {
      throw new Error(`Device with ID ${deviceId.id} not found in database`);
    }
    console.log('Device found:', device.name);
    
    let imagePaths = [];
    
    // Parse the stored imagePaths if available
    if (device.imagePaths) {
      try {
        imagePaths = JSON.parse(device.imagePaths);
        console.log('Parsed imagePaths from device:', imagePaths);
      } catch (e) {
        console.error('Error parsing imagePaths:', e);
        if (device.imagePath) {
          imagePaths = [device.imagePath];
          console.log('Falling back to single imagePath:', device.imagePath);
        }
      }
    } else if (device.imagePath) {
      imagePaths = [device.imagePath];
      console.log('Using single imagePath:', device.imagePath);
    }
    
    // If zipFilePath is provided directly, prioritize that
    if (zipFilePath && !imagePaths.includes(zipFilePath)) {
      imagePaths.unshift(zipFilePath);
      console.log('Added provided zipFilePath to beginning of list');
    }
    
    if (imagePaths.length === 0) {
      throw new Error('No image paths found for processing');
    }
    console.log('Total zip files to try:', imagePaths.length);

    const targetFilePathInZip = /.*\/private\/var\/mobile\/Library\/Caches\/com\.apple\.routined\/Cache\.sqlite.*$/;

    // Create the extraction directory if it doesn't exist
    if (!fs.existsSync(extractDir)) {
      console.log('Creating extraction directory:', extractDir);
      fs.mkdirSync(extractDir, { recursive: true });
    } else {
      console.log('Extraction directory already exists:', extractDir);
    }
    
    // Try each zip file until we find the target files
    let extractedDbPath = null;
    let extractedDbPath2 = null;
    let successfulZipPath = null;
    
    for (const zipPath of imagePaths) {
      try {
        console.log(`\n--- Attempting extraction from: ${zipPath} ---`);
        
        // Check if zip file exists
        if (!fs.existsSync(zipPath)) {
          console.error(`ZIP file does not exist: ${zipPath}`);
          continue;
        }
        
        const zipStats = fs.statSync(zipPath);
        console.log(`ZIP file size: ${zipStats.size} bytes (${(zipStats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        if (zipStats.size === 0) {
          console.error(`ZIP file is empty: ${zipPath}`);
          continue;
        }
        
        console.log('Extracting Cache.sqlite and related files...');
        const extractedFiles = await extractMatchingFilesFromZip(zipPath, targetFilePathInZip, extractDir);
        
        if (extractedFiles.length === 0) {
          throw new Error('Cache.sqlite not found in ZIP archive');
        }
        
        // Find the main database file and WAL file
        for (const filePath of extractedFiles) {
          const fileName = path.basename(filePath);
          if (fileName === 'Cache.sqlite') {
            extractedDbPath = filePath;
          } else if (fileName === 'Cache.sqlite-wal') {
            extractedDbPath2 = filePath;
          }
          
          const fileStats = fs.statSync(filePath);
          console.log(`Extracted ${fileName}: ${fileStats.size} bytes (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
        
        // Verify main database file
        if (!extractedDbPath) {
          throw new Error(`Cache.sqlite not found (extracted: ${extractedFiles.map(f => path.basename(f)).join(', ')})`);
        }
        
        const extractedStats = fs.statSync(extractedDbPath);
        if (extractedStats.size === 0) {
          throw new Error(`Extracted Cache.sqlite file is empty (0 bytes)`);
        }
        
        successfulZipPath = zipPath;
        console.log(`✓ Successfully extracted from: ${zipPath}`);
        break; // Exit the loop if extraction is successful
      } catch (zipError) {
        console.error(`✗ Could not extract target files from ${zipPath}:`, zipError.message);
        console.error('Error stack:', zipError.stack);
        // Continue to the next zip file
      }
    }
    
    if (!extractedDbPath) {
      throw new Error('Could not find the target file in any of the provided zip files');
    }

    console.log('\n=== Opening SQLite database ===');
    console.log('Database path:', extractedDbPath);
    
    // Open the extracted SQLite database and read data from ZRTCLLOCATIONMO
    const cacheDb = new sqlite3.Database(extractedDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('Failed to open database:', err.message);
        throw new Error(`Could not open Cache.sqlite: ${err.message}`);
      }
      console.log('Database opened successfully');
    });
    
    // Verify database integrity
    return new Promise((resolve, reject) => {
      // First check if the database has the expected table
      cacheDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='ZRTCLLOCATIONMO'", (err, row) => {
        if (err) {
          console.error('Error checking for ZRTCLLOCATIONMO table:', err.message);
          cacheDb.close();
          return reject({ success: false, error: `Database error: ${err.message}` });
        }
        
        if (!row) {
          console.error('ZRTCLLOCATIONMO table not found in database');
          console.log('Listing all tables in database...');
          cacheDb.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            if (err) {
              console.error('Error listing tables:', err.message);
            } else {
              console.log('Available tables:', tables.map(t => t.name).join(', '));
            }
            cacheDb.close();
            reject({ success: false, error: 'ZRTCLLOCATIONMO table not found in database. Database may be corrupted or incorrect.' });
          });
          return;
        }
        
        console.log('✓ ZRTCLLOCATIONMO table found');
        
        // Check row count first
        cacheDb.get("SELECT COUNT(*) as count FROM ZRTCLLOCATIONMO", (err, countResult) => {
          if (err) {
            console.error('Error counting rows:', err.message);
            cacheDb.close();
            return reject({ success: false, error: `Error counting rows: ${err.message}` });
          }
          
          console.log(`Total rows in ZRTCLLOCATIONMO: ${countResult.count}`);
          
          if (countResult.count === 0) {
            console.warn('WARNING: ZRTCLLOCATIONMO table is empty');
            cacheDb.close();
            return resolve({ 
              success: true, 
              message: 'Database extracted successfully but contains no location data',
              sourceZip: successfulZipPath,
              rowCount: 0
            });
          }
          
          // Proceed with data extraction
          console.log('\n=== Querying location data ===');
          const query = `SELECT ZLATITUDE AS latitude, ZLONGITUDE AS longitude, ZSPEED AS speed, 
                            ZVERTICALACCURACY AS verticalAccuracy, ZHORIZONTALACCURACY AS horizontalAccuracy, 
                            ZTIMESTAMP AS timestamp FROM ZRTCLLOCATIONMO`;

          cacheDb.all(query, async (err, rows) => {
            if (err) {
              console.error('Error querying ZRTCLLOCATIONMO:', err.message);
              cacheDb.close();
              return reject({ success: false, error: err.message });
            }

            console.log(`Retrieved ${rows.length} location records from database`);
            
            if (rows.length === 0) {
              console.warn('Query returned 0 rows');
              cacheDb.close();
              return resolve({ 
                success: true, 
                message: 'No location data found in database',
                sourceZip: successfulZipPath,
                rowCount: 0
              });
            }
            
            // Log sample of first row
            console.log('Sample data (first row):', JSON.stringify(rows[0], null, 2));

            // Process each row and adjust the timestamp
            const locationData = rows.map((row) => ({
              deviceId: deviceId.id,
              latitude: row.latitude,
              longitude: row.longitude,
              speed: row.speed,
              verticalAccuracy: row.verticalAccuracy,
              horizontalAccuracy: row.horizontalAccuracy,
              timestamp: new Date((row.timestamp + IOS_TO_UNIX_EPOCH_OFFSET) * 1000) // Convert iOS time to Unix time
            }));

            console.log('\n=== Inserting data into device_locations ===');
            // Insert in batches to avoid "too many terms in compound SELECT"
            const chunks = chunkArray(locationData, 100); // Adjust the batch size as needed
            console.log(`Inserting ${locationData.length} records in ${chunks.length} batches`);
            
            try {
              let insertedCount = 0;
              for (const chunk of chunks) {
                await knex('device_locations').insert(chunk);
                insertedCount += chunk.length;
                console.log(`Inserted batch: ${insertedCount}/${locationData.length} records`);
              }
              console.log('✓ All data successfully inserted');
              resolve({ 
                success: true, 
                message: 'Data successfully transferred to device_locations',
                sourceZip: successfulZipPath,
                rowCount: locationData.length
              });
            } catch (insertError) {
              console.error('Error inserting into device_locations:', insertError.message);
              console.error('Insert error stack:', insertError.stack);
              reject({ success: false, error: insertError.message });
            } finally {
              cacheDb.close();
              console.log('Database connection closed');
            }
          });
        });
      });
    });
  } catch (error) {
    console.error('=== FATAL ERROR processing ZIP file ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});


ipcMain.handle('get-devices', async (event, caseId) => {
  try {
    console.log(caseId)
    const data = await knex('devices').where('caseId', caseId).select('*');
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching devices:', error);
    return { success: false, error: error.message };
  }
})

ipcMain.handle('get-app-usage', async (event, deviceId) => {
  try {
    console.log(deviceId)
    const data = await knex('application_data').select('*').where({ deviceId })

    return { success: true, data }
  } catch (error) {
    console.error('Error adding device:', error)
    return { success: false, error: error.message }
  }
})

// Handler to retrieve WiFi locations for a given caseId
ipcMain.handle('get-wifi-locations', async (event, caseId) => {
  try {
    const rows = await knex('wifi_locations')
      .join('devices', 'wifi_locations.deviceId', 'devices.id')
      .where('devices.caseId', caseId)
      .select('wifi_locations.*');
    return { success: true, data: rows };
  } catch (error) {
    console.error('Error fetching WiFi locations:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-device', async (event, device, caseId) => {
  try {
    // Store the imagePaths for later use
    const imagePaths = device.imagePaths || [];
    
    const [id] = await knex('devices')
      .insert({
        name: device.name,
        imagePath: imagePaths.length > 0 ? imagePaths[0] : null, // Store the first path in the imagePath column for backward compatibility
        created_at: device.created_at,
        imagePaths: JSON.stringify(imagePaths), // Store all paths as a JSON string
        caseId: device.caseId // Associate the device with a case
      })
      .returning('id') // Use 'returning' to get the inserted ID

    return { success: true, id }
  } catch (error) {
    console.error('Error adding device:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('remove-device', async (event, deviceId) => {
  try {
    await knex('devices').where('id', deviceId).del()
    return { success: true }
  } catch (error) {
    console.error('Error deleting device:', error)
    return { success: false, error: error.message }
  }
})

// Helper function to process KnowledgeC database
async function processKnowledgeCDatabase(knowledgeCFilePath, deviceId) {
  return new Promise((resolve, reject) => {
    console.log(`Processing KnowledgeC database: ${knowledgeCFilePath}`);
    
    // Open the KnowledgeC database
    const knowledgeDb = new sqlite3.Database(knowledgeCFilePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(new Error(`Could not open KnowledgeC.db: ${err.message}`));
    });

    const focusQuery = `
SELECT
  ZOBJECT.ZSTARTDATE AS "Start Time",
  ZOBJECT.ZENDDATE AS "End Time",
  ZOBJECT.ZVALUESTRING AS "Bundle Identifier",
  ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE AS "Focus Duration (Seconds)"
FROM
  ZOBJECT
WHERE
  ZOBJECT.ZSTREAMNAME = "/app/inFocus"
ORDER BY
  ZOBJECT.ZSTARTDATE DESC;
`

    const usageQuery = `
SELECT
  ZOBJECT.ZSTARTDATE AS "Start Time",
  ZOBJECT.ZENDDATE AS "End Time",
  ZOBJECT.ZVALUESTRING AS "Bundle Identifier",
  ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE AS "Usage Duration (Seconds)"
FROM
  ZOBJECT
WHERE
  ZOBJECT.ZSTREAMNAME = "/app/usage"
ORDER BY
  ZOBJECT.ZSTARTDATE DESC;
`

    const processQuery = (query, type) => {
      return new Promise((resolveQuery, rejectQuery) => {
        knowledgeDb.all(query, (err, rows) => {
          if (err) {
            console.error(`Error querying ZOBJECT for ${type}:`, err.message);
            return rejectQuery(err.message);
          }

          // Map rows to application_data format
          const appUsageData = rows.map((row) => ({
            deviceId: deviceId,
            bundleIdentifier: row['Bundle Identifier'],
            startTime: new Date((row['Start Time'] + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
            endTime: new Date((row['End Time'] + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
            duration:
              row[type === 'focus' ? 'Focus Duration (Seconds)' : 'Usage Duration (Seconds)'],
            type
          }));

          resolveQuery(appUsageData);
        });
      });
    };

    Promise.all([processQuery(focusQuery, 'focus'), processQuery(usageQuery, 'usage')])
      .then(async ([focusData, usageData]) => {
        const allData = [...focusData, ...usageData];

        // Insert in batches
        const chunks = chunkArray(allData, 100);
        try {
          for (const chunk of chunks) {
            await knex('application_data').insert(chunk);
          }
          resolve({ success: true, count: allData.length });
        } catch (insertError) {
          console.error('Error inserting into application_data:', insertError.message);
          reject({ success: false, error: insertError.message });
        } finally {
          knowledgeDb.close();
        }
      })
      .catch((queryError) => {
        console.error('Error processing queries:', queryError);
        knowledgeDb.close();
        reject({ success: false, error: queryError });
      });
  });
}

// Helper function to process Cache.sqlite database
async function processCacheSqliteDatabase(cacheSqlitePath, deviceId) {
  return new Promise((resolve, reject) => {
    console.log(`Processing Cache.sqlite database: ${cacheSqlitePath}`);
    
    // Open the Cache.sqlite database
    const cacheDb = new sqlite3.Database(cacheSqlitePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(new Error(`Could not open Cache.sqlite: ${err.message}`));
    });

    const query = `SELECT ZLATITUDE AS latitude, ZLONGITUDE AS longitude, ZSPEED AS speed, 
                    ZVERTICALACCURACY AS verticalAccuracy, ZHORIZONTALACCURACY AS horizontalAccuracy, 
                    ZTIMESTAMP AS timestamp FROM ZRTCLLOCATIONMO`;

    cacheDb.all(query, async (err, rows) => {
      if (err) {
        cacheDb.close();
        console.error('Error querying ZRTCLLOCATIONMO:', err.message);
        return reject({ success: false, error: err.message });
      }

      // Process each row and adjust the timestamp
      const locationData = rows.map((row) => ({
        deviceId: deviceId,
        latitude: row.latitude,
        longitude: row.longitude,
        speed: row.speed,
        verticalAccuracy: row.verticalAccuracy,
        horizontalAccuracy: row.horizontalAccuracy,
        timestamp: new Date((row.timestamp + IOS_TO_UNIX_EPOCH_OFFSET) * 1000) // Convert iOS time to Unix time
      }));

      // Insert in batches
      const chunks = chunkArray(locationData, 100);
      try {
        for (const chunk of chunks) {
          await knex('device_locations').insert(chunk);
        }
        cacheDb.close();
        resolve({ success: true, count: locationData.length });
      } catch (insertError) {
        cacheDb.close();
        console.error('Error inserting into device_locations:', insertError.message);
        reject({ success: false, error: insertError.message });
      }
    });
  });
}

// Updated handler to process database files with better step tracking and file path handling
ipcMain.handle('process-database-files', async (event, { knowledgeCFiles, cacheFiles, deviceId }) => {
  console.log('Processing database files:', { knowledgeCFiles, cacheFiles, deviceId });
  
  const results = {
    knowledgeC: null,
    cache: null
  };

  try {
    // Send device completion status (device was already created before this handler is called)
    event.sender.send('database-processing-update', { 
      step: 'device', 
      status: 'completed',
      message: 'Device record created successfully'
    });

    // Process KnowledgeC.db files if provided
    if (knowledgeCFiles && knowledgeCFiles.length > 0) {
      let totalKnowledgeCRecords = { focus: 0, usage: 0 };
      
      for (const knowledgeCFile of knowledgeCFiles) {
        if (!knowledgeCFile.path) continue;
        
        try {
          // Update the frontend that we're starting this step
          event.sender.send('database-processing-update', { 
            step: 'knowledgeC', 
            status: 'started',
            message: `Processing KnowledgeC.db: ${knowledgeCFile.name || path.basename(knowledgeCFile.path)}...`
          });
        
        // Open the KnowledgeC database
        const knowledgeDb = new sqlite3.Database(knowledgeCFile.path, sqlite3.OPEN_READONLY, (err) => {
          if (err) throw new Error(`Could not open KnowledgeC.db: ${err.message}`);
        });

        const focusQuery = `
        SELECT
          ZOBJECT.ZSTARTDATE AS "Start Time",
          ZOBJECT.ZENDDATE AS "End Time",
          ZOBJECT.ZVALUESTRING AS "Bundle Identifier",
          ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE AS "Focus Duration (Seconds)"
        FROM
          ZOBJECT
        WHERE
          ZOBJECT.ZSTREAMNAME = "/app/inFocus"
        ORDER BY
          ZOBJECT.ZSTARTDATE DESC;
        `;

        const usageQuery = `
        SELECT
          ZOBJECT.ZSTARTDATE AS "Start Time",
          ZOBJECT.ZENDDATE AS "End Time",
          ZOBJECT.ZVALUESTRING AS "Bundle Identifier",
          ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE AS "Usage Duration (Seconds)"
        FROM
          ZOBJECT
        WHERE
          ZOBJECT.ZSTREAMNAME = "/app/usage"
        ORDER BY
          ZOBJECT.ZSTARTDATE DESC;
        `;

        // Use Promise.all to run both queries concurrently
        const [focusRows, usageRows] = await Promise.all([
          new Promise((resolve, reject) => {
            knowledgeDb.all(focusQuery, (err, rows) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(rows);
            });
          }),
          new Promise((resolve, reject) => {
            knowledgeDb.all(usageQuery, (err, rows) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(rows);
            });
          })
        ]);

        // Map rows to application_data format
        const focusData = focusRows.map((row) => ({
          deviceId,
          bundleIdentifier: row['Bundle Identifier'],
          startTime: new Date((row['Start Time'] + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
          endTime: new Date((row['End Time'] + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
          duration: row['Focus Duration (Seconds)'],
          type: 'focus'
        }));

        const usageData = usageRows.map((row) => ({
          deviceId: deviceId,
          bundleIdentifier: row['Bundle Identifier'],
          startTime: new Date((row['Start Time'] + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
          endTime: new Date((row['End Time'] + IOS_TO_UNIX_EPOCH_OFFSET) * 1000),
          duration: row['Usage Duration (Seconds)'],
          type: 'usage'
        }));

        const allData = [...focusData, ...usageData];

        // Insert data into the database in batches
        const chunks = chunkArray(allData, 100);
        
        for (const chunk of chunks) {
          await knex('application_data').insert(chunk);
        }

        totalKnowledgeCRecords.focus += focusData.length;
        totalKnowledgeCRecords.usage += usageData.length;

        knowledgeDb.close();
        
      } catch (fileError) {
        console.error(`Error processing KnowledgeC file ${knowledgeCFile.name}:`, fileError);
        // Continue processing other files
      }
    }
    
    results.knowledgeC = { 
      success: true, 
      count: totalKnowledgeCRecords.focus + totalKnowledgeCRecords.usage
    };
    
    // Update the frontend that this step completed
    event.sender.send('database-processing-update', { 
      step: 'knowledgeC', 
      status: 'completed',
      result: results.knowledgeC
    });
    }

    // Process Cache.sqlite files if provided
    if (cacheFiles && cacheFiles.length > 0) {
      try {
      let totalCacheRecords = 0;
      
      for (const cacheFile of cacheFiles) {
        if (!cacheFile.path) continue;
        
        try {
          // Update the frontend that we're starting this step
          event.sender.send('database-processing-update', { 
            step: 'cache', 
            status: 'started',
            message: `Processing Cache.sqlite: ${cacheFile.name || path.basename(cacheFile.path)}...`
          });
        
          
        // Open the Cache.sqlite database
        const cacheDb = new sqlite3.Database(cacheFile.path, sqlite3.OPEN_READONLY, (err) => {
          if (err) throw new Error(`Could not open Cache.sqlite: ${err.message}`);
        });

        const locationQuery = `SELECT ZLATITUDE AS latitude, ZLONGITUDE AS longitude, ZSPEED AS speed, 
                              ZVERTICALACCURACY AS verticalAccuracy, ZHORIZONTALACCURACY AS horizontalAccuracy, 
                              ZTIMESTAMP AS timestamp FROM ZRTCLLOCATIONMO`;

        // Query location data
        const locationRows = await new Promise((resolve, reject) => {
          cacheDb.all(locationQuery, (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows);
          });
        });

        // Process location data
        const locationData = locationRows.map((row) => ({
          deviceId: deviceId,
          latitude: row.latitude,
          longitude: row.longitude,
          speed: row.speed,
          verticalAccuracy: row.verticalAccuracy,
          horizontalAccuracy: row.horizontalAccuracy,
          timestamp: new Date((row.timestamp + IOS_TO_UNIX_EPOCH_OFFSET) * 1000)
        }));

        // Insert location data into the database in batches
        const chunks = chunkArray(locationData, 100);
        
        for (const chunk of chunks) {
          await knex('device_locations').insert(chunk);
        }

        totalCacheRecords += locationData.length;

        cacheDb.close();
        
      } catch (fileError) {
        console.error(`Error processing Cache file ${cacheFile.name}:`, fileError);
        // Continue processing other files
      }
    }
    
    results.cache = { 
      success: true, 
      count: totalCacheRecords
    };
    
    // Update the frontend that this step completed
    event.sender.send('database-processing-update', { 
      step: 'cache', 
      status: 'completed',
      result: results.cache
    });
  } catch (cacheError) {
    console.error('Error processing Cache.sqlite database:', cacheError);
    results.cache = { 
      success: false, 
      error: cacheError instanceof Error ? cacheError.message : 'Unknown error' 
    };
    
    // Update the frontend about the error
    event.sender.send('database-processing-update', { 
      step: 'cache', 
      status: 'error',
      error: results.cache.error
    });
  }
}
    return { 
      success: true, 
      knowledgeC: results.knowledgeC, 
      cache: results.cache 
    };
  } catch (error) {
    console.error('Error processing database files:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// Add handlers for individual processing tasks to allow direct access from frontend
ipcMain.handle('process-knowledge-database', async (event, { filePath, deviceId }) => {
  try {
    return await processKnowledgeCDatabase(filePath, deviceId);
  } catch (error) {
    console.error('Error in process-knowledge-database handler:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

ipcMain.handle('process-cache-database', async (event, { filePath, deviceId }) => {
  try {
    return await processCacheSqliteDatabase(filePath, deviceId);
  } catch (error) {
    console.error('Error in process-cache-database handler:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

// Add a new IPC handler to handle case creation and insert it into the database.
ipcMain.handle('add-case', async (event, newCase) => {
  try {
    console.log('Adding new case:', newCase);
    const [id] = await knex('cases').insert(newCase).returning('id');
    return { success: true, id };
  } catch (error) {
    console.error('Error adding case:', error);
    return { success: false, error: error.message };
  }
});


// Add a handler to fetch cases from the database
ipcMain.handle('get-cases', async (event, deviceId) => {
  try {
    const cases = await knex('cases').select();
    console.log('Fetched cases:', cases);
    return { success: true, data: cases };
  } catch (error) {
    console.error('Error fetching cases:', error);
    return { success: false, error: error.message };
  }
});

// Add a handler to update the case status
ipcMain.handle('update-case-status', async (event, { caseId, status }) => {
  try {
    await knex('cases').where('id', caseId).update({ status });
    return { success: true };
  } catch (error) {
    console.error('Error updating case status:', error);
    return { success: false, error: error.message };
  }
});

// Add a handler to delete a case
ipcMain.handle('delete-case', async (event, caseId) => {
  try {
    await knex('cases').where('id', caseId).del();
    return { success: true };
  } catch (error) {
    console.error('Error deleting case:', error);
    return { success: false, error: error.message };
  }
});

// ==================== Area Handlers ====================

// Add a new area to a case
ipcMain.handle('add-area', async (event, area) => {
  try {
    console.log('Adding new area:', area);
    const [id] = await knex('areas').insert(area).returning('id');
    return { success: true, id };
  } catch (error) {
    console.error('Error adding area:', error);
    return { success: false, error: error.message };
  }
});

// Get all areas for a specific case
ipcMain.handle('get-areas', async (event, caseId) => {
  try {
    const areas = await knex('areas').where('caseId', caseId).select();
    console.log('Fetched areas for case', caseId, ':', areas);
    return { success: true, data: areas };
  } catch (error) {
    console.error('Error fetching areas:', error);
    return { success: false, error: error.message };
  }
});

// Update an existing area
ipcMain.handle('update-area', async (event, { id, updates }) => {
  try {
    console.log('Updating area', id, 'with:', updates);
    await knex('areas').where('id', id).update(updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating area:', error);
    return { success: false, error: error.message };
  }
});

// Delete an area
ipcMain.handle('delete-area', async (event, areaId) => {
  try {
    console.log('Deleting area:', areaId);
    await knex('areas').where('id', areaId).del();
    return { success: true };
  } catch (error) {
    console.error('Error deleting area:', error);
    return { success: false, error: error.message };
  }
});
