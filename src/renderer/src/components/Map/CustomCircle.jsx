import { useState } from 'react'
import { Circle, Tooltip } from 'react-leaflet'

const CustomCircle = ({ area }) => {
  const [isHovered, setIsHovered] = useState(false)

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
    </Circle>
  )
}

export default CustomCircle
