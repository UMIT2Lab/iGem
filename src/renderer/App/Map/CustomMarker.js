import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";



const CustomMarker = ({ position, children, color }) => {
  const map = useMap();

  var iconColored = new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  //Spotify
  const customIcon = L.icon({
    iconUrl: "https://m.media-amazon.com/images/I/51rttY7a+9L.png",
    iconSize: [35, 35],
    iconAnchor: [15, 10],
  });

  return (
    <Marker position={position} icon={iconColored}>
      {children}
    </Marker>
  );
};

export default CustomMarker;
