import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import './App.css';
import * as THREE from 'three';
import { supabase } from './supabaseClient'; // Импортируем наш клиент Supabase

// --- ИМПОРТ ИЗОБРАЖЕНИЙ ---
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

function MainMenu({ onPlay, onShowLeaderboard }) {
  return (
    <div className="ui-fullscreen-menu">
      <img src={logoImage} alt="StackBox Logo" className="menu-logo" />
      <div className="menu-buttons-column">
        <img src={playButtonImage} alt="Play" onClick={onPlay} className="menu-button" />
        <img src={shopButtonImage} alt="Shop" className="menu-button disabled" />
        <img src={friendsButtonImage} alt="Friends" className="menu-button disabled" />
        <img src={leaderboardButtonImage} alt="Leaderboard" onClick={onShowLeaderboard} className="menu-button" />
      </div>
      <img src={settingsButtonImage} alt="Settings" className="menu-settings-button disabled" />
    </div>
  );
}

function PauseMenu({ onResume, onRestart, onGoToMenu }) {
  return (
    <div className="ui-fullscreen-menu">
      <h2>Пауза</h2>
      <div className="menu-buttons-column">
        <button onClick={onResume} className="text-button">Продолжить</button>
        <button onClick={onRestart} className="text-button">Начать заново</button>
        <button onClick={onGoToMenu} className="text-button secondary">В меню</button>
      </div>
    </div>
  );
}

function Leaderboard({ onBack, scores }) {
  return (
    <div className="ui-fullscreen-menu">
      <h2>Таблица рекордов</h2>
      <div className="leaderboard-list">
        {scores.length > 0 ? scores.map((entry, index) => (
          <div key={entry.user_id} className="leaderboard-entry">
            <span>{index + 1}. {entry.username}</span>
            <span>{entry.score}</span>
          </div>
        )) : <p>Загрузка...</p>}
      </div>
      <button onClick={onBack} className="text-button">Назад</button>
    </div>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ИГРЫ ---

function Game() {
  const [gameState, setGameState] = useState('menu'); // 'menu', 'playing', 'paused', 'leaderboard', 'gameOver'
  const [user, setUser] = useState(null);
  const [scores, setScores] = useState([]);
  const [blocks, setBlocks] = useState([
    { position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' },
  ]);
  const clickCooldown = useRef(false);
  const activeBlockPositionRef = useRef(new THREE.Vector3());

  useEffect(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.add('hidden');
        }

        const setupTelegramUser = () => {
            if (window.Telegram && window.Telegram.WebApp) {
                // Вызываем ready() - это скажет Telegram, что мы готовы
                window.Telegram.WebApp.ready();

                const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
                if (tgUser && tgUser.id) {
                    setUser({
                        id: tgUser.id,
                        username: tgUser.username || `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() || 'Аноним'
                    });
                } else {
                    // Если мы в Telegram, но не смогли получить user.id - это странно, но лучше иметь запасной вариант
                    console.warn("In Telegram env, but user data is missing.");
                    setUser({ id: 12345, username: 'Тестовый Игрок' });
                }
            } else {
                // Для тестирования в обычном браузере
                console.log("Not in Telegram env. Using test user.");
                setUser({ id: 12345, username: 'Тестовый Игрок' });
            }
        };

        // Иногда Telegram-объект появляется с небольшой задержкой.
        // Мы попробуем его найти сразу, а если не получится - через 100мс.
        if (window.Telegram && window.Telegram.WebApp) {
            setupTelegramUser();
        } else {
            setTimeout(setupTelegramUser, 100);
        }

    }, []);

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

  const showLeaderboard = async () => {
    setScores([]); // Очищаем старые результаты перед загрузкой
    setGameState('leaderboard');
    const { data, error } = await supabase
      .from('scores')
      .select('user_id, username, score')
      .order('score', { ascending: false })
      .limit(100);

    if (data) {
      setScores(data);
    } else {
      console.error('Error fetching scores:', error);
    }
  };

  const gameOver = async () => {
    setGameState('gameOver');
    if (!user) return;

    const currentScore = blocks.length - 1;
    if (currentScore <= 0) return;

    const { error } = await supabase.rpc('update_score_if_higher', {
      new_user_id: user.id,
      new_username: user.username,
      new_score: currentScore
    });

    if (error) {
      console.error('Error updating score:', error);
    }
  };

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
      {gameState === 'menu' && <MainMenu onPlay={startGame} onShowLeaderboard={showLeaderboard} />}
      {gameState === 'paused' && <PauseMenu onResume={resumeGame} onRestart={restartGame} onGoToMenu={goToMenu} />}
      {gameState === 'leaderboard' && <Leaderboard onBack={goToMenu} scores={scores} />}
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