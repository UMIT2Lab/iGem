import React, { useState, useEffect } from 'react'
import { Modal, Button, message } from 'antd'
import DeviceListView from './DeviceListView'
import AddDeviceFormView from './AddDeviceFormView'
import ProcessingStepsView from './ProcessingStepsView'
import { LoadingOutlined } from '@ant-design/icons'
const { ipcRenderer } = window.require('electron')
const fs = window.require('fs')
const path = window.require('path')

// Define processing steps that will be consistent across the application
const processingSteps = [
  { title: 'Save Device Info', description: 'Saving device metadata' },
  { title: 'Extract Location Data', description: 'Extracting location information' },
  { title: 'Extract App Usage', description: 'Processing app usage data' },
  { title: 'Extract KTX Files', description: 'Processing device KTX files' },
  { title: 'Extract WiFi Locations', description: 'Extracting Wifi Locations' },
  { title: 'Complete', description: 'Processing complete!' }
];

const DeviceSelectionModal = ({ visible, onClose, caseId }) => {
  const [devices, setDevices] = useState([])
  const [isAddingDevice, setIsAddingDevice] = useState(false)
  const [newDevice, setNewDevice] = useState({
    name: '',
    imagePaths: [],
    icon: null,
    created_at: null
  });
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [addedDeviceId, setAddedDeviceId] = useState(0)

  // Load saved devices from the database when modal becomes visible
  useEffect(() => {
    if (visible) {
      ipcRenderer.invoke('get-devices', caseId).then((res) => setDevices(res.data))
    }
  }, [visible, caseId])

  const handleFileChange = (file) => {
    if (file.type.includes('zip')) {
      const filePath = file.path;
      setNewDevice((prevDevice) => ({
        ...prevDevice,
        imagePaths: [...prevDevice.imagePaths, filePath],
      }));
      console.log(newDevice)
      message.success('File selected!');
    } else {
      message.error('Please select a valid ZIP file.');
    }
    return false; // Prevent automatic upload
  };

  // Define the removeDevice function
  const removeDevice = async (deviceId) => {
    try {
      const response = await ipcRenderer.invoke('remove-device', deviceId)
      if (response.success) {
        message.success('Device removed successfully!')
        setDevices(devices.filter((device) => device.id !== deviceId))
      } else {
        message.error('Failed to remove device')
        console.error('Error:', response.error)
      }
    } catch (error) {
      message.error('Error removing device')
      console.error('Error:', error)
    }
  }

  const handleFileRemove = (file) => {
    setNewDevice((prevDevice) => ({
      ...prevDevice,
      imagePaths: prevDevice.imagePaths.filter((path) => path !== file.path),
    }));
    message.success('File removed.');
  };

  const addDevice = () => {
    setIsAddingDevice(true)
    setNewDevice({
      name: '',
      imagePaths: [],
      icon: null
    })
  }

  const handleBackToDeviceList = () => {
    setIsAddingDevice(false)
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  
  const handleConfirmNewDevice = async () => {
    if (!newDevice.name || !newDevice.imagePaths.length === 0) {
      message.error('Please fill out all fields.')
      return
    }

    setLoading(true)
    setCurrentStep(0)

    try {
      // Step 1: Save Device Info
      const addDeviceResult = await ipcRenderer.invoke('add-device', {
        ...newDevice,
        created_at: Date.now(),
        caseId: caseId // Include the caseId when saving the device
      })
      if (!addDeviceResult.success) throw new Error('Failed to save device info')
      setAddedDeviceId(addDeviceResult.id)
      setCurrentStep(1)

      // // Step 2: Extract Files
      const extractDir = path.join(window.require('os').tmpdir(), `extracted-device-${Date.now()}`)
      if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true })
      console.log(extractDir)

      const result = await ipcRenderer.invoke('process-zip-file', {
        zipFilePath: newDevice.imagePath,
        extractDir: extractDir,
        deviceId: addDeviceResult.id
      })
      console.log(extractDir)
      if (!result.success) throw new Error('Failed to extract files')
      setCurrentStep(2)
      
      console.log(extractDir)
      const result2 = await ipcRenderer.invoke(
        'extract-matching-files',
        newDevice.imagePath,
        extractDir,
        addDeviceResult.id
      )
      if (result2.success) {
        console.log(result2.message)
      } else {
        console.error('Extraction failed:', result2.message)
      }

      setCurrentStep(3)

      // Step 3: Process Data
      const processResponse = await ipcRenderer.invoke(
        'extract-knowledge-db',
        newDevice.imagePath,
        extractDir,
        addDeviceResult.id
      )
      console.log(processResponse)

      setCurrentStep(4)

      // Step 4: Wifi Location Data
      const wifiLocationResponse = await ipcRenderer.invoke(
        'extract-wifi-locations',
        newDevice.imagePath,
        extractDir,
        addDeviceResult.id
      )
      console.log(wifiLocationResponse)

      setCurrentStep(5)
      await sleep(2 * 1000)

      // Add the new device to the existing list instead of refetching all
      const newDeviceResponse = await ipcRenderer.invoke('get-devices', caseId);
      setDevices(newDeviceResponse.data);

    } catch (error) {
      message.error(error.message || 'Error processing device')
    } finally {
      setLoading(false)
      setIsAddingDevice(false)
    }
  }

  const handleConfirm = async () => {
    onClose()
  }
  
  const handleConfirmOnCancel = async () => {
    console.log(addedDeviceId)
    await removeDevice(addedDeviceId)
    setLoading(false)
    onClose()
  }
  
  // Determine which content to render based on state
  const renderModalContent = () => {
    if (loading) {
      return <ProcessingStepsView steps={processingSteps} currentStep={currentStep} direction="vertical"/>
    } else if (isAddingDevice) {
      return (
        <AddDeviceFormView 
          newDevice={newDevice}
          setNewDevice={setNewDevice}
          handleFileChange={handleFileChange}
          handleFileRemove={handleFileRemove}
          onBack={handleBackToDeviceList}
        />
      )
    } else {
      return (
        <DeviceListView
          devices={devices}
          onRemoveDevice={removeDevice}
          onAddDevice={addDevice}
        />
      )
    }
  }

  return (
    <Modal
      title={isAddingDevice ? 'Add New Device' : 'Device List'}
      visible={visible}
      onCancel={onClose}
      onOk={isAddingDevice ? handleConfirmNewDevice : handleConfirm}
      okText={isAddingDevice ? 'Add Device' : 'Confirm'}
      footer={loading ? null :
        [
          <Button key="submit" type="primary" onClick={isAddingDevice ? handleConfirmNewDevice : handleConfirm}>
            {isAddingDevice ? loading ? 'Cancel' : 'Add New Device' : 'Close'}
          </Button>,
        ]}
    >
      {renderModalContent()}
    </Modal>
  )
}

export default DeviceSelectionModal
