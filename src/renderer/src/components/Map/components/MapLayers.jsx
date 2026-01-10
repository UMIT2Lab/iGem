import React from 'react';
import { Popup, LayersControl, LayerGroup } from 'react-leaflet';
import { Image } from 'antd';
import CustomMarker from '../CustomMarker';
import CustomCircle from '../CustomCircle';
import PolylineDecorator from '../PolylineDecorator';
import colorSchemes from '../ColorSchemes';
import { formatMac } from '../utils/mapUtils';

const MapLayers = ({
  visibleLocations,
  visibleWifiLocations,
  areas,
  mapSettings,
  pngPath,
  loadBase64Image,
  onEditArea,
  onDeleteArea
}) => {
  return (
    <LayersControl position="topright">
      <LayersControl.Overlay checked name="GPS Locations">
        <LayerGroup>
          {visibleLocations.map((location, i) => (
            <CustomMarker
              key={i}
              position={[location.latitude, location.longitude]}
              ktx={location.hasKtxFile}
              mapDeviceId={location.mapDeviceId}
              appUsage={location.appUsage}
              markerSize={mapSettings.markerSize}
            >
              <Popup
                eventHandlers={{
                  add: () => {
                    if (location.hasKtxFile) {
                      loadBase64Image(location.ktxObj.filepath);
                    }
                  },
                }}
              >
                <div>
                  <p>Speed: {location.speed || 'N/A'} m/s</p>
                  <p>Timestamp: {location.timestamp.toLocaleString()}</p>
                  <p>Device Id: {location.mapDeviceId.toLocaleString()}</p>
                  {location.appUsage && (
                    <>
                      <p>Application: {location.appUsage.bundleIdentifier}</p>
                      <p>Type: {location.appUsage.type}</p>
                    </>
                  )}
                  {location.hasKtxFile && (
                    <>
                      <p>KTX Id: {location.ktxObj.filepath}</p>
                      {pngPath && (
                        <Image
                          src={pngPath}
                          alt="KTX Content"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '150px',
                            objectFit: 'contain',
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </Popup>
            </CustomMarker>
          ))}
          
          {mapSettings.showTrails && visibleLocations.length > 1 && (
            <PolylineDecorator
              deviceData={(() => {
                const groupedByDevice = visibleLocations.reduce((acc, location) => {
                  const deviceId = location.mapDeviceId;
                  if (!acc[deviceId]) {
                    acc[deviceId] = [];
                  }
                  acc[deviceId].push([location.latitude, location.longitude]);
                  return acc;
                }, {});

                return Object.keys(groupedByDevice).map(deviceId => ({
                  id: deviceId,
                  positions: groupedByDevice[deviceId],
                  color: colorSchemes[parseInt(deviceId) - 1]?.innerColor || '#3388ff'
                })).filter(device => device.positions.length >= 2);
              })()}
            />
          )}
        </LayerGroup>
      </LayersControl.Overlay>
      
      <LayersControl.Overlay name="WiFi Locations">
        <LayerGroup>
          {visibleWifiLocations.map((loc, idx) => (
            <CustomMarker
              key={idx}
              position={[loc.latitude, loc.longitude]}
              mapDeviceId={loc.mapDeviceId}
              markerSize={mapSettings.markerSize}
              wifi={true}
            >
              <Popup>
                <div>
                  <p>MAC: {formatMac(loc.mac)}</p>
                  <p>Timestamp: {loc.timestamp.toLocaleString()}</p>
                  <p>Channel: {loc.channel ?? 'N/A'}</p>
                  <p>Speed: {loc.speed ?? 'N/A'} m/s</p>
                  <p>Accuracy: {loc.horizontalAccuracy ?? 'N/A'} m</p>
                </div>
              </Popup>
            </CustomMarker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Areas">
        <LayerGroup>
          {areas.map((area, index) => (
            <CustomCircle 
              key={area.id || index} 
              area={area} 
              onEdit={onEditArea}
              onDelete={onDeleteArea}
            />
          ))}
        </LayerGroup>
      </LayersControl.Overlay>
    </LayersControl>
  );
};

export default MapLayers;
