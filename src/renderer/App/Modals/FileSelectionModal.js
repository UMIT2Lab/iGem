// DeviceSelectionModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Card, Upload, Button, Select, Space, message, Flex, Typography } from 'antd';
import { UploadOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
const { ipcRenderer } = window.require('electron');
const { Option } = Select;

const DeviceSelectionModal = ({ visible, onClose }) => {
  const [devices, setDevices] = useState([{ icon: null, gps: null, cellTower: null, wifi: null }]);
  const [savedDevices, setSavedDevices] = useState([]);

  // Load saved devices from database on component mount
  useEffect(() => {
    ipcRenderer.invoke('get-devices').then((result) => setSavedDevices(result));
    console.log(devices)
  }, []);

  const handleIconChange = (icon, index) => {
    const updatedDevices = [...devices];
    updatedDevices[index].icon = icon;
    setDevices(updatedDevices);
  };

  const handleFileChange = (info, index, type) => {
    const updatedDevices = [...devices];
    updatedDevices[index][type] = info.fileList[0];
    setDevices(updatedDevices);
  };

  const addDevice = () => {
    setDevices([...devices, { icon: null, gps: null, cellTower: null, wifi: null }]);
  };

  const removeDevice = (index) => {
    setDevices(devices.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    devices.forEach(device => {
      ipcRenderer.invoke('add-device', {
        icon: device.icon,
        gps: device.gps?.name,
        cellTower: device.cellTower?.name,
        wifi: device.wifi?.name
      }).then(() => {
        message.success('Devices added successfully!');
        onClose();
      }).catch(err => message.error('Error saving devices.'));
    });
  };

  return (
    <Modal
      title="Add Devices"
      visible={visible}
      onCancel={onClose}
      okText="Confirm"
      style={{width: '40vw'}}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {devices.map((device, index) => (
          <Card
            key={index}
            title={`Device ${index + 1}`}
            style={{ marginBottom: '10px',}}
            extra={<CloseOutlined onClick={() => removeDevice(index)} style={{ cursor: 'pointer' }} />}
          >
            <Select
              placeholder="Select an Icon"
              style={{ width: '100%', marginBottom: '10px' }}
              onChange={(value) => handleIconChange(value, index)}
            >
              <Option value="icon1">Icon 1</Option>
              <Option value="icon2">Icon 2</Option>
              <Option value="icon3">Icon 3</Option>
            </Select>
            <Upload onChange={(info) => handleFileChange(info, index, 'gps')} accept=".csv">
              <Button icon={<UploadOutlined />}>Upload GPS CSV</Button>
            </Upload>
            <Upload onChange={(info) => handleFileChange(info, index, 'cellTower')} accept=".csv">
              <Button icon={<UploadOutlined />}>Upload Cell Tower CSV</Button>
            </Upload>
            <Upload onChange={(info) => handleFileChange(info, index, 'wifi')} accept=".csv">
              <Button icon={<UploadOutlined />}>Upload WiFi CSV</Button>
            </Upload>
          </Card>

        ))}
        <Button icon={<PlusOutlined />} onClick={addDevice} style={{ width: '100%', marginTop: '10px' }}>
          Add Another Device
        </Button>
      </Space>
    </Modal>
  );
};

export default DeviceSelectionModal;
