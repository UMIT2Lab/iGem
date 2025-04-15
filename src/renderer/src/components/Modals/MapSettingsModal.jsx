import { useState, useEffect } from 'react';
import { Modal, Form, Select, Slider, InputNumber, Switch, Divider, Row, Col } from 'antd';

const mapTileLayers = [
  { value: 'osm', label: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { value: 'cartoDb', label: 'Carto DB (Light)', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { value: 'cartoDark', label: 'Carto DB (Dark)', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { value: 'esri', label: 'ESRI World Imagery', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
];

const MapSettingsModal = ({ visible, onClose, onSave, initialSettings }) => {
  const [form] = Form.useForm();
  
  useEffect(() => {
    if (visible && initialSettings) {
      form.setFieldsValue(initialSettings);
    }
  }, [visible, initialSettings, form]);

  const handleSave = () => {
    const values = form.getFieldsValue();
    onSave(values);
    onClose();
  };

  return (
    <Modal
      title="Map Settings"
      open={visible}
      onCancel={onClose}
      onOk={handleSave}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialSettings}
      >
        <Divider orientation="left">Map Display</Divider>
        
        <Form.Item name="mapLayer" label="Map Tile Layer">
          <Select options={mapTileLayers} />
        </Form.Item>
        
        <Form.Item name="defaultZoom" label="Default Zoom Level">
          <Slider min={1} max={18} step={1} marks={{ 1: '1', 9: '9', 18: '18' }} />
        </Form.Item>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="autoCenterMap" label="Auto-center on latest location" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="showTrails" label="Show location trails" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        
        <Divider orientation="left">Animation Settings</Divider>
        
        <Form.Item name="animationSpeed" label="Animation Speed (milliseconds)">
          <Slider
            min={100}
            max={2000}
            step={100}
            marks={{ 100: 'Fast', 1000: 'Medium', 2000: 'Slow' }}
          />
        </Form.Item>
        
        <Divider orientation="left">Location Display</Divider>
        
        <Form.Item name="maxLocations" label="Maximum locations to display">
          <InputNumber min={10} max={1000} step={10} style={{ width: '100%' }} />
        </Form.Item>
        
        <Form.Item name="markerSize" label="Marker Size">
          <Slider min={10} max={50} step={5} marks={{ 10: 'Small', 30: 'Medium', 50: 'Large' }} />
        </Form.Item>
        
        <Form.Item name="showAllDevices" label="Show all devices" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MapSettingsModal;
