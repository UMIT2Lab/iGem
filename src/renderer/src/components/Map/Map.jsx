import React, { useState, useEffect } from 'react';
import {
  Layout,
  Row,
  Col,
  Drawer,
  FloatButton,
  notification
} from 'antd';
import {
  SettingOutlined,
  AppstoreAddOutlined,
  ControlOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

// Components
import MapHeader from './components/MapHeader';
import MapLegend from './components/MapLegend';
import DevicePanel from './components/DevicePanel';
import MapLayers from './components/MapLayers';

// Modals
import DeviceSelectionModal from '../Modals/DeviceSelectionModal';
import MapSettingsModal from '../Modals/MapSettingsModal';
import AreaCreationModal from '../Modals/AreaCreationModal';

// Hooks
import { useMapData } from './hooks/useMapData';
import { useMapAnimation } from './hooks/useMapAnimation';
import { useMapFilters } from './hooks/useMapFilters';
import { useImageHandling } from './hooks/useImageHandling';

// Utils
import { getMapTileLayerUrl } from './utils/mapUtils';

// Styles
import 'leaflet/dist/leaflet.css';

// Map helper components
const MapSettings = ({ center, zoom, autoCenterMap, currentLocation }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map]);

  useEffect(() => {
    map.setZoom(zoom);
  }, [zoom, map]);

  useEffect(() => {
    if (autoCenterMap && currentLocation) {
      map.panTo([currentLocation.latitude, currentLocation.longitude], {
        animate: true,
        duration: 0.5
      });
    }
  }, [autoCenterMap, currentLocation, map]);

  return null;
};

const MapCenterTracker = ({ setMapCenter }) => {
  const map = useMapEvents({
    moveend: () => {
      setMapCenter(map.getCenter());
    }
  });

  useEffect(() => {
    setMapCenter(map.getCenter());
  }, [map, setMapCenter]);

  return null;
};

const MapClickHandler = ({ enabled, onLocationSelect }) => {
  const map = useMapEvents({
    click: (e) => {
      if (enabled) {
        const { lat, lng } = e.latlng;
        onLocationSelect({ lat, lng });
      }
    }
  });

  return null;
};

const Map = ({ onClose, caseId }) => {
  // State management
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isFileModalVisible, setIsFileModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isAreaModalVisible, setIsAreaModalVisible] = useState(false);
  const [isAreaCreationMode, setIsAreaCreationMode] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 40.454, lng: -86.904 });
  const [areas, setAreas] = useState([]);

  // Map settings
  const [mapSettings, setMapSettings] = useState({
    mapLayer: 'osm',
    animationSpeed: 500,
    maxLocations: 200,
    defaultZoom: 4,
    autoCenterMap: false,
    showTrails: false,
    markerSize: 30,
    showAllDevices: true
  });

  // Custom hooks
  const {
    locations,
    wifiLocations,
    ktxFiles,
    matchedLocations,
    fetchedDevices,
    setFetchedDevices
  } = useMapData(caseId, isFileModalVisible);

  const {
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
  } = useMapFilters(matchedLocations, wifiLocations);

  const {
    isPlaying,
    index,
    setIndex,
    togglePlayPause,
    forward,
    backward,
    sliderUpdate
  } = useMapAnimation(filteredLocations, mapSettings);

  const {
    pngPath,
    devicePngArray,
    loadBase64Image,
    deviceKTXImageLoad
  } = useImageHandling();

  const [notificationApi, contextNotificationHolder] = notification.useNotification();

  // Effect to update visible locations and device states with debouncing
  useEffect(() => {
    // Debounce the update to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      updateVisibleLocations(index, mapSettings.maxLocations);

      const currentLocation = filteredLocations[index];
      if (currentLocation) {
        // Only load image if we don't already have it loaded to avoid repeated loading
        if (currentLocation.hasKtxFile && !pngPath) {
          loadBase64Image(currentLocation.ktxObj.filepath);
        }

        setFetchedDevices((prevDevices) => {
          return prevDevices.map((device) => {
            if (device.id === currentLocation.mapDeviceId) {
              // Only load device KTX image if we don't already have it to avoid repeated loading
              if (currentLocation.hasKtxFile && !devicePngArray[device.id - 1]) {
                deviceKTXImageLoad(currentLocation.ktxObj.filepath, device.id);
              }
              return { ...device, lastLocation: currentLocation };
            }
            return device;
          });
        });
      }
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [index, filteredLocations, mapSettings.maxLocations, pngPath, devicePngArray, loadBase64Image, deviceKTXImageLoad, updateVisibleLocations]);

  // Event handlers
  const handleFileModalOpen = () => setIsFileModalVisible(true);
  const handleFileModalClose = () => setIsFileModalVisible(false);
  const handleFileConfirm = (file) => {
    console.log('File added:', file);
  };

  const handleSettingsModalOpen = () => setIsSettingsModalVisible(true);
  const handleSettingsModalClose = () => setIsSettingsModalVisible(false);
  const handleSaveSettings = (newSettings) => {
    setMapSettings(newSettings);
    if (isPlaying) {
      // Restart animation with new speed if playing
      // This will be handled by the useMapAnimation hook
    }
  };

  const handleAreaModeToggle = () => {
    const newMode = !isAreaCreationMode;
    setIsAreaCreationMode(newMode);

    if (newMode) {
      notificationApi.info({
        message: 'Area Creation Mode',
        description: 'Click anywhere on the map to place your area.',
        placement: 'topRight',
        duration: 3
      });
    }
  };

  const handleMapClick = (location) => {
    setMapCenter(location);
    setIsAreaCreationMode(false);
    setIsAreaModalVisible(true);
  };

  const handleAreaModalClose = () => setIsAreaModalVisible(false);
  const handleSaveArea = (newArea) => {
    setAreas([...areas, newArea]);
    messageApi.success(`Area "${newArea.name}" created successfully`);
  };

  const onCloseDrawer = () => {
    setIsDrawerVisible(false);
    setSelectedLocation(null);
  };

  const currentTimestamp = filteredLocations[index]?.timestamp.toLocaleString() || 'N/A';
  const mapTileLayerUrl = getMapTileLayerUrl(mapSettings.mapLayer);

  const renderFloatButtons = () => (
    <FloatButton.Group
      trigger="click"
      type="primary"
      style={{ insetInlineEnd: 24 }}
      icon={<SettingOutlined />}
    >
      <FloatButton
        icon={<ControlOutlined />}
        onClick={handleSettingsModalOpen}
        tooltip={{ title: 'Map Settings', placement: 'left' }}
      />
      <FloatButton
        icon={<AppstoreAddOutlined />}
        onClick={handleFileModalOpen}
        tooltip={{ title: 'Select Devices', placement: 'left' }}
      />
      <FloatButton
        icon={<EnvironmentOutlined />}
        onClick={handleAreaModeToggle}
        tooltip={{
          title: isAreaCreationMode ? 'Cancel Area Creation' : 'Create Area',
          placement: 'left',
        }}
        type={isAreaCreationMode ? 'primary' : 'default'}
      />
    </FloatButton.Group>
  );

  return (
    <div>
      {contextHolder}
      {contextNotificationHolder}

      <Layout style={{ height: '100vh' }}>
        <MapHeader
          onClose={onClose}
          startDateTime={startDateTime}
          endDateTime={endDateTime}
          setStartDateTime={setStartDateTime}
          setEndDateTime={setEndDateTime}
          isPlaying={isPlaying}
          togglePlayPause={togglePlayPause}
          forward={forward}
          backward={backward}
          index={index}
          filteredLocations={filteredLocations}
          sliderUpdate={sliderUpdate}
        />

        <Layout>
          <Row>
            <Col span={18}>
              <MapContainer
                center={[40.454, -86.904]}
                zoom={mapSettings.defaultZoom}
                style={{ width: '100%', height: 'calc(100vh - 64px)' }}
              >
                <MapSettings
                  center={[40.454, -86.904]}
                  zoom={mapSettings.defaultZoom}
                  autoCenterMap={mapSettings.autoCenterMap}
                  currentLocation={filteredLocations[index]}
                />

                <MapCenterTracker setMapCenter={setMapCenter} />
                <MapClickHandler enabled={isAreaCreationMode} onLocationSelect={handleMapClick} />

                <TileLayer url={mapTileLayerUrl} />

                {isAreaCreationMode && (
                  <div className="map-mode-indicator" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1000,
                    pointerEvents: 'none'
                  }}>
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                      fontWeight: 'bold',
                      color: '#1890ff'
                    }}>
                      Click on the map to place your area
                    </div>
                  </div>
                )}

                <MapLayers
                  visibleLocations={visibleLocations}
                  visibleWifiLocations={visibleWifiLocations}
                  areas={areas}
                  mapSettings={mapSettings}
                  pngPath={pngPath}
                  loadBase64Image={loadBase64Image}
                />

                <MapLegend fetchedDevices={fetchedDevices} />
              </MapContainer>
            </Col>

            <DevicePanel fetchedDevices={fetchedDevices} devicePngArray={devicePngArray} />
          </Row>

          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '10px',
              borderRadius: '5px',
              fontSize: '14px',
              color: '#333'
            }}
          >
            <strong>Current Time: </strong>
            {currentTimestamp}
          </div>

          <Drawer
            title="More Information"
            placement="right"
            open={isDrawerVisible}
            width={400}
            onClose={onCloseDrawer}
          >
            {selectedLocation ? (
              <div>
                <p><strong>Latitude:</strong> {selectedLocation.latitude}</p>
                <p><strong>Longitude:</strong> {selectedLocation.longitude}</p>
                <p><strong>Speed:</strong> {selectedLocation.speed || 'N/A'} m/s</p>
                <p><strong>Timestamp:</strong> {selectedLocation.timestamp.toLocaleString()}</p>
              </div>
            ) : (
              <p>No additional information available</p>
            )}
          </Drawer>

          {renderFloatButtons()}

          <DeviceSelectionModal
            caseId={caseId}
            visible={isFileModalVisible}
            onClose={handleFileModalClose}
            onConfirm={handleFileConfirm}
          />
          <MapSettingsModal
            visible={isSettingsModalVisible}
            onClose={handleSettingsModalClose}
            onSave={handleSaveSettings}
            initialSettings={mapSettings}
          />
          <AreaCreationModal
            visible={isAreaModalVisible}
            onClose={handleAreaModalClose}
            onSave={handleSaveArea}
            currentMapCenter={mapCenter}
          />
        </Layout>
      </Layout>
    </div>
  );
};

export default Map;
