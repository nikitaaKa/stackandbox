import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import './App.css';
import * as THREE from 'three';
import { supabase } from './supabaseClient';

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

function Block({ position, size, color, isActive, onPositionUpdate, speedMultiplier = 1 }) {
  const meshRef = useRef();
  useFrame((state) => {
    if (isActive) {
      const time = state.clock.getElapsedTime();
      meshRef.current.position.x = Math.sin(time * 2 * speedMultiplier) * 2.5;
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

function MainMenu({ onPlay, onShowLeaderboard, onShowFriends }) {
  return (
    <div className="ui-fullscreen-menu">
      <img src={logoImage} alt="StackBox Logo" className="menu-logo" />
      <div className="menu-buttons-column">
        <img src={playButtonImage} alt="Play" onClick={onPlay} className="menu-button" />
        <img src={shopButtonImage} alt="Shop" className="menu-button disabled" />
        <img src={friendsButtonImage} alt="Friends" onClick={onShowFriends} className="menu-button" />
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

// src/App.jsx

// ... (остальной код, MainMenu, PauseMenu и т.д.)

// --- ФИНАЛЬНАЯ ВЕРСИЯ FriendsPage ---
function FriendsPage({ user, onBack, onSendSabotage }) {
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendships, setFriendships] = useState({ requests: [], friends: [] });
  const [loading, setLoading] = useState(true);

  // Функция для обновления всех списков
  const fetchAllFriendships = async () => {
    if (!user || !user.user_id) return;
    setLoading(true);

    // Запрос на входящие заявки
    const { data: requestsData } = await supabase
      .from('friendships')
      .select(`*, user1:scores!user1_id(username)`)
      .eq('user2_id', user.user_id)
      .eq('status', 'pending');

    // Запрос на подтвержденных друзей
    const { data: friendsData } = await supabase
      .from('friendships')
      .select(`*, user1:scores!user1_id(username, user_id), user2:scores!user2_id(username, user_id)`)
      .or(`user1_id.eq.${user.user_id},user2_id.eq.${user.user_id}`)
      .eq('status', 'accepted');

    setFriendships({
      requests: requestsData || [],
      // Фильтруем и преобразуем данные, чтобы получить объекты именно друзей, а не себя
      friends: (friendsData || []).map(f => (f.user1_id === user.user_id ? f.user2 : f.user1)),
    });
    setLoading(false);
  };

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    fetchAllFriendships();
  }, [user]);

  const handleAddFriend = async () => {
    if (!friendCodeInput.trim()) return;

    const { data: friendData } = await supabase
      .from('scores')
      .select('user_id')
      .eq('friend_code', friendCodeInput.trim().toUpperCase())
      .single();

    if (!friendData) {
      alert('Пользователь с таким кодом не найден.');
      return;
    }

    if (friendData.user_id === user.user_id) {
        alert('Нельзя добавить себя в друзья.');
        return;
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ user1_id: user.user_id, user2_id: friendData.user_id, status: 'pending' });

    if (error) {
      alert('Не удалось отправить заявку. Возможно, она уже отправлена или вы уже друзья.');
    } else {
      alert('Заявка в друзья отправлена!');
      setFriendCodeInput('');
    }
  };

  const handleRequest = async (req, newStatus) => {
    await supabase.from('friendships').update({ status: newStatus }).eq('id', req.id);
    // Обновляем списки после действия
    fetchAllFriendships();
  };

  const copyCodeToClipboard = () => {
    if (user?.friend_code) {
        navigator.clipboard.writeText(user.friend_code)
            .then(() => alert('Код скопирован!'))
            .catch(err => console.error('Failed to copy: ', err));
    }
  };

  return (
    <div className="ui-fullscreen-menu">
      <h2>Друзья</h2>
      <div className="leaderboard-list">
        {/* Мой код */}
        <div className="friend-section">
          <h4>Мой код дружбы (нажми, чтобы скопировать):</h4>
          <p className="friend-code" onClick={copyCodeToClipboard}>{user?.friend_code || 'Загрузка...'}</p>
        </div>

        {/* Добавить друга */}
        <div className="friend-section">
          <h4>Добавить по коду:</h4>
          <div className="input-group">
            <input
              type="text"
              value={friendCodeInput}
              onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC-DEF"
              maxLength="7"
            />
            <button onClick={handleAddFriend} className="text-button small">Ок</button>
          </div>
        </div>

        {/* Входящие заявки */}
        <div className="friend-section">
          <h4>Входящие заявки:</h4>
          {loading ? <p>Загрузка...</p> : friendships.requests.length > 0 ? (
            friendships.requests.map(req => (
              <div key={req.id} className="friend-entry">
                <span>{req.user1.username}</span>
                <div>
                  <button onClick={() => handleRequest(req, 'accepted')} className="text-button small">✓</button>
                  <button onClick={() => handleRequest(req, 'declined')} className="text-button small danger">×</button>
                </div>
              </div>
            ))
          ) : <p>Нет новых заявок.</p>}
        </div>

        {/* Мои друзья */}
        <div className="friend-section">
          <h4>Мои друзья:</h4>
           {loading ? <p>Загрузка...</p> : friendships.friends.length > 0 ? (
            friendships.friends.map(friend => (
              <div key={friend.user_id} className="friend-entry">
                <span>{friend.username}</span>
                <button onClick={() => onSendSabotage(friend.user_id)} className="text-button small">Подлянка</button>
              </div>
            ))
          ) : <p>У вас пока нет друзей.</p>}
        </div>
      </div>
      <button onClick={onBack} className="text-button">Назад</button>
    </div>
  );
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ИГРЫ ---

function Game() {
  const [gameState, setGameState] = useState('menu');
  const [user, setUser] = useState(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [scores, setScores] = useState([]);
  const [activeSabotage, setActiveSabotage] = useState(null);
  const [blocks, setBlocks] = useState([
    { position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' },
  ]);
  const clickCooldown = useRef(false);
  const activeBlockPositionRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');

    const initUser = async (tgUser) => {
        let { data: userData } = await supabase.from('scores').select('*').eq('user_id', tgUser.id).single();
        if (userData) {
            if (!userData.friend_code) {
                const { data: code } = await supabase.rpc('generate_friend_code');
                if (code) {
                    const { data: updatedUser } = await supabase.from('scores').update({ friend_code: code }).eq('user_id', tgUser.id).select().single();
                    setUser(updatedUser);
                } else {
                    setUser(userData);
                }
            } else {
                setUser(userData);
            }
        } else {
            const { data: code } = await supabase.rpc('generate_friend_code');
            const { data: newUser } = await supabase.from('scores').insert({ user_id: tgUser.id, username: tgUser.username, friend_code: code }).select().single();
            setUser(newUser);
        }
        setIsUserLoading(false);
    };

    const setupTelegramUser = () => {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
        if (tgUser && tgUser.id) {
          const formattedUser = { id: tgUser.id, username: tgUser.username || `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() || 'Аноним' };
          initUser(formattedUser);
        } else {
          setUser({ id: 12345, username: 'Тестовый Игрок', friend_code: 'TEST-CODE', user_id: 12345 });
          setIsUserLoading(false);
        }
      } else {
        setUser({ id: 12345, username: 'Тестовый Игрок', friend_code: 'TEST-CODE', user_id: 12345 });
        setIsUserLoading(false);
      }
    };

    setupTelegramUser();
  }, []);

  const checkForSabotage = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('sabotages')
      .select('*')
      .eq('receiver_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking for sabotage:', error);
    }

    if (data) {
      setActiveSabotage(data);
      alert('Внимание! Вам прислали подлянку "Скользкая коробка"! Первый блок будет двигаться быстрее.');
    } else {
      setActiveSabotage(null);
    }
  };

  const consumeSabotage = async () => {
    if (!activeSabotage) return;
    await supabase.from('sabotages').update({ is_active: false }).eq('id', activeSabotage.id);
    setActiveSabotage(null);
  };

  const startGame = async () => {
    await checkForSabotage();
    setGameState('playing');
  };

  const restartGame = async () => {
    setBlocks([{ position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' }]);
    await checkForSabotage();
    setGameState('playing');
  };

  const pauseGame = () => setGameState('paused');
  const resumeGame = () => setGameState('playing');

  const goToMenu = () => {
    setBlocks([{ position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' }]);
    setGameState('menu');
  };

  const showLeaderboard = async () => {
    setScores([]);
    setGameState('leaderboard');
    const { data, error } = await supabase.from('scores').select('user_id, username, score').order('score', { ascending: false }).limit(100);
    if (data) setScores(data);
  };

  const showFriends = () => setGameState('friends');

  const sendSabotage = async (receiverId) => {
    if (!user) return;
    const { error } = await supabase.from('sabotages').insert({ sender_id: user.id, receiver_id: receiverId, sabotage_type: 'slippery_box' });
    if (error) {
      alert('Не удалось отправить подлянку.');
      console.error(error);
    } else {
      alert(`Подлянка успешно отправлена!`);
    }
  };

  const gameOver = async () => {
    setGameState('gameOver');
    if (!user) return;
    const currentScore = blocks.length - 1;
    if (currentScore <= 0) return;
    await supabase.rpc('update_score_if_higher', { new_user_id: user.id, new_username: user.username, new_score: currentScore });
  };

  const placeBlock = () => {
    if (clickCooldown.current || gameState !== 'playing') return;
    clickCooldown.current = true;
    setTimeout(() => { clickCooldown.current = false; }, 100);

    if (activeSabotage) {
      consumeSabotage();
    }

    const prevBlock = blocks[blocks.length - 1];
    const newBlock = { position: activeBlockPositionRef.current.toArray(), size: [...prevBlock.size], color: `hsl(${blocks.length * 15}, 70%, 50%)` };
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
  const blockSpeedMultiplier = (activeSabotage && activeSabotage.sabotage_type === 'slippery_box') ? 1.5 : 1;

  return (
    <div className="app-container">
      {gameState === 'menu' && <MainMenu onPlay={startGame} onShowLeaderboard={showLeaderboard} onShowFriends={showFriends} />}
      {gameState === 'paused' && <PauseMenu onResume={resumeGame} onRestart={restartGame} onGoToMenu={goToMenu} />}
      {gameState === 'leaderboard' && <Leaderboard onBack={goToMenu} scores={scores} />}
      {gameState === 'friends' && !isUserLoading && <FriendsPage user={user} onBack={goToMenu} onSendSabotage={sendSabotage} />}
      {gameState === 'gameOver' && (
        <div className="game-over-ui" onClick={restartGame}>
          <img src={gameOverImage} alt="Game Over" className="game-over-image" />
          <p>Ваш счет: {score}</p>
          <p>Кликните, чтобы начать заново</p>
        </div>
      )}
      {gameState === 'playing' && (
        <>
          <div className="score-ui"><p>{score}</p></div>
          <img src={pauseButtonImage} alt="Pause" className="pause-button" onClick={pauseGame} />
        </>
      )}
      <Canvas shadows camera={{ position: [0, 5, 8], fov: 75 }}>
        <GameCamera towerHeight={towerHeight} />
        <ambientLight intensity={0.6} />
        <directionalLight castShadow position={[10, 20, 5]} intensity={1.0} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
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
            speedMultiplier={blockSpeedMultiplier}
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