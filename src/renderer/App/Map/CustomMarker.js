import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import colorSchemes from './ColorSchemes'

const CustomMarker = ({ position, children, color, ktx, mapDeviceId, appUsage }) => {
  const map = useMap();
  const deviceColorScheme = colorSchemes[mapDeviceId - 1];
  
  // Choose border color based on ktx presence
  const borderColor = ktx ? deviceColorScheme.borderColorPresent : deviceColorScheme.borderColorAbsent;
  const customDivIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      position: relative;
      background-color: ${deviceColorScheme.innerColor};
      width: 35px;
      height: 35px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 16px;
      font-weight: bold;
      border: 4px solid ${borderColor};
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
          : ""
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
              ">${appUsage.type == "focus" ? "F" : "U"}</div>`
          : ""
      }

    </div>`,
    iconSize: [35, 35],
    iconAnchor: [17.5, 17.5], // Center the icon
  });
  return (
    <Marker position={position} icon={customDivIcon}>
      {children}
    </Marker>
  );
};

export default CustomMarker;

{/* */}