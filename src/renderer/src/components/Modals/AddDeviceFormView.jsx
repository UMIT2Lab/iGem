import React from 'react'
import { Form, Input, Upload, Button } from 'antd'
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons'

const AddDeviceFormView = ({ newDevice, setNewDevice, handleFileChange, handleFileRemove, onBack }) => {
  return (
    <div>
      <ArrowLeftOutlined
        onClick={onBack}
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
            multiple
            beforeUpload={(file) => handleFileChange(file)}
            onRemove={(file) => handleFileRemove(file)}
            showUploadList={{ showRemoveIcon: true }}
            fileList={newDevice?.imagePaths?.map((filePath, index) => ({
              uid: index.toString(),
              name: filePath.split('/').pop(),
              status: 'done',
            })) || []}
          >
            <Button icon={<UploadOutlined />}>Select File</Button>
          </Upload>
        </Form.Item>
      </Form>
    </div>
  )
}

export default AddDeviceFormView
