import React from 'react';
import { Card } from 'antd';
import colorSchemes from '../ColorSchemes';

const MapLegend = ({ fetchedDevices }) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '10px',
      left: '10px',
      zIndex: 1000,
    }}>
      <Card
        title="Legend"
        bordered={true}
        style={{
          width: 200,
          opacity: 0.9,
        }}
      >
        {fetchedDevices.map(device => (
          <div
            key={device.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px"
            }}
          >
            <div
              style={{
                position: "relative",
                backgroundColor: colorSchemes[device.id - 1]?.innerColor || '#3388ff',
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "12px",
                fontWeight: "bold",
                border: `4px solid ${colorSchemes[device.id - 1]?.borderColorAbsent || '#ccc'}`,
              }}
            >
              {device.id}
            </div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: "normal",
                color: "#333",
              }}
            >
              {device.name}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
};

export default MapLegend;
