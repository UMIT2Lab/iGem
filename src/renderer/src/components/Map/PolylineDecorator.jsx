import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';

// Function to generate a consistent color from a string
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
};

const PolylineDecorator = (props) => {
  const map = useMap();
  const { 
    positions, 
    deviceData, 
    defaultColor = '#3388ff', 
    weight = 3, 
    opacity = 0.7, 
    patterns = null 
  } = props;
  
  useEffect(() => {
    // Keep track of all elements to remove them later
    const elements = [];
    console.log('PolylineDecorator rendering with:', { positions, deviceData });
    
    try {
      // Handle legacy single polyline format
      if (positions && positions.length >= 2) {
        console.log('Rendering single polyline with', positions.length, 'points');
        const polyline = L.polyline(positions, { color: defaultColor, weight, opacity });
        polyline.addTo(map);
        elements.push(polyline);
        
        const defaultPatterns = [
          {
            offset: 25,
            repeat: 50,
            symbol: L.Symbol.arrowHead({
              pixelSize: 15,
              pathOptions: { fillOpacity: 0.7, weight: 1, color: defaultColor }
            })
          }
        ];
        
        const decorator = L.polylineDecorator(polyline, {
          patterns: patterns || defaultPatterns
        }).addTo(map);
        elements.push(decorator);
      }
      
      // Handle device data format
      if (deviceData) {
        console.log('Rendering device data:', deviceData);
        
        // Convert to array if it's an object
        const devices = Array.isArray(deviceData) ? deviceData : 
                        Object.keys(deviceData).map(id => ({ 
                          id, 
                          positions: deviceData[id] 
                        }));
        
        devices.forEach(device => {
          const deviceId = device.id;
          const devicePositions = device.positions;
          
          // Generate color based on deviceId if not provided
          const deviceColor = device.color || stringToColor(deviceId || 'default');
          
          console.log(`Device ${deviceId}:`, { 
            positions: devicePositions?.length || 0, 
            color: deviceColor 
          });
          
          if (devicePositions && devicePositions.length >= 2) {
            // Create polyline for this device
            const polyline = L.polyline(devicePositions, { 
              color: deviceColor, 
              weight, 
              opacity 
            });
            
            polyline.addTo(map);
            elements.push(polyline);
            
            const devicePatterns = [
              {
                offset: 25,
                repeat: 50,
                symbol: L.Symbol.arrowHead({
                  pixelSize: 15,
                  pathOptions: { fillOpacity: 0.7, weight: 1, color: deviceColor }
                })
              }
            ];
            
            const decorator = L.polylineDecorator(polyline, {
              patterns: patterns || devicePatterns
            }).addTo(map);
            elements.push(decorator);
          }
        });
      }
    } catch (error) {
      console.error('Error rendering polylines:', error);
    }
    
    // Cleanup function
    return () => {
      console.log(`Cleaning up ${elements.length} map elements`);
      elements.forEach(element => {
        if (map && element) {
          try {
            map.removeLayer(element);
          } catch (e) {
            console.error('Error removing layer:', e);
          }
        }
      });
    };
  }, [map, positions, deviceData, defaultColor, weight, opacity, patterns]);
  
  return null;
};

export default PolylineDecorator;
