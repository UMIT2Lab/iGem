import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";



const CustomMarker = ({ position, children, color, iconUrl }) => {
  const map = useMap();
  const asdfsafs =  require("src/renderer/App/Icons/circle_red_marker.png")
  var iconColored = new L.Icon({
    iconUrl: asdfsafs,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [20, 20],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [20, 20]
  });

  //Spotify
  const customIcon = L.icon({
    iconUrl: "https://m.media-amazon.com/images/I/51rttY7a+9L.png",
    iconSize: [35, 35],
    iconAnchor: [15, 10],
  });
  const customDivIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background-color: ${"red"};
      width: 35px;
      height: 35px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 10px;
      font-weight: bold;
      border: 2px solid cyan;
      overflow: hidden;
    ">${"Akif"}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12], // Center the icon
  });
  
  return (
    <Marker position={position} icon={customDivIcon}>
      {children}
    </Marker>
  );
};

export default CustomMarker;

// const MarkerWithBadge = props => {
//   const initMarker = ref => {
//     if (ref) {
//       const popup = L.popup().setContent(props.children);
//       ref.leafletElement
//         .addTo(ref.contextValue.map)
//         .bindPopup(popup, {
//           className: "badge",
//           closeOnClick: false,
//           autoClose: false
//         })
//         .openPopup()
//         // prevent badge from dissapearing onClick
//         .off("click");
//     }
//   };
//   return <Marker ref={initMarker} {...props} />;
// };

// export default MarkerWithBadge