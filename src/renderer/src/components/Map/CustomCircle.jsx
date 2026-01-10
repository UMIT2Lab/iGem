import { useState } from 'react'
import { Circle, Tooltip, Popup } from 'react-leaflet'
import { Button, Space, Popconfirm } from 'antd'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'

const CustomCircle = ({ area, onEdit, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false)

  const handleEdit = () => {
    if (onEdit) {
      onEdit(area);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(area.id);
    }
  };

  return (
    <Circle
      center={[area.latitude, area.longitude]}
      radius={area.radius}
      pathOptions={{
        color: area.color || '#3388ff',
        fillColor: area.color || '#3388ff',
        fillOpacity: 0.2,
        weight: 2
      }}
      eventHandlers={{
        mouseover: () => {
          setIsHovered(true)
        },
        mouseout: () => {
          setIsHovered(false)
        }
      }}
    >
      {isHovered && (
        <Tooltip permanent direction="center" offset={[0, -20]} opacity={0.8}>
          <div>
            <strong>{area.name}</strong>
            <div>{area.radius} meters</div>
          </div>
        </Tooltip>
      )}
      
      {onEdit && onDelete && (
        <Popup>
          <div>
            <p><strong>{area.name}</strong></p>
            <p>Radius: {area.radius} meters</p>
            <p>Location: {area.latitude.toFixed(6)}, {area.longitude.toFixed(6)}</p>
            <Space style={{ marginTop: 8 }}>
              <Button 
                type="primary" 
                icon={<EditOutlined />} 
                size="small"
                onClick={handleEdit}
              >
                Edit
              </Button>
              <Popconfirm
                title="Delete Area"
                description="Are you sure you want to delete this area?"
                onConfirm={handleDelete}
                okText="Yes"
                cancelText="No"
              >
                <Button 
                  danger 
                  icon={<DeleteOutlined />} 
                  size="small"
                >
                  Delete
                </Button>
              </Popconfirm>
            </Space>
          </div>
        </Popup>
      )}
    </Circle>
  )
}

export default CustomCircle
