import React, { useState, useEffect } from 'react'
import { Modal, Card, Upload, Button, Select, Space, message, Input, Form, Steps, Spin } from 'antd'
import {
  UploadOutlined,
  PlusOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  LoadingOutlined
} from '@ant-design/icons'

const { Option } = Select
const { ipcRenderer } = window.require('electron')
const fs = window.require('fs')
const path = window.require('path')

const DeviceSelectionModal = ({ visible, onClose }) => {
  const [devices, setDevices] = useState([])
  const [isAddingDevice, setIsAddingDevice] = useState(false) // Track if we're in form view
  const [newDevice, setNewDevice] = useState({
    name: '',
    imagePath: '',
    icon: null,
    created_at: null
  }) // Form state for new device
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [addedDeviceId, setAddedDeviceId] = useState(0)

  // Define the steps for the processing sequence
  const steps = [
    { title: 'Save Device Info', description: 'Saving device information to the database', key: 1 },
    { title: 'GPS Locations', description: 'Extracting GPS Locations into the DB', key: 2 },
    { title: 'KTX Files', description: 'Extracting KTX Files and Converting into images', key: 3 },
    {
      title: 'App Usage',
      description: 'Extracting app usage information from KnowledgeC database',
      key: 4
    },
    { title: 'Finish', description: '', key: 5 }
  ]

  // Load saved devices from the database on component mount
  useEffect(() => {
    ipcRenderer.invoke('get-devices').then((res) => setDevices(res.data))
  }, [])

  const handleFileChange = (file, index) => {
    if (file.type.includes('zip')) {
      const filePath = file.path
      if (index !== undefined) {
        const updatedDevices = [...devices]
        updatedDevices[index].zipFilePath = filePath
        setDevices(updatedDevices)
      } else {
        setNewDevice({ ...newDevice, imagePath: filePath }) // Update image path in form view
      }
      message.success('File selected!')
    } else {
      message.error('Please select a valid ZIP file.')
    }
    return false
  }

  // Define the removeDevice function
  const removeDevice = async (deviceId) => {
    try {
      const response = await ipcRenderer.invoke('remove-device', deviceId) // Call the IPC handler
      if (response.success) {
        message.success('Device removed successfully!')
        setDevices(devices.filter((device) => device.id !== deviceId)) // Update local device list
      } else {
        message.error('Failed to remove device')
        console.error('Error:', response.error)
      }
    } catch (error) {
      message.error('Error removing device')
      console.error('Error:', error)
    }
  }

  const handleFileRemove = (index) => {
    if (index !== undefined) {
      const updatedDevices = [...devices]
      updatedDevices[index].zipFilePath = null
      setDevices(updatedDevices)
    } else {
      setNewDevice({ ...newDevice, imagePath: '' })
    }
    message.success('File removed.')
  }

  const addDevice = () => {
    setIsAddingDevice(true) // Switch to form view
    setNewDevice({ name: '', imagePath: '', icon: null }) // Reset form fields
  }

  const handleBackToDeviceList = () => {
    setIsAddingDevice(false) // Go back to the device list view
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  const handleConfirmNewDevice = async () => {
    if (!newDevice.name || !newDevice.imagePath) {
      message.error('Please fill out all fields.')
      return
    }

    setLoading(true) // Show loading spinner
    setCurrentStep(0) // Start from the first step

    try {
      // // Step 1: Save Device Info
      const addDeviceResult = await ipcRenderer.invoke('add-device', {
        ...newDevice,
        created_at: Date.now()
      })
      if (!addDeviceResult.success) throw new Error('Failed to save device info')
      setAddedDeviceId(addDeviceResult.id)
      setCurrentStep(1) // Move to the next step

      // Step 2: Extract Files
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
      setCurrentStep(2) // Move to the next step
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

      setCurrentStep(3) // Move to the next step

      // Step 3: Process Data
      const processResponse = await ipcRenderer.invoke(
        'extract-knowledge-db',
        newDevice.imagePath,
        extractDir,
        addDeviceResult.id
      )
      console.log(processResponse)

      setCurrentStep(4) // Move to the next step
      await sleep(2 * 1000)

      // message.success('New device added and processed successfully.');
      // setDevices([...devices, { ...newDevice, id: saveResponse.deviceId, created_at: Date.now() }]); // Add the new device to the list
      // setIsAddingDevice(false); // Return to device list view
    } catch (error) {
      message.error(error.message || 'Error processing device')
    } finally {
      ipcRenderer.invoke('get-devices').then((res) => setDevices(res.data))
      setLoading(false) // Hide loading spinner
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
  return (
    <Modal
      title={isAddingDevice ? 'Add New Device' : 'Device List'}
      visible={visible}
      onCancel={onClose}
      onOk={isAddingDevice ? handleConfirmNewDevice : handleConfirm}
      okText={isAddingDevice ? 'Add Device' : 'Confirm'}
      // Add a customized button to the footer
      footer={[
        <Button key="submit" type="primary" onClick={isAddingDevice ? loading ? handleConfirmOnCancel : handleConfirmNewDevice : handleConfirm}>
          {isAddingDevice ? loading ? 'Cancel' : 'Add New Device' : 'Close'}
        </Button>,
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          {/* <Spin tip="Processing..."> */}
          <Steps current={currentStep} direction="vertical">
            {steps.map((item, index) => (
              <Steps.Step
                key={index}
                title={item.title}
                description={item.description}
                icon={item.key !== 1 && item.key === currentStep + 1 ? <LoadingOutlined /> : ''}
              />
            ))}
          </Steps>
          {/* </Spin> */}
        </div>
      ) : isAddingDevice ? (
        <div>
          <ArrowLeftOutlined
            onClick={handleBackToDeviceList}
            style={{ fontSize: 20, marginBottom: 20, cursor: 'pointer' }}
          />
          <Form layout="vertical">
            <Form.Item label="Device Name">
              <Input
                placeholder="Enter device name"
                value={newDevice.name}
                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="Select Image File">
              <Upload
                beforeUpload={(file) => handleFileChange(file)}
                onRemove={() => handleFileRemove()}
                showUploadList={{ showRemoveIcon: true }}
                fileList={
                  newDevice.imagePath
                    ? [{ uid: '-1', name: newDevice.imagePath.split('/').pop(), status: 'done' }]
                    : []
                }
              >
                <Button icon={<UploadOutlined />}>Select File</Button>
              </Upload>
            </Form.Item>
          </Form>
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {devices.map((device, index) => (
            <Card
              key={index}
              title={
                <span>
                  <strong>Device Name:</strong> {device.name}
                </span>
              }
              style={{ marginBottom: '10px' }}
              extra={
                <CloseOutlined
                  onClick={() => removeDevice(device.id)}
                  style={{ cursor: 'pointer' }}
                />
              }
            >
              <p>
                <strong>Device Image Path:</strong> {device.imagePath || 'N/A'}
              </p>
              <p>
                <strong>Device Process Date:</strong>{' '}
                {device.created_at ? new Date(device.created_at).toLocaleString() : 'N/A'}
              </p>
            </Card>
          ))}
          <Button
            icon={<PlusOutlined />}
            onClick={addDevice}
            style={{ width: '100%', marginTop: '10px' }}
          >
            Add Another Device
          </Button>
        </Space>
      )}
    </Modal>
  )
}

export default DeviceSelectionModal
