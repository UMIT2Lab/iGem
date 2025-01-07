import { useEffect, useState, useRef } from 'react'
import CustomMarker from './CustomMarker'
import {
  DatePicker,
  Button,
  Layout,
  Row,
  Col,
  Slider,
  Drawer,
  FloatButton,
  Image,
  Card,
  Space,
  Descriptions
} from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepForwardOutlined,
  StepBackwardOutlined,
  SettingOutlined,
  AppstoreAddOutlined,
  ControlOutlined
} from '@ant-design/icons'
import { MapContainer, TileLayer, Popup, LayersControl, LayerGroup } from 'react-leaflet'
import DeviceSelectionModal from '../Modals/DeviceSelectionModal'
import colorSchemes from './ColorSchemes'
import 'leaflet/dist/leaflet.css'
import logo from '../../assets/logo.png'
const { Meta } = Card
const { Header } = Layout
const { ipcRenderer } = window.require('electron') // Import ipcRenderer for database fetching

export default function Map() {
  const [filteredLocations, setFilteredLocations] = useState([])
  const [visibleLocations, setVisibleLocations] = useState([])
  const [startDateTime, setStartDateTime] = useState(null)
  const [endDateTime, setEndDateTime] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const animationRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [isFileModalVisible, setIsFileModalVisible] = useState(false)
  const [ktxFiles, setKtxFiles] = useState([])
  const [matchedLocations, setMatchedLocations] = useState([])
  const [pngPath, setPngPath] = useState(null) // Store path to PNG image
  const [devicePngArray, setDevicePngArray] = useState([]) // Store path to PNG image

  const [sliderValue, setSliderValue] = useState(0)
  const [fetchedDevices, setFetchedDevices] = useState([])

  const loadBase64Image = async (ktxFilePath) => {
    try {
      console.log(ktxFilePath)
      const base64Image = await ipcRenderer.invoke('convert-ktx-to-png', ktxFilePath)
      console.log(base64Image)
      setPngPath(base64Image) // Directly set base64 string in the img src
    } catch (error) {
      console.error('Error loading KTX file:', error)
    }
  }

  const deviceKTXImageLoad = async (ktxFilePath, id) => {
    try {
      console.log(ktxFilePath);

      // Invoke the function to get the base64 image
      const base64Image = await ipcRenderer.invoke('convert-ktx-to-png', ktxFilePath);
      console.log(base64Image);

      // Update devicePngArray state
      setDevicePngArray((prevArray) => {
        const updatedArray = [...prevArray];
        const index = id - 1; // Map deviceId to index
        updatedArray[index] = base64Image;
        return updatedArray;
      });

      return base64Image;
    } catch (error) {
      console.error('Error loading KTX file:', error);
    }
  };
  const matchKtxToLocations = (locations, ktxFiles) => {
    // Track matched `.ktx` files
    const matchedKtxFiles = new Set()

    const matchedLocations = locations.map((location) => {
      // Filter `.ktx` files by the same deviceId and exclude already matched files
      const availableKtxFiles = ktxFiles.filter(
        (file) => file.deviceId === location.deviceId && !matchedKtxFiles.has(file)
      )

      // Find the closest KTX file by timestamp, within a 20-second threshold
      const closestKtxFile =
        availableKtxFiles.length > 0
          ? availableKtxFiles.reduce((prev, curr) => {
            const prevDiff = Math.abs(location.timestamp - prev.timestamp)
            const currDiff = Math.abs(location.timestamp - curr.timestamp)
            return currDiff < prevDiff ? curr : prev
          })
          : null // If no matching `.ktx` files, set to null

      // Check if the closest KTX file is within the 20-second threshold
      const isWithinThreshold = closestKtxFile
        ? Math.abs(location.timestamp - closestKtxFile.timestamp) <= 20000 // 20 seconds in milliseconds
        : false

      // Mark the matched `.ktx` file as used if within the threshold
      if (closestKtxFile && isWithinThreshold) {
        matchedKtxFiles.add(closestKtxFile)
      }

      return {
        ...location,
        hasKtxFile: isWithinThreshold, // True if a match is within the threshold
        ktxObj: isWithinThreshold ? closestKtxFile : null // Closest `.ktx` file or null if no match
      }
    })

    // Sort the matched locations by timestamp
    const sortedMatchedLocations = matchedLocations.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    )

    console.log(sortedMatchedLocations)

    // Update state
    setMatchedLocations(sortedMatchedLocations)
  }

  const handleFileModalOpen = () => {
    setIsFileModalVisible(true)
  }

  const handleFileModalClose = () => {
    setIsFileModalVisible(false)
  }

  const handleFileConfirm = (file) => {
    console.log('File added:', file)
  }

  const onClose = () => {
    setIsDrawerVisible(false)
  }

  useEffect(() => {
    const fetchData = async () => {
      // Fetch device information from the backend
      const devicesResponse = await ipcRenderer.invoke('get-devices')
      const devices = devicesResponse.data
      console.log(devicesResponse)
      const allLocations = []
      const allKtxFiles = []
      const allAppUsage = []
      let c = 1
      console.log(devicesResponse)
      setFetchedDevices([])
      // Loop through each device to fetch its locations, .ktx files, and app usage data
      for (const device of devices) {
        const deviceLocationsResponse = await ipcRenderer.invoke('get-device-locations', device.id)
        const ktxFilesResponse = await ipcRenderer.invoke('get-ktx-files', device.id)
        const appUsageResponse = await ipcRenderer.invoke('get-app-usage', device.id)

        if (
          deviceLocationsResponse.success &&
          ktxFilesResponse.success &&
          appUsageResponse.success
        ) {
          const deviceLocations = deviceLocationsResponse.data.map((location) => ({
            ...location,
            timestamp: new Date(location.timestamp),
            mapDeviceId: c,
            deviceId: device.id
          }))

          const deviceKtxFiles = ktxFilesResponse.data.map((file) => ({
            ...file,
            timestamp: new Date(file.timestamp),
            deviceId: device.id
          }))

          const deviceAppUsage = appUsageResponse.data.map((appUsage) => ({
            ...appUsage,
            startTime: new Date(appUsage.startTime),
            endTime: new Date(appUsage.endTime),
            deviceId: device.id
          }))
          console.log(deviceAppUsage)
          allLocations.push(...deviceLocations)
          allKtxFiles.push(...deviceKtxFiles)
          allAppUsage.push(...deviceAppUsage)
        }
        setFetchedDevices((prevDevices) => [...prevDevices, { name: device.name, id: c }])
        c += 1
      }

      console.log(fetchedDevices)
      // Merge app usage data with locations
      const matchedLocations = allLocations.map((location) => {
        const matchingAppUsage = allAppUsage.find(
          (appUsage) =>
            appUsage.deviceId === location.deviceId &&
            appUsage.startTime <= location.timestamp &&
            appUsage.endTime >= location.timestamp
        )
        // console.log(location, matchingAppUsage)
        return {
          ...location,
          appUsage: matchingAppUsage || null
        }
      })

      setLocations(allLocations)
      setKtxFiles(allKtxFiles)
      matchKtxToLocations(matchedLocations, allKtxFiles)
      console.log(matchedLocations.filter((x) => x.appUsage != null))
    }

    fetchData()
  }, [isFileModalVisible])

  const togglePlayPause = () => {
    if (isPlaying) {
      clearInterval(animationRef.current)
    } else {
      startAnimation()
    }
    setIsPlaying(!isPlaying)
  }

  const forward = () => {
    const newIndex = Math.min(index + 10, filteredLocations.length - 1)
    setIndex(newIndex)
    updateVisibleLocations(newIndex)
  }

  const backward = () => {
    const newIndex = Math.max(index - 10, 0)
    setIndex(newIndex)
    updateVisibleLocations(newIndex)
  }

  useEffect(() => {
    setVisibleLocations([])
    if (startDateTime && endDateTime) {
      const filtered = matchedLocations
        .filter(
          (location) =>
            Date.parse(location.timestamp) >= Date.parse(startDateTime) &&
            Date.parse(location.timestamp) <= Date.parse(endDateTime)
        )
        .sort((a, b) => a.timestamp - b.timestamp)
      setFilteredLocations(filtered)
    } else {
      setFilteredLocations([])
    }
  }, [startDateTime, endDateTime, matchedLocations])

  const startAnimation = () => {
    animationRef.current = setInterval(() => {
      setIndex((prevIndex) => {
        if (prevIndex < filteredLocations.length - 1) {
          const nextIndex = prevIndex + 1;
          const currentLocation = filteredLocations[nextIndex];

          // Update visible locations
          updateVisibleLocations(nextIndex);

          // Check and load the image if required
          if (currentLocation.hasKtxFile) {
            loadBase64Image(currentLocation.ktxObj.filepath);

          }

          // Update the `fetchedDevices` array by matching `deviceId`
          setFetchedDevices((prevDevices) => {
            const updatedDevices = prevDevices.map((device) => {
              console.log(currentLocation)
              if (device.id === currentLocation.mapDeviceId) {
                console.log("Updating Device:", device.name);
                if (currentLocation.hasKtxFile) {
                  deviceKTXImageLoad(currentLocation.ktxObj.filepath, device.id)

                }
                return { ...device, lastLocation: currentLocation };
              }
              return device;
            });
            console.log("Updated Devices:", updatedDevices);
            return updatedDevices;
          });
          return nextIndex;
        } else {
          clearInterval(animationRef.current);
          return prevIndex; // Return the last index to stop further updates
        }
      });
    }, 500);
  };



  const sliderUpdate = (newIndex) => {
    setIndex(newIndex)
    updateVisibleLocations(newIndex)
  }

  const updateVisibleLocations = (newIndex) => {
    const recentLocations = filteredLocations.slice(0, newIndex + 1)
    // const recentLocations = newIndex > 4 ? filteredLocations.slice(newIndex - 4, newIndex + 1) : filteredLocations.slice(0, newIndex + 1);
    setVisibleLocations(recentLocations)
  }

  const closeDrawer = () => {
    setIsDrawerVisible(false)
    setSelectedLocation(null)
  }

  const openDrawer = (location) => {
    setSelectedLocation(location)
    setIsDrawerVisible(true)
  }

  const currentTimestamp = filteredLocations[index]?.timestamp.toLocaleString() || 'N/A'

  return (
    <div>
      <Layout style={{ height: '100vh' }}>
        <Header
          style={{
            height: '64px',
            width: '100%',
            backgroundColor: '#a1c2e4',
            position: 'relative'
          }}
        >
          <Row gutter={[16, 16]} align="middle">
          <Image src={logo} width={150} preview={false}/>

            <Col>
              <DatePicker showTime value={startDateTime} onChange={(date) => setStartDateTime(date)} placeholder="Start DateTime" />
            </Col>
            <Col>
              <DatePicker showTime value={endDateTime} onChange={(date) => setEndDateTime(date)} placeholder="End DateTime" />
            </Col>
            <Col>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Button onClick={backward} icon={<StepBackwardOutlined />} />
                <Button onClick={togglePlayPause} icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />} />
                <Button onClick={forward} icon={<StepForwardOutlined />} />
                <Slider style={{ width: 100, marginLeft: 20 }} value={index} onChange={sliderUpdate} tooltip={{ open: false }} max={filteredLocations.length - 1} step={1} />
                <span style={{ marginLeft: '10px' }}>{index}/{filteredLocations.length || 1}</span>
              </div>
            </Col>
          </Row>
        </Header>
        <Layout>
          <Row>
            <Col span={18}>
              <MapContainer center={[40.454, -86.904]} zoom={4} style={{ width: '100%', height: 'calc(100vh - 64px)', }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
                      >
                        <Popup
                          eventHandlers={{
                            add: () => {
                              // Automatically load KTX file when the popup is added to the map
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
                            {location.appUsage != null && (
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
                                      maxWidth: '100%', // Ensures the image doesn’t exceed the popup width
                                      maxHeight: '150px', // Adjusts the height to fit within the popup’s visible area
                                      objectFit: 'contain', // Scales the image while preserving aspect ratio
                                    }}
                                  />
                                )}
                              </>
                            )}
                            {/* <Button type="link" onClick={() => openDrawer(location)}>More Info</Button> */}
                          </div>
                        </Popup>
                      </CustomMarker>
                    ))}
                    </LayerGroup>
                  </LayersControl.Overlay>
                </LayersControl>
                {/* Legend Card */}
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  zIndex: 1000, // Ensures the legend is above the map
                }}>
                  <Card
                    title="Legend"
                    bordered={true}
                    style={{
                      width: 200,
                      opacity: 0.9, // Makes the card semi-transparent
                    }}
                  >
                    {fetchedDevices.map(device =>
                      <div
                        style={{
                          display: "flex", // Aligns items horizontally
                          alignItems: "center", // Vertically aligns items
                          gap: "8px", // Adds spacing between the logo and name
                        }}
                      >
                        {/* Logo */}
                        <div
                          style={{
                            position: "relative",
                            backgroundColor: colorSchemes[device.id - 1].innerColor, // Dynamic value
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            border: `4px solid ${colorSchemes[device.id - 1].borderColorAbsent}`, // Dynamic value
                          }}
                        >
                          {device.id}
                        </div>

                        {/* Device Name */}
                        <span
                          style={{
                            fontSize: "12px", // Match the text size with the logo
                            fontWeight: "normal",
                            color: "#333", // Optional: Define text color
                          }}
                        >
                          {device.name}
                        </span>
                      </div>

                    )}
                  </Card>
                </div>
              </MapContainer>
            </Col>
            <Col span={6} >
              <Space
                direction="vertical"
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', padding: 30 }}
              >
                {fetchedDevices.map((device) => (
                  <>
                    <Card
                      title={
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              backgroundColor: colorSchemes[device.id - 1].innerColor, // Dynamic value
                              width: "30px",
                              height: "30px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontSize: "12px",
                              fontWeight: "bold",
                              border: `4px solid ${colorSchemes[device.id - 1].borderColorAbsent}`, // Dynamic value
                            }}
                          >
                            {device.id}
                          </div>
                          <span>{device.name}</span>

                        </div>
                      }
                    >

                      <Row>
                        <Col span={6}>
                          <Image
                            src={devicePngArray[device.id - 1] != undefined ? devicePngArray[device.id - 1] : ''}
                            height={'100%'}
                            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3PTWBSGcbGzM6GCKqlIBRV0dHRJFarQ0eUT8LH4BnRU0NHR0UEFVdIlFRV7TzRksomPY8uykTk/zewQfKw/9znv4yvJynLv4uLiV2dBoDiBf4qP3/ARuCRABEFAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghggQAQZQKAnYEaQBAQaASKIAQJEkAEEegJmBElAoBEgghgg0Aj8i0JO4OzsrPv69Wv+hi2qPHr0qNvf39+iI97soRIh4f3z58/u7du3SXX7Xt7Z2enevHmzfQe+oSN2apSAPj09TSrb+XKI/f379+08+A0cNRE2ANkupk+ACNPvkSPcAAEibACyXUyfABGm3yNHuAECRNgAZLuYPgEirKlHu7u7XdyytGwHAd8jjNyng4OD7vnz51dbPT8/7z58+NB9+/bt6jU/TI+AGWHEnrx48eJ/EsSmHzx40L18+fLyzxF3ZVMjEyDCiEDjMYZZS5wiPXnyZFbJaxMhQIQRGzHvWR7XCyOCXsOmiDAi1HmPMMQjDpbpEiDCiL358eNHurW/5SnWdIBbXiDCiA38/Pnzrce2YyZ4//59F3ePLNMl4PbpiL2J0L979+7yDtHDhw8vtzzvdGnEXdvUigSIsCLAWavHp/+qM0BcXMd/q25n1vF57TYBp0a3mUzilePj4+7k5KSLb6gt6ydAhPUzXnoPR0dHl79WGTNCfBnn1uvSCJdegQhLI1vvCk+fPu2ePXt2tZOYEV6/fn31dz+shwAR1sP1cqvLntbEN9MxA9xcYjsxS1jWR4AIa2Ibzx0tc44fYX/16lV6NDFLXH+YL32jwiACRBiEbf5KcXoTIsQSpzXx4N28Ja4BQoK7rgXiydbHjx/P25TaQAJEGAguWy0+2Q8PD6/Ki4R8EVl+bzBOnZY95fq9rj9zAkTI2SxdidBHqG9+skdw43borCXO/ZcJdraPWdv22uIEiLA4q7nvvCug8WTqzQveOH26fodo7g6uFe/a17W3+nFBAkRYENRdb1vkkz1CH9cPsVy/jrhr27PqMYvENYNlHAIesRiBYwRy0V+8iXP8+/fvX11Mr7L7ECueb/r48eMqm7FuI2BGWDEG8cm+7G3NEOfmdcTQw4h9/55lhm7DekRYKQPZF2ArbXTAyu4kDYB2YxUzwg0gi/41ztHnfQG26HbGel/crVrm7tNY+/1btkOEAZ2M05r4FB7r9GbAIdxaZYrHdOsgJ/wCEQY0J74TmOKnbxxT9n3FgGGWWsVdowHtjt9Nnvf7yQM2aZU/TIAIAxrw6dOnAWtZZcoEnBpNuTuObWMEiLAx1HY0ZQJEmHJ3HNvGCBBhY6jtaMoEiJB0Z29vL6ls58vxPcO8/zfrdo5qvKO+d3Fx8Wu8zf1dW4p/cPzLly/dtv9Ts/EbcvGAHhHyfBIhZ6NSiIBTo0LNNtScABFyNiqFCBChULMNNSdAhJyNSiECRCjUbEPNCRAhZ6NSiAARCjXbUHMCRMjZqBQiQIRCzTbUnAARcjYqhQgQoVCzDTUnQIScjUohAkQo1GxDzQkQIWejUogAEQo121BzAkTI2agUIkCEQs021JwAEXI2KoUIEKFQsw01J0CEnI1KIQJEKNRsQ80JECFno1KIABEKNdtQcwJEyNmoFCJAhELNNtScABFyNiqFCBChULMNNSdAhJyNSiECRCjUbEPNCRAhZ6NSiAARCjXbUHMCRMjZqBQiQIRCzTbUnAARcjYqhQgQoVCzDTUnQIScjUohAkQo1GxDzQkQIWejUogAEQo121BzAkTI2agUIkCEQs021JwAEXI2KoUIEKFQsw01J0CEnI1KIQJEKNRsQ80JECFno1KIABEKNdtQcwJEyNmoFCJAhELNNtScABFyNiqFCBChULMNNSdAhJyNSiECRCjUbEPNCRAhZ6NSiAARCjXbUHMCRMjZqBQiQIRCzTbUnAARcjYqhQgQoVCzDTUnQIScjUohAkQo1GxDzQkQIWejUogAEQo121BzAkTI2agUIkCEQs021JwAEXI2KoUIEKFQsw01J0CEnI1KIQJEKNRsQ80JECFno1KIABEKNdtQcwJEyNmoFCJAhELNNtScABFyNiqFCBChULMNNSdAhJyNSiEC/wGgKKC4YMA4TAAAAABJRU5ErkJggg=="
                          />
                        </Col>
                        <Col span={18}>

                          <div style={{ padding: 10 }}>
                            <p>Speed: {device.lastLocation != null ? device.lastLocation.speed : ''} m/s</p>
                            <p>Timestamp: {device.lastLocation != null ? device.lastLocation.timestamp.toLocaleString() : ''} </p>
                            <p>Bundle Identifier: {device.lastLocation != null && device.lastLocation.appUsage != null ? device.lastLocation.appUsage.bundleIdentifier : ''} </p>
                            <p>In Use Type: {device.lastLocation != null && device.lastLocation.appUsage != null ? device.lastLocation.appUsage.type : ''} </p>
                            <p>In Use Application Start Time: {device.lastLocation != null && device.lastLocation.appUsage != null ? device.lastLocation.appUsage.startTime.toLocaleString() : ''} </p>
                            <p>In Use Application End Time: {device.lastLocation != null && device.lastLocation.appUsage != null ? device.lastLocation.appUsage.endTime.toLocaleString() : ''} </p>

                          </div>
                        </Col>
                      </Row>
                    </Card>
                  </>
                ))}
              </Space>
            </Col>
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
            onClose={onClose}
          >
            {selectedLocation ? (
              <div>
                <p>
                  <strong>Latitude:</strong> {selectedLocation.latitude}
                </p>
                <p>
                  <strong>Longitude:</strong> {selectedLocation.longitude}
                </p>
                <p>
                  <strong>Speed:</strong> {selectedLocation.speed || 'N/A'} m/s
                </p>
                <p>
                  <strong>Timestamp:</strong> {selectedLocation.timestamp.toLocaleString()}
                </p>
              </div>
            ) : (
              <p>No additional information available</p>
            )}
          </Drawer>
          <FloatButton.Group
            trigger="click"
            type="primary"
            style={{ insetInlineEnd: 24 }}
            icon={<SettingOutlined />}
          >
            <FloatButton icon={<ControlOutlined />} />
            <FloatButton icon={<AppstoreAddOutlined />} onClick={handleFileModalOpen} />
          </FloatButton.Group>
          <DeviceSelectionModal
            visible={isFileModalVisible}
            onClose={handleFileModalClose}
            onConfirm={handleFileConfirm}
          />
        </Layout>
      </Layout>
    </div>
  )
}
