// src/App.jsx
import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import './App.css';
import gameOverImage from './assets/stackbox_gameover.png';
import * as THREE from 'three';

// --- Компонент Камеры (остается без изменений) ---
function GameCamera({ towerHeight }) {
  const smoothTowerHeight = useRef(0);
  useFrame((state) => {
    smoothTowerHeight.current = THREE.MathUtils.lerp(smoothTowerHeight.current, towerHeight, 0.05);
    const targetPosition = new THREE.Vector3(8, smoothTowerHeight.current + 4, 8);
    state.camera.position.lerp(targetPosition, 0.05);
    state.camera.lookAt(0, smoothTowerHeight.current, 0);
  });
  return null;
}

// --- Компонент Блока ---
function Block({ position, size, color, isActive, onPositionUpdate }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (isActive) {
      const time = state.clock.getElapsedTime();
      meshRef.current.position.x = Math.sin(time * 2) * 2.5;
      onPositionUpdate(meshRef.current.position);
    }
  });

  return (
    // Добавляем castShadow, чтобы этот блок отбрасывал тень
    <mesh ref={meshRef} position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// --- Главный компонент Игры ---
function Game() {
  const [blocks, setBlocks] = useState([
    { position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' }, // Сделаем основание чуть ниже
  ]);
  const [gameState, setGameState] = useState('playing');
  const activeBlockPositionRef = useRef(new THREE.Vector3());

  // --- ИЗМЕНЕНИЕ 2: Переименовываем функцию ---
  const placeBlock = () => {
    if (gameState !== 'playing') {
      setBlocks([{ position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' }]);
      setGameState('playing');
      return;
    }

    const prevBlock = blocks[blocks.length - 1];
    const newBlock = {
      position: activeBlockPositionRef.current.toArray(),
      size: [...prevBlock.size],
      color: `hsl(${blocks.length * 15}, 70%, 50%)`,
    };

    const overlap = prevBlock.size[0] / 2 + newBlock.size[0] / 2 - Math.abs(prevBlock.position[0] - newBlock.position[0]);
    if (overlap <= 0) {
      setGameState('gameOver');
    } else {
      const newWidth = overlap;
      const newX = prevBlock.position[0] + (newBlock.position[0] - prevBlock.position[0]) / 2;
      newBlock.size[0] = newWidth;
      newBlock.position[0] = newX;
      setBlocks(currentBlocks => [...currentBlocks, newBlock]);
    }
  };

  const lastBlock = blocks[blocks.length - 1];
  const towerHeight = blocks.length - 0.5; // Скорректируем высоту
  const newYPosition = towerHeight;

  const score = blocks.length - 1;

  return (
    <div className="app-container">
      <div className="score-ui">
        <p>{score}</p>
      </div>
      <Canvas shadows camera={{ position: [0, 5, 8], fov: 75 }}>
        <GameCamera towerHeight={towerHeight} />
        <ambientLight intensity={0.6} />
        <directionalLight
          castShadow // Этот свет будет отбрасывать тени
          position={[10, 20, 5]} // Позиция "солнца"
          intensity={1.0}
          shadow-mapSize-width={1024} // Качество тени
          shadow-mapSize-height={1024}
        />

        {/* Это невидимая плоскость, которая будет только принимать тени, делая фон красивее */}
        <mesh receiveShadow position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100, 100]} />
          <shadowMaterial opacity={0.3} />
        </mesh>

        {/* --- ИЗМЕНЕНИЕ 2: Добавляем обработчик onPointerDown --- */}
        {/* Это невидимый фон, который ловит клики */}
        <mesh onPointerDown={placeBlock} position={[0,0,-5]}>
            <planeGeometry args={[100,100]}/>
            <meshBasicMaterial transparent opacity={0} />
        </mesh>


        {/* Рендеринг блоков */}
        {blocks.map((block, index) => (
          // Добавляем receiveShadow, чтобы блоки принимали тени друг от друга
          <mesh key={index} position={block.position} castShadow receiveShadow>
            <boxGeometry args={block.size} />
            <meshStandardMaterial color={block.color} />
          </mesh>
        ))}

        {gameState === 'playing' && (
          <Block
            position={[0, newYPosition, 0]}
            size={lastBlock.size}
            color="cyan"
            isActive={true}
            onPositionUpdate={(pos) => activeBlockPositionRef.current.copy(pos)}
          />
        )}
      </Canvas>

      {gameState === 'gameOver' && (
        <div className="game-over-ui" onClick={placeBlock}> {/* Добавим onClick сюда для перезапуска */}
          <img src={gameOverImage} alt="Game Over" className="game-over-image" />
          <p>Ваш счет: {score}</p>
          <p>Кликните, чтобы начать заново</p>
        </div>
      )}
    </div>
  );
}

function App() {
  return <Game />;
}

export default App;