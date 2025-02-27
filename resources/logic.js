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

function chunkArray(array, size) {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

ipcMain.handle('process-zip-file', async (event, { icon, zipFilePath, extractDir, deviceId }) => {
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

    const targetFilePathInZip = /.*\/private\/var\/mobile\/Library\/Caches\/com\.apple\.routined\/Cache\.sqlite/;
    const target2FilePathInZip = /.*\/private\/var\/mobile\/Library\/Caches\/com\.apple\.routined\/Cache\.sqlite(-wal)?/;

    // Create the extraction directory if it doesn't exist
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    
    // Try each zip file until we find the target files
    let extractedDbPath = null;
    let extractedDbPath2 = null;
    let successfulZipPath = null;
    
    for (const zipPath of imagePaths) {
      try {
        console.log(`Trying to extract from: ${zipPath}`);
        extractedDbPath = await extractFileFromZip(zipPath, targetFilePathInZip, extractDir);
        extractedDbPath2 = await extractFileFromZip(zipPath, target2FilePathInZip, extractDir);
        successfulZipPath = zipPath;
        console.log(`Successfully extracted from: ${zipPath}`);
        break; // Exit the loop if extraction is successful
      } catch (zipError) {
        console.log(`Could not extract target files from ${zipPath}: ${zipError.message}`);
        // Continue to the next zip file
      }
    }
    
    if (!extractedDbPath) {
      throw new Error('Could not find the target file in any of the provided zip files');
    }

    // Open the extracted SQLite database and read data from ZRTCLLOCATIONMO
    const cacheDb = new sqlite3.Database(extractedDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) throw new Error(`Could not open Cache.sqlite: ${err.message}`);
    });

    const query = `SELECT ZLATITUDE AS latitude, ZLONGITUDE AS longitude, ZSPEED AS speed, 
                      ZVERTICALACCURACY AS verticalAccuracy, ZHORIZONTALACCURACY AS horizontalAccuracy, 
                      ZTIMESTAMP AS timestamp FROM ZRTCLLOCATIONMO`;

    return new Promise((resolve, reject) => {
      cacheDb.all(query, async (err, rows) => {
        if (err) {
          console.error('Error querying ZRTCLLOCATIONMO:', err.message);
          return reject({ success: false, error: err.message });
        }

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

        // Insert in batches to avoid "too many terms in compound SELECT"
        const chunks = chunkArray(locationData, 100); // Adjust the batch size as needed
        try {
          for (const chunk of chunks) {
            await knex('device_locations').insert(chunk);
          }
          resolve({ 
            success: true, 
            message: 'Data successfully transferred to device_locations',
            sourceZip: successfulZipPath
          });
        } catch (insertError) {
          console.error('Error inserting into device_locations:', insertError.message);
          reject({ success: false, error: insertError.message });
        } finally {
          cacheDb.close();
        }
      });
    });
  } catch (error) {
    console.error('Error processing ZIP file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});


ipcMain.handle('get-devices', async () => {
  try {
    const data = await knex('devices').select('*')
    return { success: true, data }
  } catch (error) {
    console.error('Error adding device:', error)
    return { success: false, error: error.message }
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

ipcMain.handle('add-device', async (event, device) => {
  try {
    // Store the imagePaths for later use
    const imagePaths = device.imagePaths || [];
    
    const [id] = await knex('devices')
      .insert({
        name: device.name,
        imagePath: imagePaths.length > 0 ? imagePaths[0] : null, // Store the first path in the imagePath column for backward compatibility
        created_at: device.created_at,
        imagePaths: JSON.stringify(imagePaths) // Store all paths as a JSON string
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
