import { useState, useEffect, useRef } from 'react';

export const useMapAnimation = (filteredLocations, mapSettings) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const animationRef = useRef(null);

  const startAnimation = () => {
    animationRef.current = setInterval(() => {
      setIndex((prevIndex) => {
        if (prevIndex < filteredLocations.length - 1) {
          return prevIndex + 1;
        } else {
          clearInterval(animationRef.current);
          setIsPlaying(false);
          return prevIndex;
        }
      });
    }, mapSettings.animationSpeed);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      clearInterval(animationRef.current);
    } else {
      startAnimation();
    }
    setIsPlaying(!isPlaying);
  };

  const forward = () => {
    const newIndex = Math.min(index + 10, filteredLocations.length - 1);
    setIndex(newIndex);
  };

  const backward = () => {
    const newIndex = Math.max(index - 10, 0);
    setIndex(newIndex);
  };

  const sliderUpdate = (newIndex) => {
    setIndex(newIndex);
  };

  // Reset index when filtered locations change
  useEffect(() => {
    setIndex(0);
    if (isPlaying) {
      clearInterval(animationRef.current);
      setIsPlaying(false);
    }
  }, [filteredLocations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    index,
    setIndex,
    togglePlayPause,
    forward,
    backward,
    sliderUpdate
  };
};
