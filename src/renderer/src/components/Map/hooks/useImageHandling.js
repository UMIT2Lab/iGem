import { useState, useCallback } from 'react';

const { ipcRenderer } = window.require('electron');

export const useImageHandling = () => {
  const [pngPath, setPngPath] = useState(null);
  const [devicePngArray, setDevicePngArray] = useState([]);
  const [loadedImages, setLoadedImages] = useState(new Set()); // Track loaded images

  const loadBase64Image = useCallback(async (ktxFilePath) => {
    // Avoid reloading the same image
    if (loadedImages.has(ktxFilePath)) {
      return;
    }

    try {
      const base64Image = await ipcRenderer.invoke('convert-ktx-to-png', ktxFilePath);
      setPngPath(base64Image);
      setLoadedImages(prev => new Set(prev).add(ktxFilePath));
    } catch (error) {
      console.error('Error loading KTX file:', error);
    }
  }, [loadedImages]);

  const deviceKTXImageLoad = useCallback(async (ktxFilePath, id) => {
    // Avoid reloading the same image for the same device
    const imageKey = `${ktxFilePath}-${id}`;
    if (loadedImages.has(imageKey)) {
      return;
    }

    try {
      const base64Image = await ipcRenderer.invoke('convert-ktx-to-png', ktxFilePath);
      
      setDevicePngArray((prevArray) => {
        const updatedArray = [...prevArray];
        const index = id - 1;
        updatedArray[index] = base64Image;
        return updatedArray;
      });

      setLoadedImages(prev => new Set(prev).add(imageKey));
      return base64Image;
    } catch (error) {
      console.error('Error loading KTX file:', error);
    }
  }, [loadedImages]);

  return {
    pngPath,
    devicePngArray,
    loadBase64Image,
    deviceKTXImageLoad
  };
};
