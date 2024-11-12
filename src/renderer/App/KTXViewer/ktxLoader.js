import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';

const KTXViewer = ({ filePath }) => {
  const containerRef = useRef();

  useEffect(() => {
    const container = containerRef.current;

    // Set up scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Load the KTX file
    const loader = new KTX2Loader();
    loader.setTranscoderPath('./');
    loader.detectSupport(renderer);

    loader.load(
      filePath,
      (texture) => {
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        animate();
      },
      undefined,
      (error) => {
        console.error('Error loading KTX file:', error);
      }
    );

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    return () => {
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [filePath]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default KTXViewer;
