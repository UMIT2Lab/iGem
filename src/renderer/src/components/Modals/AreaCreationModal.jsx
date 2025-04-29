import { useState, useEffect } from 'react'
import { Modal, Input, InputNumber, Button, ColorPicker, message } from 'antd'

const AreaCreationModal = ({ visible, onClose, onSave, currentMapCenter }) => {
  const [areaName, setAreaName] = useState('')
  const [radius, setRadius] = useState(500)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [color, setColor] = useState('#3388ff')
  const [messageApi, contextHolder] = message.useMessage()

  // Update coordinates when map center changes
  useEffect(() => {
    if (currentMapCenter && visible) {
      setLatitude(currentMapCenter.lat)
      setLongitude(currentMapCenter.lng)
    }
  }, [currentMapCenter, visible])

  const handleSave = () => {
    if (!areaName || !radius || !latitude || !longitude) {
      messageApi.error('All fields are required')
      return
    }

    const newArea = {
      name: areaName,
      radius: Number(radius),
      latitude: Number(latitude),
      longitude: Number(longitude),
      color: color
    }

    onSave(newArea)
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setAreaName('')
    setRadius(500)
    setLatitude('')
    setLongitude('')
    setColor('#3388ff')
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  // Format coordinates safely for display
  const formatCoordinate = (value) => {
    // Check if value is a number or can be converted to one
    const num = Number(value);
    return !isNaN(num) ? num.toFixed(6) : 'N/A';
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="Create Area"
        open={visible}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button key="save" type="primary" onClick={handleSave}>
            Save
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16, padding: 8, backgroundColor: '#f0f8ff', borderRadius: 4 }}>
          <p>Selected location: {formatCoordinate(latitude)}, {formatCoordinate(longitude)}</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Area Name:</label>
          <Input
            placeholder="Enter area name"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Radius (meters):</label>
          <InputNumber
            min={10}
            max={10000}
            value={radius}
            onChange={setRadius}
            style={{ marginTop: 8, width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Latitude:</label>
          <InputNumber
            value={latitude}
            onChange={setLatitude}
            precision={6}
            step={0.000001}
            style={{ marginTop: 8, width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Longitude:</label>
          <InputNumber
            value={longitude}
            onChange={setLongitude}
            precision={6}
            step={0.000001}
            style={{ marginTop: 8, width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Color:</label>
          <div style={{ marginTop: 8 }}>
            <ColorPicker value={color} onChange={(color) => setColor(color.toHexString())} />
          </div>
        </div>
      </Modal>
    </>
  )
}

export default AreaCreationModal
