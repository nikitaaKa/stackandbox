import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, useBox } from '@react-three/cannon';
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

function Block({ position, size, color, isActive, onPositionUpdate, speedMultiplier = 1, moveDirection = 'x' }) {
  const meshRef = useRef();

  const initialX = position[0];
  const initialZ = position[2];

  useFrame((state) => {
    if (isActive) {
      const time = state.clock.getElapsedTime();
      const movement = Math.sin(time * 2 * speedMultiplier) * 3.5;

      if (moveDirection === 'x') {
        // Двигаем по X
        meshRef.current.position.x = movement;
        // А позицию по Z СОХРАНЯЕМ, а не сбрасываем
        meshRef.current.position.z = initialZ;
      } else { // moveDirection === 'z'
        // Двигаем по Z
        meshRef.current.position.z = movement;
        // А позицию по X СОХРАНЯЕМ
        meshRef.current.position.x = initialX;
      }

      onPositionUpdate(meshRef.current.position);
    }
  });

  // Важно: мы все еще используем проп `position` для первоначальной установки.
  // Наша логика в useFrame начинает работать сразу после этого.
  return (
    <mesh ref={meshRef} position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// --- ФИЗИКА И ФИЗИЧЕСКИЕ КОМПОНЕНТЫ ---
function PhysicalBlock({ position, size, color }) {
  // `useBox` - это хук из @react-three/cannon. Он создает физическое тело.
  // Мы делаем его статичным, задавая массу 0.
  const [ref] = useBox(() => ({
    mass: 0,
    position,
    args: size,
  }));

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function FallingScrap({ id, onRemove, position, size, color }) {
  // --- 1. Логика физики (из первой версии) ---
  const [ref] = useBox(() => ({
    mass: 1, // Динамическое тело
    position: position, // Начальная позиция
    args: size, // Размеры коллайдера
    restitution: 0.3, // Упругость для отскока
    // Случайное начальное вращение
    angularVelocity: [
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    ],
  }));

  // --- 2. Логика анимации и самоудаления (из второй версии) ---
  const materialRef = useRef();

  // Мы используем ref для timeAlive, чтобы его значение сохранялось между рендерами
  const timeAlive = useRef(0);

  useFrame((state, delta) => {
    // Прибавляем время, прошедшее с прошлого кадра
    timeAlive.current += delta;

    // После 8 секунд жизни начинаем плавно исчезать
    if (timeAlive.current > 8 && materialRef.current.opacity > 0) {
      // Уменьшаем прозрачность. `delta * 2` означает, что он исчезнет за 0.5 секунды.
      materialRef.current.opacity -= delta * 2;
    }

    // Когда блок стал полностью невидимым, вызываем функцию удаления
    // Проверяем `timeAlive > 8` чтобы onRemove не вызвался случайно в самом начале
    if (timeAlive.current > 8 && materialRef.current.opacity <= 0) {
      onRemove(id);
    }
  });

  // --- 3. JSX для рендера ---
  return (
    <mesh ref={ref} castShadow>
      {/* Геометрия с правильными размерами */}
      <boxGeometry args={size} />
      {/* Материал, которым мы можем управлять (менять прозрачность) */}
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        transparent={true} // Включаем режим прозрачности
        opacity={1}         // Начальная непрозрачность
      />
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

function FriendsPage({ user, onBack, onSendSabotage }) {
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendships, setFriendships] = useState({ requests: [], friends: [] });
  const [loading, setLoading] = useState(true);

  const fetchAllFriendships = async () => {
    if (!user || !user.user_id) return;
    setLoading(true);
    const { data: requestsData } = await supabase.from('friendships').select(`*, user1:scores!user1_id(username)`).eq('user2_id', user.user_id).eq('status', 'pending');
    const { data: friendsData } = await supabase.from('friendships').select(`*, user1:scores!user1_id(username, user_id), user2:scores!user2_id(username, user_id)`).or(`user1_id.eq.${user.user_id},user2_id.eq.${user.user_id}`).eq('status', 'accepted');
    setFriendships({
      requests: requestsData || [],
      friends: (friendsData || []).map(f => (f.user1_id === user.user_id ? f.user2 : f.user1)),
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchAllFriendships();
  }, [user]);

  const handleAddFriend = async () => {
    if (!friendCodeInput.trim()) return;
    const { data: friendData } = await supabase.from('scores').select('user_id').eq('friend_code', friendCodeInput.trim().toUpperCase()).single();
    if (!friendData) {
      alert('Пользователь с таким кодом не найден.');
      return;
    }
    if (friendData.user_id === user.user_id) {
      alert('Нельзя добавить себя в друзья.');
      return;
    }
    const { error } = await supabase.from('friendships').insert({ user1_id: user.user_id, user2_id: friendData.user_id, status: 'pending' });
    if (error) {
      alert('Не удалось отправить заявку. Возможно, она уже отправлена или вы уже друзья.');
    } else {
      alert('Заявка в друзья отправлена!');
      setFriendCodeInput('');
    }
  };

  const handleRequest = async (req, newStatus) => {
    await supabase.from('friendships').update({ status: newStatus }).eq('id', req.id);
    fetchAllFriendships();
  };

  const copyCodeToClipboard = () => {
    if (user?.friend_code) {
      navigator.clipboard.writeText(user.friend_code).then(() => alert('Код скопирован!')).catch(err => console.error('Failed to copy: ', err));
    }
  };

  return (
    <div className="ui-fullscreen-menu">
      <h2>Друзья</h2>
      <div className="leaderboard-list">
        <div className="friend-section">
          <h4>Мой код дружбы (нажми, чтобы скопировать):</h4>
          <p className="friend-code" onClick={copyCodeToClipboard}>{user?.friend_code || 'Загрузка...'}</p>
        </div>
        <div className="friend-section">
          <h4>Добавить по коду:</h4>
          <div className="input-group">
            <input type="text" value={friendCodeInput} onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())} placeholder="ABC-DEF" maxLength="7" />
            <button onClick={handleAddFriend} className="text-button small">Ок</button>
          </div>
        </div>
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
  const [sabotageTurn, setSabotageTurn] = useState(null);
  const [blocks, setBlocks] = useState([
      { position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray', type: 'static' },
  ]);
  const [scraps, setScraps] = useState([]);
  const clickCooldown = useRef(false);
  const activeBlockPositionRef = useRef(new THREE.Vector3());
  const moveDirection = (blocks.length % 2 === 1) ? 'x' : 'z';

  const removeScrap = (id) => {
    setScraps((prevScraps) => prevScraps.filter((scrap) => scrap.id !== id));
  };

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
    if (!user || !user.user_id) return;
    const { data } = await supabase.from('sabotages').select('*').eq('receiver_id', user.user_id).eq('is_active', true).limit(1);
    if (data && data.length > 0) {
      const sabotageData = data[0];
      setActiveSabotage(sabotageData);
      const triggerTurn = Math.floor(Math.random() * 11) + 8;
      setSabotageTurn(triggerTurn);
    } else {
      setActiveSabotage(null);
      setSabotageTurn(null);
    }
  };

  const consumeSabotage = async () => {
    if (!activeSabotage) return;
    await supabase.from('sabotages').update({ is_active: false }).eq('id', activeSabotage.id);
    setActiveSabotage(null);
    setSabotageTurn(null);
  };

  const isSabotageActiveNow = activeSabotage && blocks.length === sabotageTurn;

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
  const goToMenu = () => { setBlocks([{ position: [0, -0.5, 0], size: [3, 1, 3], color: 'gray' }]); setGameState('menu'); };

  const showLeaderboard = async () => {
    setScores([]);
    setGameState('leaderboard');
    const { data } = await supabase.from('scores').select('user_id, username, score').order('score', { ascending: false }).limit(100);
    if (data) setScores(data);
  };

  const showFriends = () => setGameState('friends');

  const sendSabotage = async (receiverId) => {
    if (!user) return;
    const { error } = await supabase.from('sabotages').insert({ sender_id: user.user_id, receiver_id: receiverId, sabotage_type: 'slippery_box' });
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
    await supabase.rpc('update_score_if_higher', { new_user_id: user.user_id, new_username: user.username, new_score: currentScore });
  };

  const placeBlock = () => {
    if (clickCooldown.current || gameState !== 'playing') return;
    clickCooldown.current = true;
    setTimeout(() => { clickCooldown.current = false; }, 100);

    if (isSabotageActiveNow) {
      consumeSabotage();
    }

    const prevBlock = blocks[blocks.length - 1];

    const newBlock = {
      position: activeBlockPositionRef.current.toArray(),
      size: [...prevBlock.size], // Новый блок наследует ПОЛНЫЙ размер предыдущего
      color: `hsl(${blocks.length * 15}, 70%, 50%)`,
      type: 'static',
    };

    let scrap = null;

    // moveDirection должен быть определен выше в компоненте Game
    // const moveDirection = (blocks.length % 2 === 1) ? 'x' : 'z';

    if (moveDirection === 'x') {
      // --- Обрезка по оси X ---
      const overlap = prevBlock.size[0] / 2 + newBlock.size[0] / 2 - Math.abs(prevBlock.position[0] - newBlock.position[0]);

      if (overlap <= 0) {
        gameOver();
        setScraps(s => [...s, { ...newBlock, id: Date.now() }]);
        return;
      } else {
        const finalWidth = overlap;
        const finalX = prevBlock.position[0] + (newBlock.position[0] - prevBlock.position[0]) / 2;

        // --- ЛОГИКА СОЗДАНИЯ ОБРЕЗКА ---
        const scrapWidth = prevBlock.size[0] - finalWidth;
        const scrapX = finalX + (finalWidth / 2 * Math.sign(newBlock.position[0] - prevBlock.position[0])) + (scrapWidth / 2 * Math.sign(newBlock.position[0] - prevBlock.position[0]));

        scrap = {
            id: Date.now(),
            position: [scrapX, newBlock.position[1], prevBlock.position[2]],
            size: [scrapWidth, newBlock.size[1], prevBlock.size[2]],
            color: newBlock.color,
        };

        newBlock.size[0] = finalWidth;
        newBlock.position[0] = finalX;
        newBlock.position[2] = prevBlock.position[2];
      }
    } else { // moveDirection === 'z'
      // --- Обрезка по оси Z ---
      const overlap = prevBlock.size[2] / 2 + newBlock.size[2] / 2 - Math.abs(prevBlock.position[2] - newBlock.position[2]);

      if (overlap <= 0) {
        gameOver();
        setScraps(s => [...s, { ...newBlock, id: Date.now() }]);
        return;
      } else {
        const finalDepth = overlap;
        const finalZ = prevBlock.position[2] + (newBlock.position[2] - prevBlock.position[2]) / 2;

        const scrapDepth = prevBlock.size[2] - finalDepth;
        const scrapZ = finalZ + (finalDepth / 2 * Math.sign(newBlock.position[2] - prevBlock.position[2])) + (scrapDepth / 2 * Math.sign(newBlock.position[2] - prevBlock.position[2]));

        scrap = {
            id: Date.now(),
            position: [prevBlock.position[0], newBlock.position[1], scrapZ],
            size: [prevBlock.size[0], newBlock.size[1], scrapDepth],
            color: newBlock.color,
        };

        newBlock.size[2] = finalDepth;
        newBlock.position[2] = finalZ;
        newBlock.position[0] = prevBlock.position[0];
      }
    }

    setBlocks(currentBlocks => [...currentBlocks, newBlock]);
    if (scrap) {
      setScraps(s => [...s, scrap]);
    }
  };

  const score = blocks.length - 1;
  const towerHeight = blocks.length - 0.5;
  const lastPlacedBlock = blocks[blocks.length - 1];
  const blockSpeedMultiplier = isSabotageActiveNow ? 1.5 : 1;
  const activeBlockColor = isSabotageActiveNow ? '#ff4d4d' : 'cyan';

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
        <Physics gravity={[0, -30, 0]}>
          {blocks.map((block, index) => (
            <PhysicalBlock
              key={index}
              position={block.position}
              size={block.size}
              color={block.color}
            />
          ))}
          {scraps.map((scrap) => (
            <FallingScrap key={scrap.id} id={scrap.id} onRemove={removeScrap} {...scrap} />
          ))}
        </Physics>
        {gameState === 'playing' && (
          <Block
            // Начальная позиция теперь наследуется от центра предыдущего блока,
            // но с новой высотой.
            position={[lastPlacedBlock.position[0], towerHeight, lastPlacedBlock.position[2]]}
            size={lastPlacedBlock.size}
            color={activeBlockColor}
            isActive={true}
            onPositionUpdate={(pos) => activeBlockPositionRef.current.copy(pos)}
            speedMultiplier={blockSpeedMultiplier}
            moveDirection={moveDirection}
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