<p align="center">
  <img src="https://github.com/ozaksen/iGem/blob/main/resources/icon.png" alt="iGem Logo" width="200">
</p>

<p align="center">
  <a href="https://github.com/ozaksen/iGem/releases">
    <img src="https://img.shields.io/github/v/release/ozaksen/iGem" alt="Release Version">
  </a>
  <a href="https://github.com/ozaksen/iGem">
    <img src="https://img.shields.io/github/license/ozaksen/iGem" alt="License">
  </a>
  <a href="https://github.com/ozaksen/iGem/stargazers">
    <img src="https://img.shields.io/github/stars/ozaksen/iGem" alt="Stars">
  </a>
</p>

# iGem - iOS Geolocation Evidence Matching

iGem is a forensic tool designed to assist investigators in matching geolocation data with various types of digital evidence. This application specializes in analyzing iOS data, such as GPS locations from `cache.sqlite` and app usage patterns from KnowledgeC databases. By providing powerful visualization and analysis features, iGem simplifies the process of cross-referencing geolocation evidence.

## Features

- **Multi-Device Analysis**: Add and analyze data from up to 4 devices simultaneously to compare geolocation points across multiple sources.
- **Geolocation Playback**: Visualize location data as an animation to track movement patterns over time.
- **Comprehensive Data Support**: Matches GPS data from `cache.sqlite` with KTX files and app usage from KnowledgeC databases.

## Installation

### Option 1: Download Release
1. Visit the [iGem GitHub Releases](https://github.com/ozaksen/iGem/releases) page.
2. Download the latest `.exe` file for **v1.0.0**.
3. Run the installer to start using iGem.

### Option 2: Clone the Repository
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/igem.git
   cd igem
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```

> **Note**: iGem is built using Electron Vite with React.

## Requirements

- **Node.js**: Version 14 or higher
- **npm**: Version 6 or higher

## Usage

1. Launch the application.
2. Add data from up to 4 devices for simultaneous analysis.
3. Upload GPS data (`cache.sqlite`), KTX files, and KnowledgeC databases.
4. Play the geolocation points as an animation to visualize movement over time.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes. Ensure all new code includes proper documentation and follows the project's coding standards.

## Contact

For questions or support, please contact:

- **Akif Ozer**: [ozer@purdue.edu](mailto:ozer@purdue.edu)
- **Xiao Hu**: [hu961@purdue.edu](mailto:hu961@purdue.edu)
- **Dr. Umit Karabiyik**: [umit@purdue.edu](mailto:umit@purdue.edu)

---

Thank you for using iGem! We hope it helps streamline your forensic investigations.
