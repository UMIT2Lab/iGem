import React, { useState } from 'react'
import { Space, Card, Button, Row, Col } from 'antd'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons'
import DatabaseFilesModal from './DatabaseFilesModal'

const DeviceListView = ({ devices, onRemoveDevice, onAddDevice }) => {
  const [databaseModalVisible, setDatabaseModalVisible] = useState(false)

  const handleAddDatabaseFiles = () => {
    setDatabaseModalVisible(true)
  }

  const handleDatabaseModalCancel = () => {
    setDatabaseModalVisible(false)
  }

  const handleDatabaseModalSubmit = (data) => {
    // Process the database files
    console.log('Database files submitted:', data)
    // You would typically call an API or dispatch an action here
    // to handle the database files
    
    // Close the modal
    setDatabaseModalVisible(false)
  }

  return (
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
              onClick={() => onRemoveDevice(device.id)}
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
      <Row gutter={8}>
        <Col span={12}>
          <Button
            icon={<PlusOutlined />}
            onClick={onAddDevice}
            style={{ width: '100%', marginTop: '10px' }}
          >
            Add Disk Image
          </Button>
        </Col>
        <Col span={12}>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddDatabaseFiles}
            style={{ width: '100%', marginTop: '10px' }}
          >
            Add Database Files
          </Button>
        </Col>
      </Row>
      
      <DatabaseFilesModal
        visible={databaseModalVisible}
        onCancel={handleDatabaseModalCancel}
        onSubmit={handleDatabaseModalSubmit}
      />
    </Space>
  )
}

export default DeviceListView
