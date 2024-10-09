import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, Popup, TileLayer, Marker } from "react-leaflet";
import CustomMarker from "./CustomMarker";
// import locations from '../Data/data.json';
import { DatePicker, Button, Layout, Row, Col, Tooltip, Slider, Drawer   } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  StopOutlined, 
  StepForwardOutlined, 
  StepBackwardOutlined, 
  SoundOutlined,
  CaretRightOutlined
} from '@ant-design/icons';
import locationData from '../Data/data_iphone7.json';
import locationData2 from '../Data/data_iphonex.json';

const { Header } = Layout;

export default function Map() {
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [visibleLocations, setVisibleLocations] = useState([]);
  const [startDateTime, setStartDateTime] = useState(null);
  const [endDateTime, setEndDateTime] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [index, setIndex] = useState(1);
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null); // Store selected location data
  const [isDrawerVisible, setIsDrawerVisible] = useState(false); // State for drawer visibility

  // Dynamically load JSON files from the public/data folder
  useEffect(() => {
    const loadJsonFiles = async () => {
      try {
        const data = [locationData, locationData2]

        // Merge the locations from both files and assign colors
        const mergedLocations = [
          ...data[0].map(location => ({ ...location, color: 'red' })), // First file: red
          ...data[1].map(location => ({ ...location, color: 'green' })) // Second file: green
        ];
        setLocations(mergedLocations); // Set the merged locations
      } catch (error) {
        console.error('Error loading JSON files:', error);
      }
    };

    loadJsonFiles();
    
  }, []);





  const togglePlayPause = () => {
    console.log(playing)
    if (!playing) {
      startAnimation()
    } else if (playing) {
      stopAnimation()
    }

    setPlaying(!playing);

  };

  const stopVideo = () => {
    setPlaying(false);
  };



  const rewind = () => {
    setIndex( index - 10); 
  };

  const forward = () => {
    setIndex( index + 10); 
  };

  useEffect(() => {
    if (startDateTime && endDateTime) {
      const filtered = locations
        .filter((location) => {
          const locationTime = new Date(location['Timestamp Date/Time - UTC+00:00 (M/d/yyyy)']);
          return locationTime >= startDateTime && locationTime <= endDateTime;
        })
        .sort((a, b) => {
          const timeA = new Date(a['Timestamp Date/Time - UTC+00:00 (M/d/yyyy)']).getTime();
          const timeB = new Date(b['Timestamp Date/Time - UTC+00:00 (M/d/yyyy)']).getTime();
          return timeA - timeB; // Ascending order (oldest first)
        });
        
      setFilteredLocations(filtered);
    } else {
      setFilteredLocations([]);
    }
  }, [startDateTime, endDateTime]);

  const startAnimation = () => {
    setVisibleLocations([]);
    let index = 0;
    setIsPlaying(true);
    animationRef.current = setInterval(() => {
      if (index < filteredLocations.length) {
        setVisibleLocations((prev) => [...prev, filteredLocations[index]]);
        setIndex(index++);
      } else {
        stopAnimation();
      }
    }, 500); // Show a new point every 500ms
  };

  const stopAnimation = () => {
    setIsPlaying(false);
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }
  };

  const closeDrawer = () => {
    setIsDrawerVisible(false);
    setSelectedLocation(null);
  };

  const openDrawer = (location) => {
    setSelectedLocation(location);
    setIsDrawerVisible(true);
  };


  const currentTimestamp = filteredLocations[index - 1]?.['Timestamp Date/Time - UTC+00:00 (M/d/yyyy)'] || "N/A";

  return (
    <div>
      <Layout>
        <Header style={{ height: '64px', width:'100%', backgroundColor: '#993955',position: 'relative', zIndex:1200}}>
          <Row gutter={[16, 16]} align="middle">
            <Col>
              <DatePicker
                showTime
                value={startDateTime}
                onChange={(date) => setStartDateTime(date)}
                placeholder="Start DateTime"
              />
            </Col>
            <Col>
              <DatePicker
                showTime
                value={endDateTime}
                onChange={(date) => setEndDateTime(date)}
                placeholder="End DateTime"
              />
            </Col>
            <Col>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Button onClick={rewind} icon={<StepBackwardOutlined />} />
                <Button onClick={togglePlayPause} icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />} />
                <Button onClick={forward} icon={<StepForwardOutlined />} />
                
                <div style={{ marginLeft: '20px', display: 'flex', alignItems: 'center' }}>
                  <Slider 
                    style={{ width: 100 }} 
                    value={index}  
                    handleColor='#993955'
                    max={filteredLocations.length}
                  />
                  <span style={{ marginLeft: '10px' }}>
                    {index}/{filteredLocations.length || 1}
                  </span>
                </div>
              </div>
            </Col>
          </Row>
        </Header>
        <Layout>
        <MapContainer center={[40.4544416860082, -86.9043019950876]} zoom={13} style={{ height: '100vh', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {visibleLocations.map((location, index) => (
            <CustomMarker key={index} position={[location.Latitude, location.Longitude]} color={location.color}>
              <Popup>
                <div>
                  <p>{location.Comments || 'No additional information available'}</p>
                  {location['Speed (m/s)'] && <p>Speed: {location['Speed (m/s)']} m/s</p>}
                  <p>Timestamp: {location['Timestamp Date/Time - UTC+00:00 (M/d/yyyy)']}</p>
                  <Button type="link" onClick={() => openDrawer(location)}>More Info</Button> {/* More Info button */}
                </div>
              </Popup>
            </CustomMarker>
          ))}
        </MapContainer>
          {/* Date/Time Overlay */}
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)', // semi-transparent background
            padding: '10px',
            borderRadius: '5px',
            zIndex: 1250, // Make sure it stays on top of the map
            fontSize: '14px',
            color: '#333'
          }}>
            <strong>Current Time: </strong>{currentTimestamp}
          </div>
          {/* Drawer for More Info */}
        <Drawer
          title="More Information"
          placement="right"
          onClose={closeDrawer}
          visible={isDrawerVisible}
          width={400}
          style={{paddingTop:'15%'}}
        >
          {selectedLocation ? (
            <div>
              <p><strong>Latitude:</strong> {selectedLocation.Latitude}</p>
              <p><strong>Longitude:</strong> {selectedLocation.Longitude}</p>
              {selectedLocation['Speed (m/s)'] && <p><strong>Speed:</strong> {selectedLocation['Speed (m/s)']} m/s</p>}
              <p><strong>Timestamp:</strong> {selectedLocation['Timestamp Date/Time - UTC+00:00 (M/d/yyyy)']}</p>
              <p><strong>Comments:</strong> {selectedLocation.Comments || 'No additional information available'}</p>
            </div>
          ) : (
            <p>No additional information available</p>
          )}
        </Drawer>
        </Layout>
      </Layout>
    </div>
  );
}
