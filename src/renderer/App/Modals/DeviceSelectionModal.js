import React, { useState, useEffect } from 'react';
import { Modal, Card, Upload, Button, Select, Space, message, Input, Form, Steps, Spin } from 'antd';
import { UploadOutlined, PlusOutlined, CloseOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { Option } = Select;
const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');

const DeviceSelectionModal = ({ visible, onClose }) => {
  const [devices, setDevices] = useState([]);
  const [isAddingDevice, setIsAddingDevice] = useState(false); // Track if we're in form view
  const [newDevice, setNewDevice] = useState({ name: '', imagePath: '', icon: null, created_at: null }); // Form state for new device
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Define the steps for the processing sequence
  const steps = [
    { title: 'Save Device Info', description: 'Saving device information to the database'  },
    { title: 'GPS Locations',  description: 'Extracting GPS Locations into the DB'  },
    { title: 'KTX Files',  description: 'Extracting KTX Files and Converting into images'  },
  ];

  // Load saved devices from the database on component mount
  useEffect(() => {
    ipcRenderer.invoke('get-devices').then((res) => setDevices(res.data));
  }, []);

  const handleIconChange = (icon, index) => {
    if (index !== undefined) {
      const updatedDevices = [...devices];
      updatedDevices[index].icon = icon;
      setDevices(updatedDevices);
    } else {
      setNewDevice({ ...newDevice, icon }); // Update icon in form view
    }
  };

  const handleFileChange = (file, index) => {
    if (file.type.includes('zip')) {
      const filePath = file.path;
      if (index !== undefined) {
        const updatedDevices = [...devices];
        updatedDevices[index].zipFilePath = filePath;
        setDevices(updatedDevices);
      } else {
        setNewDevice({ ...newDevice, imagePath: filePath }); // Update image path in form view
      }
      message.success('File selected!');
    } else {
      message.error('Please select a valid ZIP file.');
    }
    return false;
  };

  // Define the removeDevice function
  const removeDevice = async (deviceId) => {

    try {
      const response = await ipcRenderer.invoke('remove-device', deviceId); // Call the IPC handler
      if (response.success) {
        message.success('Device removed successfully!');
        setDevices(devices.filter((device) => device.id !== deviceId)); // Update local device list
      } else {
        message.error('Failed to remove device');
        console.error('Error:', response.error);
      }
    } catch (error) {
      message.error('Error removing device');
      console.error('Error:', error);
    }
  };

  const handleFileRemove = (index) => {
    if (index !== undefined) {
      const updatedDevices = [...devices];
      updatedDevices[index].zipFilePath = null;
      setDevices(updatedDevices);
    } else {
      setNewDevice({ ...newDevice, imagePath: '' });
    }
    message.success('File removed.');
  };

  const addDevice = () => {
    setIsAddingDevice(true); // Switch to form view
    setNewDevice({ name: '', imagePath: '', icon: null }); // Reset form fields
  };

  const handleBackToDeviceList = () => {
    setIsAddingDevice(false); // Go back to the device list view
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  const handleConfirmNewDevice = async () => {
    if (!newDevice.name || !newDevice.imagePath || !newDevice.icon) {
      message.error('Please fill out all fields.');
      return;
    }

    setLoading(true); // Show loading spinner
    setCurrentStep(0); // Start from the first step

    try {
      // Step 1: Save Device Info
      const addDeviceResult = await ipcRenderer.invoke('add-device', { ...newDevice, created_at: Date.now() });
      if (!addDeviceResult.success) throw new Error('Failed to save device info');
      setCurrentStep(1); // Move to the next step

      // Step 2: Extract Files
      const extractDir = path.join(window.require('os').tmpdir(), `extracted-device-${Date.now()}`);
      if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });
      
      const result = await ipcRenderer.invoke('process-zip-file', {
        icon: newDevice.icon,
        zipFilePath: newDevice.imagePath,
        extractDir: extractDir,
        deviceId: addDeviceResult.id
      });      
      console.log(result)
      if (!result.success) throw new Error('Failed to extract files');
      setCurrentStep(2); // Move to the next step
      try {
        const result = await ipcRenderer.invoke('extract-matching-files', newDevice.imagePath, extractDir);
        if (result.success) {
          console.log(result.message);
        } else {
          console.error('Extraction failed:', result.message);
        }
      } catch (error) {
        console.error('Error in extraction:', error);
      }

      // // Step 3: Process Data
      // const processResponse = await ipcRenderer.invoke('process-device-data', { deviceId: saveResponse.deviceId, extractDir });
      // if (!processResponse.success) throw new Error('Failed to process device data');
      
      // setCurrentStep(3); // Move to the next step
      await sleep(2 * 1000);


      // message.success('New device added and processed successfully.');
      // setDevices([...devices, { ...newDevice, id: saveResponse.deviceId, created_at: Date.now() }]); // Add the new device to the list
      // setIsAddingDevice(false); // Return to device list view
    } catch (error) {
      message.error(error.message || 'Error processing device');
    } finally {
      setLoading(false); // Hide loading spinner
      setIsAddingDevice(false)
    }
  };

  const handleConfirm = async () => {
    for (const device of devices) {
      if (!device.icon || !device.zipFilePath) {
        message.error('Please select an icon and a ZIP file for each device.');
        return;
      }
    }
    message.success('All devices processed and saved.');
    onClose();
  };

  return (
    <Modal
      title={isAddingDevice ? 'Add New Device' : 'Device List'}
      visible={visible}
      onCancel={onClose}
      onOk={isAddingDevice ? handleConfirmNewDevice : handleConfirm}
      okText={isAddingDevice ? 'Add Device' : 'Confirm'}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          {/* <Spin tip="Processing..."> */}
            <Steps progressDot current={currentStep} direction="vertical">
              {steps.map((item, index) => (
                <Steps.Step key={index} title={item.title} description={item.description}/>
              ))}
            </Steps>
          {/* </Spin> */}
        </div>
      ) : isAddingDevice ? (
        <div>
          <ArrowLeftOutlined onClick={handleBackToDeviceList} style={{ fontSize: 20, marginBottom: 20, cursor: 'pointer' }} />
          <Form layout="vertical">
            <Form.Item label="Device Name">
              <Input
                placeholder="Enter device name"
                value={newDevice.name}
                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="Select Icon">
              <Select
                placeholder="Select an Icon"
                style={{ width: '100%' }}
                value={newDevice.icon}
                onChange={(value) => handleIconChange(value)}
              >
                <Option value="circle">Circle</Option>
                <Option value="square">Square</Option>
                <Option value="star">Star</Option>
                <Option value="triangle">Triangle</Option>
              </Select>
            </Form.Item>
            <Form.Item label="Select Image File">
              <Upload
                beforeUpload={(file) => handleFileChange(file)}
                onRemove={() => handleFileRemove()}
                showUploadList={{ showRemoveIcon: true }}
                fileList={newDevice.imagePath ? [{ uid: '-1', name: newDevice.imagePath.split('/').pop(), status: 'done' }] : []}
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
              title={<span><strong>Device Name:</strong> {device.name}</span>}
              style={{ marginBottom: '10px' }}
              extra={<CloseOutlined onClick={() => removeDevice(device.id)} style={{ cursor: 'pointer' }} />}
            >
              <p><strong>Device Icon:</strong> {device.icon || 'N/A'}</p>
              <p><strong>Device Image Path:</strong> {device.imagePath || 'N/A'}</p>
              <p><strong>Device Process Date:</strong> {device.created_at ? new Date(device.created_at).toLocaleString() : 'N/A'}</p>
            </Card>
          ))}
          <Button icon={<PlusOutlined />} onClick={addDevice} style={{ width: '100%', marginTop: '10px' }}>
            Add Another Device
          </Button>
        </Space>
      )}
    </Modal>
  );
};

export default DeviceSelectionModal;
