import React from 'react'

const colorSchemes = [
  {
    deviceId: 1,
    innerColor: '#4A90E2', // Light blue for device 1
    borderColorPresent: '#2C6FB1', // Darker blue to indicate presence of .ktx files
    borderColorAbsent: '#A3C3E0' // Softer blue to indicate absence of .ktx files
  },
  {
    deviceId: 2,
    innerColor: '#50E3C2', // Teal for device 2
    borderColorPresent: '#2BA18A', // Dark teal for presence
    borderColorAbsent: '#A0EBDD' // Light teal for absence
  },
  {
    deviceId: 3,
    innerColor: '#F5A623', // Orange for device 3
    borderColorPresent: '#C0781A', // Dark orange for presence
    borderColorAbsent: '#F8C99A' // Light orange for absence
  },
  {
    deviceId: 4,
    innerColor: '#B8E986', // Green for device 4
    borderColorPresent: '#82B665', // Dark green for presence
    borderColorAbsent: '#D6F3B5' // Light green for absence
  }
]

const DeviceMarkers = (devices) => {
  const getDeviceColorScheme = (mapDeviceId, hasKtxFile) => {
    const scheme = colorSchemes.find((item) => item.deviceId === mapDeviceId)
    if (!scheme) {
      return { innerColor: '#ccc', borderColor: '#aaa' } // Default colors if no match
    }
    return {
      innerColor: scheme.innerColor,
      borderColor: hasKtxFile ? scheme.borderColorPresent : scheme.borderColorAbsent
    }
  }
  console.log(devices)
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {devices.map((device, index) => {
        const { innerColor, borderColor } = getDeviceColorScheme(
          device.mapDeviceId,
          device.hasKtxFile
        )
        return (
          <div
            key={index}
            style={{
              position: 'relative',
              backgroundColor: innerColor,
              width: '35px',
              height: '35px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              border: `4px solid ${borderColor}`
            }}
          >
            {device.mapDeviceId}
          </div>
        )
      })}
    </div>
  )
}

export default DeviceMarkers
