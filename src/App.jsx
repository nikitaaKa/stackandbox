import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import './App.css';
import * as THREE from 'three';

// --- ИМПОРТ ИЗОБРАЖЕНИЙ ---
// Убедитесь, что все эти файлы лежат в папке src/assets
import logoImage from './assets/stackbox_logo.png';
import playButtonImage from './assets/stackbox_btn_play.png';
import shopButtonImage from './assets/stackbox_btn_shop.png';
import friendsButtonImage from './assets/stackbox_btn_friends.png';
import leaderboardButtonImage from './assets/stackbox_btn_leaderboard.png';
import pauseButtonImage from './assets/stackbox_btn_pause.png';
import settingsButtonImage from './assets/stackbox_btn_settings.png';
import gameOverImage from './assets/stackbox_gameover.png';

// --- КОМПОНЕНТЫ 3D-СЦЕНЫ ---

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
    <mesh ref={meshRef} position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// --- КОМПОНЕНТЫ ИНТЕРФЕЙСА ---

function MainMenu({ onPlay }) {
  return (
    <div className="ui-fullscreen-menu">
      <img src={logoImage} alt="StackBox Logo" className="menu-logo" />
      {/* ИЗМЕНЕНИЕ: меняем класс с 'menu-buttons' на 'menu-buttons-column' */}
      <div className="menu-buttons-column">
        <img src={playButtonImage} alt="Play" onClick={onPlay} className="menu-button" />
        <img src={shopButtonImage} alt="Shop" className="menu-button disabled" />
        <img src={friendsButtonImage} alt="Friends" className="menu-button disabled" />
        <img src={leaderboardButtonImage} alt="Leaderboard" className="menu-button disabled" />
      </div>
      <img src={settingsButtonImage} alt="Settings" className="menu-settings-button disabled" />
    </div>
  );
}

function PauseMenu({ onResume, onRestart, onGoToMenu }) { // Добавляем новый пропс onGoToMenu
  return (
    <div className="ui-fullscreen-menu">
      <h2>Пауза</h2>
      <div className="menu-buttons-column">
        <button onClick={onResume} className="text-button">Продолжить</button>
        <button onClick={onRestart} className="text-button">Начать заново</button>
        {/* ИЗМЕНЕНИЕ: Добавляем новую кнопку */}
        <button onClick={onGoToMenu} className="text-button secondary">В меню</button>
      </div>
    </div>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ИГРЫ ---

function Game() {
  const [gameState, setGameState] = useState('menu'); // 'menu', 'playing', 'paused', 'gameOver'
  const [blocks, setBlocks] = useState([
    { position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' },
  ]);
  const clickCooldown = useRef(false);
  const activeBlockPositionRef = useRef(new THREE.Vector3());

  const startGame = () => setGameState('playing');
  const pauseGame = () => setGameState('paused');
  const resumeGame = () => setGameState('playing');
  const restartGame = () => {
    setBlocks([{ position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' }]);
    setGameState('playing');
  };
  const goToMenu = () => {
    setBlocks([{ position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' }]);
    setGameState('menu');
  };
  const gameOver = () => setGameState('gameOver');

  const placeBlock = () => {
    if (clickCooldown.current || gameState !== 'playing') return;

    clickCooldown.current = true;
    setTimeout(() => { clickCooldown.current = false; }, 100);

    const prevBlock = blocks[blocks.length - 1];
    const newBlock = {
      position: activeBlockPositionRef.current.toArray(),
      size: [...prevBlock.size],
      color: `hsl(${blocks.length * 15}, 70%, 50%)`,
    };

    const overlap = prevBlock.size[0] / 2 + newBlock.size[0] / 2 - Math.abs(prevBlock.position[0] - newBlock.position[0]);

    if (overlap <= 0) {
      gameOver();
    } else {
      const newWidth = overlap;
      const newX = prevBlock.position[0] + (newBlock.position[0] - prevBlock.position[0]) / 2;
      newBlock.size[0] = newWidth;
      newBlock.position[0] = newX;
      setBlocks(currentBlocks => [...currentBlocks, newBlock]);
    }
  };

  const score = blocks.length - 1;
  const towerHeight = blocks.length - 0.5;

  return (
    <div className="app-container">
      {/* Условный рендеринг интерфейса */}
      {gameState === 'menu' && <MainMenu onPlay={startGame} />}
      {gameState === 'paused' && <PauseMenu onResume={resumeGame} onRestart={restartGame} onGoToMenu={goToMenu} />}
      {gameState === 'gameOver' && (
        <div className="game-over-ui" onClick={restartGame}>
          <img src={gameOverImage} alt="Game Over" className="game-over-image" />
          <p>Ваш счет: {score}</p>
          <p>Кликните, чтобы начать заново</p>
        </div>
      )}

      {/* Игровой HUD */}
      {gameState === 'playing' && (
        <>
          <div className="score-ui"><p>{score}</p></div>
          <img src={pauseButtonImage} alt="Pause" className="pause-button" onClick={pauseGame} />
        </>
      )}

      {/* 3D Сцена */}
      <Canvas shadows camera={{ position: [0, 5, 8], fov: 75 }}>
        <GameCamera towerHeight={towerHeight} />

        <ambientLight intensity={0.6} />
        <directionalLight
          castShadow
          position={[10, 20, 5]}
          intensity={1.0}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <mesh receiveShadow position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100, 100]} />
          <shadowMaterial opacity={0.3} />
        </mesh>

        {gameState === 'playing' && (
          <mesh onPointerDown={placeBlock} position={[0, 0, -5]}>
            <planeGeometry args={[100, 100]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        )}

        {blocks.map((block, index) => (
          <mesh key={index} position={block.position} castShadow receiveShadow>
            <boxGeometry args={block.size} />
            <meshStandardMaterial color={block.color} />
          </mesh>
        ))}

        {gameState === 'playing' && (
          <Block
            position={[0, towerHeight, 0]}
            size={blocks[blocks.length - 1].size}
            color="cyan"
            isActive={true}
            onPositionUpdate={(pos) => activeBlockPositionRef.current.copy(pos)}
          />
        )}
      </Canvas>
    </div>
  );
}

function App() {
  return <Game />;
}

export default App;