import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

const colorSchemes = [
  {
    deviceId: 1,
    innerColor: "#4A90E2", // Light blue for device 1
    borderColorPresent: "#2C6FB1", // Darker blue to indicate presence of .ktx files
    borderColorAbsent: "#A3C3E0", // Softer blue to indicate absence of .ktx files
  },
  {
    deviceId: 2,
    innerColor: "#50E3C2", // Teal for device 2
    borderColorPresent: "#2BA18A", // Dark teal for presence
    borderColorAbsent: "#A0EBDD", // Light teal for absence
  },
  {
    deviceId: 3,
    innerColor: "#F5A623", // Orange for device 3
    borderColorPresent: "#C0781A", // Dark orange for presence
    borderColorAbsent: "#F8C99A", // Light orange for absence
  },
  {
    deviceId: 4,
    innerColor: "#B8E986", // Green for device 4
    borderColorPresent: "#82B665", // Dark green for presence
    borderColorAbsent: "#D6F3B5", // Light green for absence
  }
];

const CustomMarker = ({ position, children, color, ktx, mapDeviceId }) => {
  const map = useMap();

  const deviceColorScheme = colorSchemes[mapDeviceId - 1];
  
  // Choose border color based on ktx presence
  const borderColor = ktx ? deviceColorScheme.borderColorPresent : deviceColorScheme.borderColorAbsent;
  const customDivIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
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
      overflow: hidden;
    ">${mapDeviceId}</div>`,
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

