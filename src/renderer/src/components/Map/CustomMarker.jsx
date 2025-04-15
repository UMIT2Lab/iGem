import React from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import colorSchemes from './ColorSchemes'

const CustomMarker = ({ position, children, ktx = false, mapDeviceId = 1, appUsage = null, markerSize = 30 }) => {
  const map = useMap()
  const deviceColorScheme = colorSchemes[mapDeviceId - 1]

  // Use the provided markerSize or default to 30
  const size = markerSize || 30;
  
  const borderColor = ktx
    ? deviceColorScheme.borderColorPresent
    : appUsage != null
    ? deviceColorScheme.borderColorApp
    : deviceColorScheme.borderColorAbsent

  const innerColor = deviceColorScheme.innerColor

  const customDivIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      position: relative;
      background-color: ${innerColor};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: ${size / 2.5}px;
      font-weight: bold;
      border: ${size / 7.5}px solid ${borderColor};
    ">
      ${mapDeviceId}
      ${
        ktx
          ? `<div style="
                position: absolute;
                top: -12px;
                right: -12px;
                background-color: red;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 10px;
                font-weight: bold;
                box-shadow: 0 0 2px rgba(0,0,0,0.2);
              ">1</div>`
          : ''
      }
            ${
              appUsage
                ? `<div style="
                position: absolute;
                top: -12px;
                left: -12px;
                background-color: blue;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 10px;
                font-weight: bold;
                box-shadow: 0 0 2px rgba(0,0,0,0.2);
              ">${appUsage.type == 'focus' ? 'F' : 'U'}</div>`
                : ''
            }

    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2] // Center the icon
  })
  return (
    <Marker position={position} icon={customDivIcon}>
      {children}
    </Marker>
  )
}

export default CustomMarker

{
  /* */
}
