import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import '../styles/D20LoadingSpinner.css';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';

const D20LoadingSpinner = ({ onFinish, rollType }) => {
  const mountRef = useRef(null);
  const diceRef = useRef(null);
  const worldRef = useRef(null);
  const d20GroupRef = useRef(null);
  const physicsBodyRef = useRef(null);
  const [number, setNumber] = useState(1);
  const [isRolling, setIsRolling] = useState(true);
  const [canStop, setCanStop] = useState(false);

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(300, 300);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // Physics world setup
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -109.82, 0)
    });
    worldRef.current = world;

    // Create a static plane (table surface)
    const tableShape = new CANNON.Plane();
    const tableBody = new CANNON.Body({
      mass: 0,
      shape: tableShape,
      position: new CANNON.Vec3(0, -9, 0), // Lower the plane
    });

    // Rotate to lie flat on XZ plane
    tableBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(tableBody);

    // Add walls to contain the die
    const wallShape = new CANNON.Plane();
    const walls = [
      // Back wall
      new CANNON.Body({
        mass: 0,
        shape: wallShape,
        position: new CANNON.Vec3(0, 0, -10)
      }),
      // Front wall
      new CANNON.Body({
        mass: 0,
        shape: wallShape,
        position: new CANNON.Vec3(0, 0, 1),
        quaternion: new CANNON.Quaternion().setFromEuler(Math.PI, 0, 0)
      }),
      // Left wall
      new CANNON.Body({
        mass: 0,
        shape: wallShape,
        position: new CANNON.Vec3(-5, 0, 0),
        quaternion: new CANNON.Quaternion().setFromEuler(0, Math.PI / 2, 0)
      }),
      // Right wall
      new CANNON.Body({
        mass: 0,
        shape: wallShape,
        position: new CANNON.Vec3(5, 0, 0),
        quaternion: new CANNON.Quaternion().setFromEuler(0, -Math.PI / 2, 0)
      }),
      // Ceiling
      new CANNON.Body({
        mass: 0,
        shape: wallShape,
        position: new CANNON.Vec3(0, 5, 0),
        quaternion: new CANNON.Quaternion().setFromEuler(Math.PI / 2, 0, 0)
      })
    ];

    walls.forEach(wall => world.addBody(wall));

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 3.5);
    pointLight.position.set(5, 5, 10);
    scene.add(pointLight);

    const spotLight = new THREE.SpotLight(0xffffff, 3.2);
    spotLight.position.set(10, 10, 10);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 4096;
    spotLight.shadow.mapSize.height = 4096;
    spotLight.angle = Math.PI / 4;
    scene.add(spotLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
    directionalLight.position.set(-5, 15, 15);
    scene.add(directionalLight);

    // Enable shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Load font for numbers
    const fontLoader = new FontLoader();
    fontLoader.load('/fonts/helvetiker_regular.typeface.json', (font) => {
      const d20 = new THREE.Group();
      d20GroupRef.current = d20;

      // Create the dice mesh
      const diceGeometry = new THREE.IcosahedronGeometry(2, 1);
      const diceMaterial = new THREE.MeshStandardMaterial({
        color: 0x4caf50,
        flatShading: true,
        metalness: 0.1,
        roughness: 0.8,
      });
      const diceMesh = new THREE.Mesh(diceGeometry, diceMaterial);
      d20.add(diceMesh);

      // Define icosahedron vertices for physics
      const t = (1 + Math.sqrt(5)) / 2;
      const vertices = [
        [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
        [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
        [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
      ];

      // Convert to CANNON.Vec3 format
      const cannonVertices = vertices.map(v => new CANNON.Vec3(...v));

      // Faces of the icosahedron
      const faces = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
      ];

      // Create physics shape
      const icosahedronShape = new CANNON.ConvexPolyhedron({
        vertices: cannonVertices,
        faces: faces
      });

      // Add numbers to faces
      const numberMaterial = new THREE.MeshPhongMaterial({
        color: 0xf5f5f5,
        emissive: 0x000000,
        shininess: 0,
      });

      faces.forEach((face, i) => {
        const number = i + 1;
        const textGeometry = new TextGeometry(number.toString(), {
          font,
          size: 0.7,
          height: 0.05,
        });
        textGeometry.center();
        
        // Calculate face normal
        const normal = new THREE.Vector3()
          .add(new THREE.Vector3(...vertices[face[0]]))
          .add(new THREE.Vector3(...vertices[face[1]]))
          .add(new THREE.Vector3(...vertices[face[2]]))
          .normalize();
        
        const textMesh = new THREE.Mesh(textGeometry, numberMaterial);

        // Move text closer to the dice surface
        textMesh.position.copy(normal).multiplyScalar(1.867); // Position just outside surface
        textMesh.lookAt(normal.multiplyScalar(1.95)); // Face outward but not too far
        textMesh.scale.set(0.9, 0.9, 0.1); // Thinner, properly sized numbers
        d20.add(textMesh);
      });

      scene.add(d20);
      diceRef.current = d20;

      // Create physics body
      const body = new CANNON.Body({
        mass: 10.1,
        shape: icosahedronShape,
        position: new CANNON.Vec3(0, 0, 0), // Start higher up
        angularDamping: 0,
        linearDamping: 0,
        restitution: 0, // Add some bounce
      });
      
      physicsBodyRef.current = body;
      world.addBody(body);

      // Animation loop
      const animate = () => {
        if (d20GroupRef.current && physicsBodyRef.current && isRolling) {
          world.step(1/60);
          d20GroupRef.current.position.copy(physicsBodyRef.current.position);
          d20GroupRef.current.quaternion.copy(physicsBodyRef.current.quaternion);

          // Only add random forces if the die is nearly stopped and on the table
          if (physicsBodyRef.current.velocity.length() < 0.5 && 
              physicsBodyRef.current.position.y < 1 && 
              Math.random() < 0.9) {
            physicsBodyRef.current.velocity.set(
              Math.random() * 180 - 4,
              Math.random() * 140 + 2, // More upward force
              Math.random() * 180 - 4
            );
            physicsBodyRef.current.angularVelocity.set(
              Math.random() * 210 - 10,
              Math.random() * 210 - 10,
              Math.random() * 210 - 10
            );
          }
        }

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };
      animate();
    });

    return () => {
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [isRolling]);

  const stopRolling = useCallback(async () => {
    setIsRolling(false);
    setCanStop(false);
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (onFinish) {
      onFinish(number);
    }
  }, [number, onFinish]);

  useEffect(() => {
    let rollInterval;
    if (isRolling) {
      rollInterval = setInterval(() => {
        setNumber(Math.floor(Math.random() * 20) + 1);
      }, 100);
      setTimeout(() => setCanStop(true), 1000);
    }
    return () => {
      if (rollInterval) clearInterval(rollInterval);
    };
  }, [isRolling]);

  return (
    <div className="d20-overlay">
      <div className="d20-container" ref={mountRef} />
      <div className="roll-type">{rollType}</div>
      {canStop && (
        <button 
          className="stop-roll-btn"
          onClick={stopRolling}
          disabled={!isRolling}
        >
          Stop Rolling
        </button>
      )}
    </div>
  );
};

D20LoadingSpinner.propTypes = {
  onFinish: PropTypes.func,
  rollType: PropTypes.string,
};

export default D20LoadingSpinner;
