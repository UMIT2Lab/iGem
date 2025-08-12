export const formatMac = (mac) => {
  const hex = BigInt(mac).toString(16).padStart(12, '0');
  return hex.match(/.{2}/g).join(':').toUpperCase();
};

export const getMapTileLayerUrl = (mapLayer) => {
  const mapTileLayers = [
    { value: 'osm', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
    { value: 'cartoDb', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
    { value: 'cartoDark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
    { value: 'esri', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  ];

  const selectedLayer = mapTileLayers.find(layer => layer.value === mapLayer);
  return selectedLayer ? selectedLayer.url : mapTileLayers[0].url;
};
