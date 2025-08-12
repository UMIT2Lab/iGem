import { useState, useEffect } from 'react';
import { message } from 'antd';

export const useMapFilters = (matchedLocations, wifiLocations) => {
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [visibleLocations, setVisibleLocations] = useState([]);
  const [filteredWifiLocations, setFilteredWifiLocations] = useState([]);
  const [visibleWifiLocations, setVisibleWifiLocations] = useState([]);
  const [startDateTime, setStartDateTime] = useState(null);
  const [endDateTime, setEndDateTime] = useState(null);
  const [messageApi, contextHolder] = message.useMessage();

  const updateVisibleLocations = (newIndex, maxLocations) => {
    let recentLocations;
    if (maxLocations && filteredLocations.length > maxLocations) {
      const startIdx = Math.max(0, newIndex + 1 - maxLocations);
      recentLocations = filteredLocations.slice(startIdx, newIndex + 1);
    } else {
      recentLocations = filteredLocations.slice(0, newIndex + 1);
    }
    setVisibleLocations(recentLocations);

    // Update visible Wi-Fi locations up to current GPS timestamp
    const currentGpsTime = filteredLocations[newIndex]?.timestamp;
    if (currentGpsTime) {
      const wifiSlice = filteredWifiLocations.filter(loc => loc.timestamp <= currentGpsTime);
      setVisibleWifiLocations(wifiSlice);
    } else {
      setVisibleWifiLocations([]);
    }
  };

  useEffect(() => {
    setVisibleLocations([]);
    if (startDateTime && endDateTime) {
      const filtered = matchedLocations
        .filter(
          (location) =>
            Date.parse(location.timestamp) >= Date.parse(startDateTime) &&
            Date.parse(location.timestamp) <= Date.parse(endDateTime)
        )
        .sort((a, b) => a.timestamp - b.timestamp);
      
      setFilteredLocations(filtered);
      
      // Filter WiFi by same date range
      const wifiFiltered = wifiLocations
        .filter(w => 
          Date.parse(w.timestamp) >= Date.parse(startDateTime) && 
          Date.parse(w.timestamp) <= Date.parse(endDateTime)
        )
        .sort((a, b) => a.timestamp - b.timestamp);
      
      setFilteredWifiLocations(wifiFiltered);
      
      messageApi.open({
        type: 'success',
        content: `${filtered.length} data points found`,
      });
    } else {
      setFilteredLocations([]);
      setFilteredWifiLocations([]);
    }
  }, [startDateTime, endDateTime, matchedLocations, wifiLocations, messageApi]);

  return {
    filteredLocations,
    visibleLocations,
    filteredWifiLocations,
    visibleWifiLocations,
    startDateTime,
    endDateTime,
    setStartDateTime,
    setEndDateTime,
    updateVisibleLocations,
    messageApi,
    contextHolder
  };
};
