import { useState, useEffect, useRef } from 'react';

const { ipcRenderer } = window.require('electron');

export const useMapData = (caseId, isFileModalVisible) => {
  const [locations, setLocations] = useState([]);
  const [wifiLocations, setWifiLocations] = useState([]);
  const [ktxFiles, setKtxFiles] = useState([]);
  const [matchedLocations, setMatchedLocations] = useState([]);
  const [fetchedDevices, setFetchedDevices] = useState([]);
  const wasFileModalVisibleRef = useRef(isFileModalVisible);

  const matchKtxToLocations = (locations, ktxFiles) => {
    const matchedKtxFiles = new Set();

    const matchedLocations = locations.map((location) => {
      const availableKtxFiles = ktxFiles.filter(
        (file) => file.deviceId === location.deviceId && !matchedKtxFiles.has(file)
      );

      const closestKtxFile =
        availableKtxFiles.length > 0
          ? availableKtxFiles.reduce((prev, curr) => {
              const prevDiff = Math.abs(location.timestamp - prev.timestamp);
              const currDiff = Math.abs(location.timestamp - curr.timestamp);
              return currDiff < prevDiff ? curr : prev;
            })
          : null;

      const isWithinThreshold = closestKtxFile
        ? Math.abs(location.timestamp - closestKtxFile.timestamp) <= 20000
        : false;

      if (closestKtxFile && isWithinThreshold) {
        matchedKtxFiles.add(closestKtxFile);
      }

      return {
        ...location,
        hasKtxFile: isWithinThreshold,
        ktxObj: isWithinThreshold ? closestKtxFile : null
      };
    });

    const sortedMatchedLocations = matchedLocations.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    return sortedMatchedLocations;
  };

  const fetchData = async () => {
    if (!caseId) return;

    try {
      // Fetch devices
      const devicesResponse = await ipcRenderer.invoke('get-devices', caseId);
      const devices = devicesResponse.data || [];

      const deviceIdToMapId = {};
      devices.forEach((d, idx) => {
        deviceIdToMapId[d.id] = idx + 1;
      });

      setFetchedDevices(devices.map((d, idx) => ({ name: d.name, id: idx + 1 })));

      // Fetch Wi-Fi locations
      const wifiResponse = await ipcRenderer.invoke('get-wifi-locations', caseId);
      if (wifiResponse.success) {
        const wifiData = wifiResponse.data.map(w => ({
          ...w,
          timestamp: new Date(w.timestamp),
          deviceId: w.deviceId,
          mapDeviceId: deviceIdToMapId[w.deviceId] ?? null,
        }));
        setWifiLocations(wifiData);
      } else {
        setWifiLocations([]);
      }

      // Fetch locations, KTX files, and app usage for each device
      const allLocations = [];
      const allKtxFiles = [];
      const allAppUsage = [];

      for (const device of devices) {
        const mapId = deviceIdToMapId[device.id];

        // Fetch locations
        const locRes = await ipcRenderer.invoke('get-device-locations', device.id);
        if (locRes.success) {
          const deviceLocations = locRes.data.map((loc) => ({
            ...loc,
            timestamp: new Date(loc.timestamp),
            deviceId: device.id,
            mapDeviceId: mapId,
          }));
          allLocations.push(...deviceLocations);
        }

        // Fetch KTX files
        const ktxRes = await ipcRenderer.invoke('get-ktx-files', device.id);
        if (ktxRes.success) {
          allKtxFiles.push(
            ...ktxRes.data.map((f) => ({
              ...f,
              timestamp: new Date(f.timestamp),
              deviceId: device.id,
            }))
          );
        }

        // Fetch app usage
        const usageRes = await ipcRenderer.invoke('get-app-usage', device.id);
        if (usageRes.success) {
          allAppUsage.push(
            ...usageRes.data.map((u) => ({
              ...u,
              startTime: new Date(u.startTime),
              endTime: new Date(u.endTime),
              deviceId: device.id,
            }))
          );
        }
      }

      // Merge app usage into locations
      const locationsWithAppUsage = allLocations.map(loc => ({
        ...loc,
        appUsage:
          allAppUsage.find(
            u =>
              u.deviceId === loc.deviceId &&
              u.startTime <= loc.timestamp &&
              u.endTime >= loc.timestamp
          ) || null,
      }));

      setLocations(allLocations);
      setKtxFiles(allKtxFiles);
      const matched = matchKtxToLocations(locationsWithAppUsage, allKtxFiles);
      setMatchedLocations(matched);
    } catch (error) {
      console.error('Error fetching map data:', error);
    }
  };

  // Initial load + case switch
  useEffect(() => {
    fetchData();
  }, [caseId]);

  // Refresh all map data when modal closes (after potential new device addition)
  useEffect(() => {
    const justClosed = wasFileModalVisibleRef.current && !isFileModalVisible;
    wasFileModalVisibleRef.current = isFileModalVisible;

    if (justClosed) {
      fetchData();
    }
  }, [isFileModalVisible, caseId]);

  return {
    locations,
    wifiLocations,
    ktxFiles,
    matchedLocations,
    fetchedDevices,
    setFetchedDevices
  };
};
