const { execFile } = require('child_process');
const path = require('path');

// Paths for the KTX file, output PNG file, and the executable
const ktxFilePath = path.join(__dirname, '..', 'Data', '025879CB-31E7-4AA0-B548-F1FA29ED32A1@3x.ktx');
const outputFilePath = path.join(__dirname, '..', 'Data', 'converted_image.png');
const exePath = path.join(__dirname, 'ios_ktx2png.exe'); // Path to the executable in the same folder

// Maximum number of retry attempts
const MAX_RETRIES = 3;

// Function to convert KTX to PNG with a retry mechanism
const convertKTXtoPNG = (retryCount = 0) => {
  execFile(exePath, [ktxFilePath, outputFilePath], (error, stdout, stderr) => {
    if (error) {
      console.error(`Attempt ${retryCount + 1}: KTX to PNG conversion failed. Error:`, error.message);
      console.log('stderr:', stderr); // Log any stderr for additional info

      // Retry if we haven't reached the max retries
      if (retryCount < MAX_RETRIES - 1) {
        console.log(`Retrying... (${retryCount + 2}/${MAX_RETRIES})`);
        convertKTXtoPNG(retryCount + 1);
      } else {
        console.error('Max retries reached. Conversion failed.');
      }
      return;
    }

    // If successful
    console.log(stdout); // Log success message from the executable
    console.log('KTX to PNG conversion successful!');
    console.log(`Output is at ${outputFilePath}`);
  });
};

// Run the conversion
convertKTXtoPNG();
