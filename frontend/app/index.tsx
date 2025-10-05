import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  SafeAreaView
} from 'react-native';
import { Audio } from 'expo-av';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game constants
const GAME_CONFIG = {
  PLAYER_SIZE: 40,
  OBSTACLE_WIDTH: 30,
  OBSTACLE_HEIGHT: 40,
  ITEM_SIZE: 25,
  GROUND_HEIGHT: 100,
  JUMP_HEIGHT: 80,
  MOVE_SPEED: 3,
  OBSTACLES_PER_LEVEL: 8,
  TOTAL_LEVELS: 10
};

type GameState = 'menu' | 'playing' | 'paused' | 'gameOver' | 'levelComplete' | 'gameWon';
type ObstacleType = 'trash' | 'cigarette' | 'mud';
type ItemType = 'book' | 'apple' | 'cross' | 'toothbrush';

interface GameObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Obstacle extends GameObject {
  type: ObstacleType;
}

interface Item extends GameObject {
  type: ItemType;
  collected: boolean;
}

interface Player {
  x: number;
  y: number;
  isJumping: boolean;
  velocity: number;
}

interface GameData {
  currentLevel: number;
  maxLevel: number;
  score: number;
}

export default function MeuJovinhoGame() {
  // Game state
  const [gameState, setGameState] = useState<GameState>('menu');
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [maxLevel, setMaxLevel] = useState<number>(1);
  const [score, setScore] = useState<number>(0);
  const [showCapybara, setShowCapybara] = useState<boolean>(true);

  // Player state
  const [player, setPlayer] = useState<Player>({
    x: 50,
    y: SCREEN_HEIGHT - GAME_CONFIG.GROUND_HEIGHT - GAME_CONFIG.PLAYER_SIZE,
    isJumping: false,
    velocity: 0
  });

  // Game objects
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [collectedItems, setCollectedItems] = useState<number>(0);
  const [obstaclesPassed, setObstaclesPassed] = useState<number>(0);

  // Animations
  const playerY = useRef(new Animated.Value(player.y)).current;
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Input handling
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => gameState === 'playing',
    onMoveShouldSetPanResponder: () => gameState === 'playing',
    onPanResponderGrant: () => {
      if (!player.isJumping && gameState === 'playing') {
        jump();
      }
    }
  });

  // Load game data
  useEffect(() => {
    loadGameData();
    setupAudio();
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadGameData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('meuJovinhoData');
      if (savedData) {
        const data: GameData = JSON.parse(savedData);
        setMaxLevel(data.maxLevel || 1);
        setScore(data.score || 0);
      }
    } catch (error) {
      console.log('Error loading game data:', error);
    }
  };

  const saveGameData = async () => {
    try {
      const data: GameData = {
        currentLevel,
        maxLevel,
        score
      };
      await AsyncStorage.setItem('meuJovinhoData', JSON.stringify(data));
    } catch (error) {
      console.log('Error saving game data:', error);
    }
  };

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
    } catch (error) {
      console.log('Error setting up audio:', error);
    }
  };

  const playJesusFielAudio = () => {
    Speech.speak('Jesus é fiel!', {
      language: 'pt-BR',
      pitch: 1.2,
      rate: 0.8
    });
  };

  const generateObstacles = (level: number): Obstacle[] => {
    const obstacles: Obstacle[] = [];
    const obstacleTypes: ObstacleType[] = ['trash', 'cigarette', 'mud'];
    const spacing = Math.max(100, 200 - (level * 10)); // Closer spacing as level increases
    
    for (let i = 0; i < GAME_CONFIG.OBSTACLES_PER_LEVEL; i++) {
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      obstacles.push({
        id: `obstacle-${i}`,
        x: SCREEN_WIDTH + 100 + (i * spacing),
        y: SCREEN_HEIGHT - GAME_CONFIG.GROUND_HEIGHT - GAME_CONFIG.OBSTACLE_HEIGHT,
        width: GAME_CONFIG.OBSTACLE_WIDTH,
        height: GAME_CONFIG.OBSTACLE_HEIGHT,
        type
      });
    }
    return obstacles;
  };

  const generateItems = (level: number): Item[] => {
    const items: Item[] = [];
    const itemTypes: ItemType[] = ['book', 'apple', 'cross', 'toothbrush'];
    const itemCount = Math.min(8 + level, 12);
    const spacing = 120; // Fixed spacing between items
    
    for (let i = 0; i < itemCount; i++) {
      const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
      items.push({
        id: `item-${i}`,
        x: SCREEN_WIDTH + 80 + (i * spacing) + (Math.random() * 50),
        y: SCREEN_HEIGHT - GAME_CONFIG.GROUND_HEIGHT - GAME_CONFIG.ITEM_SIZE - 30 - (Math.random() * 60),
        width: GAME_CONFIG.ITEM_SIZE,
        height: GAME_CONFIG.ITEM_SIZE,
        type,
        collected: false
      });
    }
    return items;
  };

  const startGame = () => {
    console.log('Starting game...');
    setGameState('playing');
    setObstaclesPassed(0);
    setCollectedItems(0);
    
    // Clear any existing intervals
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    
    const newObstacles = generateObstacles(currentLevel);
    const newItems = generateItems(currentLevel);
    
    console.log('Generated obstacles:', newObstacles.length);
    console.log('Generated items:', newItems.length);
    
    setObstacles(newObstacles);
    setItems(newItems);
    
    resetPlayer();
    
    // Start game loop after a small delay to ensure state is updated
    setTimeout(() => {
      startGameLoop();
    }, 100);
  };

  const resetPlayer = () => {
    const initialY = SCREEN_HEIGHT - GAME_CONFIG.GROUND_HEIGHT - GAME_CONFIG.PLAYER_SIZE;
    setPlayer({
      x: 50,
      y: initialY,
      isJumping: false,
      velocity: 0
    });
    playerY.setValue(initialY);
  };

  const jump = () => {
    if (!player.isJumping) {
      setPlayer(prev => ({ ...prev, isJumping: true, velocity: -12 }));
    }
  };

  const startGameLoop = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    
    gameLoopRef.current = setInterval(() => {
      updateGame();
    }, 16); // ~60 FPS
  };

  const updateGame = () => {
    setPlayer(prevPlayer => {
      let newPlayer = { ...prevPlayer };
      
      // Apply gravity and jumping physics
      if (newPlayer.isJumping) {
        newPlayer.velocity += 0.6; // Gravity
        newPlayer.y += newPlayer.velocity;
        
        const groundY = SCREEN_HEIGHT - GAME_CONFIG.GROUND_HEIGHT - GAME_CONFIG.PLAYER_SIZE;
        if (newPlayer.y >= groundY) {
          newPlayer.y = groundY;
          newPlayer.isJumping = false;
          newPlayer.velocity = 0;
        }
        
        playerY.setValue(newPlayer.y);
      }
      
      return newPlayer;
    });
    
    // Move obstacles
    setObstacles(prevObstacles => {
      const speed = GAME_CONFIG.MOVE_SPEED + (currentLevel * 0.3);
      return prevObstacles.map(obstacle => ({
        ...obstacle,
        x: obstacle.x - speed
      })).filter(obstacle => obstacle.x > -GAME_CONFIG.OBSTACLE_WIDTH);
    });
    
    // Move items
    setItems(prevItems => {
      const speed = GAME_CONFIG.MOVE_SPEED + (currentLevel * 0.3);
      return prevItems.map(item => ({
        ...item,
        x: item.x - speed
      })).filter(item => item.x > -GAME_CONFIG.ITEM_SIZE);
    });
    
    // Check collisions
    checkCollisions();
  };

  const checkCollisions = () => {
    // Check obstacle collisions
    obstacles.forEach(obstacle => {
      if (
        player.x < obstacle.x + obstacle.width &&
        player.x + GAME_CONFIG.PLAYER_SIZE > obstacle.x &&
        player.y < obstacle.y + obstacle.height &&
        player.y + GAME_CONFIG.PLAYER_SIZE > obstacle.y
      ) {
        gameOver();
      }
      
      // Count passed obstacles
      if (obstacle.x + obstacle.width < player.x && obstacle.x + obstacle.width > player.x - 5) {
        setObstaclesPassed(prev => prev + 1);
      }
    });
    
    // Check item collisions
    setItems(prevItems => {
      return prevItems.map(item => {
        if (
          !item.collected &&
          player.x < item.x + item.width &&
          player.x + GAME_CONFIG.PLAYER_SIZE > item.x &&
          player.y < item.y + item.height &&
          player.y + GAME_CONFIG.PLAYER_SIZE > item.y
        ) {
          setCollectedItems(prev => prev + 1);
          setScore(prev => prev + 10);
          playJesusFielAudio();
          return { ...item, collected: true };
        }
        return item;
      });
    });
    
    // Check level completion
    if (obstaclesPassed >= GAME_CONFIG.OBSTACLES_PER_LEVEL) {
      levelComplete();
    }
  };

  const gameOver = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    setGameState('gameOver');
  };

  const levelComplete = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    
    if (currentLevel >= GAME_CONFIG.TOTAL_LEVELS) {
      setGameState('gameWon');
    } else {
      setGameState('levelComplete');
      if (currentLevel >= maxLevel) {
        setMaxLevel(currentLevel + 1);
      }
    }
    saveGameData();
  };

  const nextLevel = () => {
    setCurrentLevel(prev => prev + 1);
    startGame();
  };

  const restartLevel = () => {
    startGame();
  };

  const goToMenu = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    setGameState('menu');
    setCurrentLevel(1);
    resetPlayer();
  };

  const getObstacleEmoji = (type: ObstacleType): string => {
    switch (type) {
      case 'trash': return '🗑️';
      case 'cigarette': return '🚬';
      case 'mud': return '💩';
      default: return '⚫';
    }
  };

  const getItemEmoji = (type: ItemType): string => {
    switch (type) {
      case 'book': return '📚';
      case 'apple': return '🍎';
      case 'cross': return '✝️';
      case 'toothbrush': return '🪥';
      default: return '⭐';
    }
  };

  const renderPlayer = () => (
    <View
      style={[
        styles.player,
        {
          left: player.x,
          top: player.y,
        }
      ]}
    >
      <View style={styles.playerBody}>
        <View style={styles.playerCape} />
        <View style={styles.playerGlasses} />
        <Text style={styles.playerLetter}>C</Text>
      </View>
    </View>
  );

  const renderCapybara = () => {
    if (!showCapybara) return null;
    
    return (
      <View style={styles.capybaraContainer}>
        <Text style={styles.capybaraText}>🏆 Capivara te deseja boa sorte! 🏆</Text>
        <TouchableOpacity 
          style={styles.closeCapybaraButton} 
          onPress={() => setShowCapybara(false)}
        >
          <Text style={styles.closeCapybaraText}>OK</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (gameState === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.menuContainer}>
          <Text style={styles.gameTitle}>🦸‍♂️ MEU JOVINHO 🦸‍♂️</Text>
          <Text style={styles.gameSubtitle}>Jogo de Aventura Cristã</Text>
          
          {renderCapybara()}
          
          <View style={styles.heroPreview}>
            <View style={styles.playerBody}>
              <View style={styles.playerCape} />
              <View style={styles.playerGlasses} />
              <Text style={styles.playerLetter}>C</Text>
            </View>
          </View>
          
          <Text style={styles.instructions}>
            🎯 Pule os obstáculos e colete itens sagrados!
            {"\n"}✨ Fale "Jesus é fiel!" a cada item coletado
            {"\n"}🎮 Toque na tela para pular
          </Text>
          
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>🚀 INICIAR JOVINHO? 🚀</Text>
          </TouchableOpacity>
          
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>📊 Nível Máximo: {maxLevel}</Text>
            <Text style={styles.statsText}>🏆 Pontuação: {score}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (gameState === 'playing') {
    return (
      <View style={styles.container} {...panResponder.panHandlers}>
        <StatusBar style="light" />
        
        {/* UI */}
        <View style={styles.gameUI}>
          <Text style={styles.levelText}>Nível: {currentLevel}</Text>
          <Text style={styles.scoreText}>Pontos: {score}</Text>
          <Text style={styles.progressText}>
            Obstáculos: {obstaclesPassed}/{GAME_CONFIG.OBSTACLES_PER_LEVEL}
          </Text>
        </View>
        
        {/* Game world */}
        <View style={styles.gameWorld}>
          {/* Sky */}
          <View style={styles.sky} />
          
          {/* Clouds */}
          <Text style={[styles.cloud, { left: '10%', top: '15%' }]}>☁️</Text>
          <Text style={[styles.cloud, { left: '60%', top: '25%' }]}>☁️</Text>
          <Text style={[styles.cloud, { left: '30%', top: '10%' }]}>☁️</Text>
          
          {/* Player */}
          {renderPlayer()}
          
          {/* Obstacles */}
          {obstacles.map(obstacle => (
            <View
              key={obstacle.id}
              style={[
                styles.obstacle,
                {
                  left: obstacle.x,
                  top: obstacle.y,
                  width: obstacle.width,
                  height: obstacle.height
                }
              ]}
            >
              <Text style={styles.obstacleEmoji}>
                {getObstacleEmoji(obstacle.type)}
              </Text>
            </View>
          ))}
          
          {/* Items */}
          {items.map(item => (
            !item.collected && (
              <View
                key={item.id}
                style={[
                  styles.item,
                  {
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height
                  }
                ]}
              >
                <Text style={styles.itemEmoji}>
                  {getItemEmoji(item.type)}
                </Text>
              </View>
            )
          ))}
          
          {/* Ground */}
          <View style={styles.ground}>
            <Text style={styles.groundPattern}>🌱🌱🌱🌱🌱🌱🌱🌱🌱🌱</Text>
          </View>
        </View>
        
        {/* Jump button */}
        <TouchableOpacity style={styles.jumpButton} onPress={jump}>
          <Text style={styles.jumpButtonText}>⬆️ PULAR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (gameState === 'gameOver') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.menuContainer}>
          <Text style={styles.gameOverTitle}>💔 GAME OVER 💔</Text>
          <Text style={styles.gameOverText}>
            Você bateu em um obstáculo!
            {"\n"}Tente novamente e confie em Jesus!
          </Text>
          
          <TouchableOpacity style={styles.restartButton} onPress={restartLevel}>
            <Text style={styles.restartButtonText}>🔄 TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuButton} onPress={goToMenu}>
            <Text style={styles.menuButtonText}>🏠 MENU PRINCIPAL</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (gameState === 'levelComplete') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.menuContainer}>
          <Text style={styles.victoryTitle}>🎉 NÍVEL COMPLETO! 🎉</Text>
          <Text style={styles.victoryText}>
            Parabéns! Você completou o nível {currentLevel}!
            {"\n"}Itens coletados: {collectedItems}
            {"\n"}Jesus é fiel!
          </Text>
          
          <TouchableOpacity style={styles.nextButton} onPress={nextLevel}>
            <Text style={styles.nextButtonText}>➡️ PRÓXIMO NÍVEL</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuButton} onPress={goToMenu}>
            <Text style={styles.menuButtonText}>🏠 MENU PRINCIPAL</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (gameState === 'gameWon') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.menuContainer}>
          <Text style={styles.victoryTitle}>👑 VOCÊ VENCEU! 👑</Text>
          <Text style={styles.victoryText}>
            Incrível! Você completou todos os 10 níveis!
            {"\n"}Você é um verdadeiro jovinho de Jesus!
            {"\n"}Pontuação final: {score}
          </Text>
          
          <TouchableOpacity style={styles.restartButton} onPress={goToMenu}>
            <Text style={styles.restartButtonText}>🏠 JOGAR NOVAMENTE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 10,
  },
  gameSubtitle: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 20,
  },
  instructions: {
    fontSize: 14,
    color: '#e5e7eb',
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 20,
  },
  heroPreview: {
    marginVertical: 20,
  },
  startButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginVertical: 10,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  statsText: {
    color: '#e5e7eb',
    fontSize: 14,
    marginVertical: 2,
  },
  capybaraContainer: {
    backgroundColor: '#fbbf24',
    padding: 15,
    borderRadius: 15,
    marginVertical: 10,
    alignItems: 'center',
  },
  capybaraText: {
    fontSize: 14,
    color: '#1f2937',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  closeCapybaraButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    marginTop: 10,
  },
  closeCapybaraText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gameUI: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scoreText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  gameWorld: {
    flex: 1,
    position: 'relative',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT - GAME_CONFIG.GROUND_HEIGHT,
    backgroundColor: '#3b82f6',
  },
  cloud: {
    position: 'absolute',
    fontSize: 20,
  },
  player: {
    position: 'absolute',
    width: GAME_CONFIG.PLAYER_SIZE,
    height: GAME_CONFIG.PLAYER_SIZE,
    zIndex: 10,
  },
  playerBody: {
    width: GAME_CONFIG.PLAYER_SIZE,
    height: GAME_CONFIG.PLAYER_SIZE,
    backgroundColor: '#fbbf24',
    borderRadius: GAME_CONFIG.PLAYER_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  playerCape: {
    position: 'absolute',
    top: -5,
    left: -8,
    width: GAME_CONFIG.PLAYER_SIZE + 16,
    height: GAME_CONFIG.PLAYER_SIZE + 10,
    backgroundColor: '#92400e',
    borderRadius: (GAME_CONFIG.PLAYER_SIZE + 16) / 2,
    zIndex: -1,
  },
  playerGlasses: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 6,
  },
  playerLetter: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  obstacle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 5,
  },
  obstacleEmoji: {
    fontSize: 20,
  },
  item: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fbbf24',
    borderRadius: GAME_CONFIG.ITEM_SIZE / 2,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  itemEmoji: {
    fontSize: 16,
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: GAME_CONFIG.GROUND_HEIGHT,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groundPattern: {
    fontSize: 20,
    color: '#22c55e',
  },
  jumpButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    zIndex: 100,
  },
  jumpButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameOverTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 20,
  },
  gameOverText: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  victoryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
    textAlign: 'center',
    marginBottom: 20,
  },
  victoryText: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  restartButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    marginVertical: 10,
  },
  restartButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    marginVertical: 10,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  menuButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    marginVertical: 10,
  },
  menuButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});