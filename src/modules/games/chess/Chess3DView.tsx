import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { Box, IconButton, Tooltip } from '@mui/material';
import { CenterFocusStrong, RotateLeft } from '@mui/icons-material';
import { Board, Move, Piece, PieceColor, PieceType, Position, UITheme } from './chessTypes';

interface Chess3DViewProps {
  board: Board;
  turn: PieceColor;
  selectedPos: Position | null;
  legalMoves: Move[];
  lastMove: Move | null;
  activeHint?: Move | null;
  isCheck: boolean;
  isFlipped: boolean;
  themeMode: UITheme;
  onSelectSquare: (pos: Position) => void;
}

// =========================================================================
// 3D PROCEDURAL CHESS PIECE COMPONENT
// =========================================================================

interface Piece3DProps {
  type: PieceType;
  color: PieceColor;
  isSelected: boolean;
  themeMode: UITheme;
}

const Piece3D: React.FC<Piece3DProps> = ({ type, color, isSelected, themeMode }) => {
  const isNeon = themeMode === '3d-neon';
  const groupRef = useRef<THREE.Group>(null);

  // Neon colors vs Realistic Wood colors
  const primaryColor = isNeon
    ? color === 'w'
      ? '#06B6D4' // Cyan neon
      : '#F43F5E' // Crimson neon
    : color === 'w'
    ? '#F8FAFC' // Polished Ivory/Maple
    : '#1E293B'; // Deep Walnut Obsidian

  const emissiveColor = isNeon
    ? color === 'w'
      ? '#0891B2'
      : '#E11D48'
    : isSelected
    ? '#6366F1'
    : '#000000';

  const emissiveIntensity = isNeon ? 0.6 : isSelected ? 0.4 : 0.05;

  useFrame(() => {
    if (groupRef.current && isSelected) {
      groupRef.current.position.y = 0.25 + Math.sin(Date.now() * 0.006) * 0.08;
    } else if (groupRef.current) {
      groupRef.current.position.y = 0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Universal Pedestal Base */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.16, 24]} />
        <meshStandardMaterial
          color={primaryColor}
          roughness={isNeon ? 0.2 : 0.4}
          metalness={isNeon ? 0.8 : 0.1}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* Piece Specific Body Geometries */}
      {type === 'p' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.28, 0.36, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow>
            <sphereGeometry args={[0.18, 20, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        </group>
      )}

      {type === 'r' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.3, 0.5, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Battlement rim */}
          <mesh position={[0, 0.54, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.24, 0.14, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        </group>
      )}

      {type === 'n' && (
        <group position={[0, 0.16, 0]} rotation={[0, color === 'w' ? 0 : Math.PI, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.28, 0.44, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Angled Horse Head */}
          <mesh position={[0, 0.48, 0.08]} rotation={[0.4, 0, 0]} castShadow>
            <boxGeometry args={[0.22, 0.32, 0.34]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        </group>
      )}

      {type === 'b' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.28, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.28, 0.56, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Mitre top */}
          <mesh position={[0, 0.62, 0]} castShadow>
            <sphereGeometry args={[0.18, 18, 18]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        </group>
      )}

      {type === 'q' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.3, 0.64, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Flared crown */}
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.18, 0.18, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          <mesh position={[0, 0.85, 0]} castShadow>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial
              color={isNeon ? '#FBBF24' : '#EAB308'}
              emissive={isNeon ? '#FBBF24' : '#CA8A04'}
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
      )}

      {type === 'k' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.32, 0.72, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          <mesh position={[0, 0.78, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.22, 0.16, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Royal Cross */}
          <mesh position={[0, 0.94, 0]} castShadow>
            <boxGeometry args={[0.07, 0.18, 0.05]} />
            <meshStandardMaterial
              color={isNeon ? '#FBBF24' : '#EAB308'}
              emissive={isNeon ? '#FBBF24' : '#CA8A04'}
              emissiveIntensity={0.6}
            />
          </mesh>
          <mesh position={[0, 0.96, 0]} castShadow>
            <boxGeometry args={[0.16, 0.06, 0.05]} />
            <meshStandardMaterial
              color={isNeon ? '#FBBF24' : '#EAB308'}
              emissive={isNeon ? '#FBBF24' : '#CA8A04'}
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};

// =========================================================================
// 3D BOARD & TILE COMPONENT
// =========================================================================

interface Board3DProps {
  board: Board;
  turn: PieceColor;
  selectedPos: Position | null;
  legalMoves: Move[];
  lastMove: Move | null;
  activeHint?: Move | null;
  isCheck: boolean;
  themeMode: UITheme;
  onSelectSquare: (pos: Position) => void;
}

const Board3D: React.FC<Board3DProps> = ({
  board,
  turn,
  selectedPos,
  legalMoves,
  lastMove,
  activeHint,
  isCheck,
  themeMode,
  onSelectSquare,
}) => {
  const isNeon = themeMode === '3d-neon';

  // Tile palette
  const lightTileColor = isNeon ? '#0F172A' : '#F1F5F9';
  const darkTileColor = isNeon ? '#020617' : '#475569';
  const frameColor = isNeon ? '#090D16' : '#1E293B';

  const [hoveredPos, setHoveredPos] = useState<Position | null>(null);

  return (
    <group position={[0, 0, 0]}>
      {/* Outer Board Frame */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[8.8, 0.24, 8.8]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={isNeon ? 0.3 : 0.5}
          metalness={isNeon ? 0.7 : 0.1}
        />
      </mesh>

      {/* Frame Border Glow for Neon mode */}
      {isNeon && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.4, 4.45, 4]} />
          <meshBasicMaterial color="#6366F1" wireframe />
        </mesh>
      )}

      {/* 64 Board Squares & Pieces */}
      {Array.from({ length: 8 }).map((_, r) =>
        Array.from({ length: 8 }).map((_, c) => {
          // World 3D coordinates: center is [0, 0], spacing is 1.0 unit per square
          // r: 0..7 -> Z: -3.5 .. +3.5
          // c: 0..7 -> X: -3.5 .. +3.5
          const posX = c - 3.5;
          const posZ = r - 3.5;

          const isLight = (r + c) % 2 === 0;
          const piece = board[r][c];

          const isSelected = selectedPos && selectedPos[0] === r && selectedPos[1] === c;
          const isHintFrom = activeHint && activeHint.from[0] === r && activeHint.from[1] === c;
          const isHintTo = activeHint && activeHint.to[0] === r && activeHint.to[1] === c;
          const isHovered = hoveredPos && hoveredPos[0] === r && hoveredPos[1] === c;
          const legalTarget = legalMoves.find((m) => m.to[0] === r && m.to[1] === c);
          const isLastMove =
            lastMove &&
            ((lastMove.from[0] === r && lastMove.from[1] === c) ||
              (lastMove.to[0] === r && lastMove.to[1] === c));
          const isKingInCheck = isCheck && piece?.type === 'k' && piece?.color === turn;

          let tileColor = isLight ? lightTileColor : darkTileColor;
          let tileEmissive = '#000000';
          let tileEmissiveIntensity = 0;

          if (isSelected) {
            tileColor = '#F59E0B';
            tileEmissive = '#F59E0B';
            tileEmissiveIntensity = 0.5;
          } else if (isHintFrom || isHintTo) {
            tileColor = isHintFrom ? '#10B981' : '#34D399';
            tileEmissive = '#10B981';
            tileEmissiveIntensity = 0.8;
          } else if (isKingInCheck) {
            tileColor = '#EF4444';
            tileEmissive = '#EF4444';
            tileEmissiveIntensity = 0.8;
          } else if (isLastMove) {
            tileColor = isLight ? '#7DD3FC' : '#0284C7';
            tileEmissive = '#0284C7';
            tileEmissiveIntensity = 0.3;
          } else if (isHovered) {
            tileEmissive = isNeon ? '#38BDF8' : '#94A3B8';
            tileEmissiveIntensity = 0.25;
          }

          return (
            <group key={`sq-${r}-${c}`} position={[posX, 0, posZ]}>
              {/* Tile Mesh */}
              <mesh
                receiveShadow
                position={[0, 0, 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSquare([r, c]);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHoveredPos([r, c]);
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  setHoveredPos(null);
                  document.body.style.cursor = 'default';
                }}
              >
                <boxGeometry args={[0.98, 0.08, 0.98]} />
                <meshStandardMaterial
                  color={tileColor}
                  roughness={isNeon ? 0.2 : 0.4}
                  metalness={isNeon ? 0.6 : 0.05}
                  emissive={tileEmissive}
                  emissiveIntensity={tileEmissiveIntensity}
                />
              </mesh>

              {/* Legal Move Indicator (Floating glowing disc) */}
              {legalTarget && (
                <mesh
                  position={[0, 0.06, 0]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSquare([r, c]);
                  }}
                >
                  <cylinderGeometry
                    args={[piece ? 0.42 : 0.16, piece ? 0.42 : 0.16, 0.02, 24]}
                  />
                  <meshStandardMaterial
                    color={piece ? '#EF4444' : '#6366F1'}
                    emissive={piece ? '#EF4444' : '#6366F1'}
                    emissiveIntensity={0.8}
                    transparent
                    opacity={0.85}
                  />
                </mesh>
              )}

              {/* Chess Piece */}
              {piece && (
                <Piece3D
                  type={piece.type}
                  color={piece.color}
                  isSelected={!!isSelected}
                  themeMode={themeMode}
                />
              )}
            </group>
          );
        })
      )}
    </group>
  );
};

// =========================================================================
// MAIN 3D CHESS VIEW WITH CANVAS & CONTROLS
// =========================================================================

export const Chess3DView: React.FC<Chess3DViewProps> = ({
  board,
  turn,
  selectedPos,
  legalMoves,
  lastMove,
  activeHint,
  isCheck,
  isFlipped,
  themeMode,
  onSelectSquare,
}) => {
  const controlsRef = useRef<any>(null);

  // Camera initial position based on flip
  const cameraZ = isFlipped ? -7.5 : 7.5;

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const isNeon = themeMode === '3d-neon';

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 720,
        height: { xs: 460, sm: 540, md: 620 },
        mx: 'auto',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
        bgcolor: isNeon ? '#030712' : '#0F172A',
        boxShadow: isNeon
          ? '0 25px 50px -12px rgba(6, 182, 212, 0.25), inset 0 0 0 1px rgba(6, 182, 212, 0.3)'
          : '0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* 3D Camera reset floating button */}
      <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 1 }}>
        <Tooltip title="Reset 3D Camera">
          <IconButton
            size="small"
            onClick={handleResetCamera}
            sx={{
              bgcolor: 'rgba(15, 23, 42, 0.75)',
              color: '#FFFFFF',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'rgba(30, 41, 59, 0.9)' },
            }}
          >
            <CenterFocusStrong fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Three.js R3F Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 7.5, cameraZ], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={isNeon ? 0.6 : 0.8} />
        <directionalLight
          position={[6, 12, 8]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
        />
        <pointLight position={[-6, 8, -6]} intensity={0.6} color={isNeon ? '#06B6D4' : '#FFFFFF'} />
        <pointLight position={[6, 8, -6]} intensity={0.6} color={isNeon ? '#F43F5E' : '#FFFFFF'} />

        <Board3D
          board={board}
          turn={turn}
          selectedPos={selectedPos}
          legalMoves={legalMoves}
          lastMove={lastMove}
          activeHint={activeHint}
          isCheck={isCheck}
          themeMode={themeMode}
          onSelectSquare={onSelectSquare}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={5}
          maxDistance={14}
          dampingFactor={0.08}
        />
      </Canvas>
    </Box>
  );
};
