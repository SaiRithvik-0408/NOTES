import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, Edges } from '@react-three/drei';
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

  // Neon colors vs Realistic Wood / Porcelain colors
  const primaryColor = isNeon
    ? color === 'w'
      ? '#06B6D4' // Cyan neon
      : '#F43F5E' // Crimson neon
    : color === 'w'
    ? '#FFFFFF' // Bright Pure White (crystal clear against light squares)
    : '#0F172A'; // Deep Obsidian Midnight

  const emissiveColor = isNeon
    ? color === 'w'
      ? '#0891B2'
      : '#E11D48'
    : isSelected
    ? '#6366F1'
    : '#000000';

  const emissiveIntensity = isNeon ? 0.6 : isSelected ? 0.4 : 0.05;

  // High contrast outline: Jet black outline on White pieces, Brilliant glowing-white outline on Black pieces;
  // In Neon mode: Electric brilliant cyan-white glow on White pieces, Electric brilliant pink-white glow on Black pieces
  const outlineColor = isNeon
    ? color === 'w' ? '#A5F3FC' : '#FECDD3'
    : color === 'w' ? '#000000' : '#FFFFFF';

  const rimAccentColor = isNeon
    ? color === 'w' ? '#22D3EE' : '#FB7185'
    : color === 'w' ? '#000000' : '#FFFFFF';

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
        <cylinderGeometry args={[0.34, 0.39, 0.16, 28]} />
        <meshStandardMaterial
          color={primaryColor}
          roughness={isNeon ? 0.2 : 0.35}
          metalness={isNeon ? 0.8 : 0.12}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
        <Edges threshold={15} color={outlineColor} />
      </mesh>

      {/* High-Contrast Pedestal Rim Ring (Black on White piece, White on Black piece, Neon accents) */}
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.398, 0.406, 0.03, 32]} />
        <meshStandardMaterial
          color={rimAccentColor}
          roughness={0.2}
          metalness={isNeon ? 0.8 : color === 'w' ? 0.1 : 0.9}
          emissive={rimAccentColor}
          emissiveIntensity={isNeon ? 0.8 : color === 'w' ? 0 : 0.45}
        />
      </mesh>

      {/* Pedestal Collar */}
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.34, 0.04, 28]} />
        <meshStandardMaterial
          color={primaryColor}
          roughness={isNeon ? 0.2 : 0.35}
          metalness={isNeon ? 0.8 : 0.12}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
        <Edges threshold={15} color={outlineColor} />
      </mesh>

      {/* High-Contrast Collar Outline Trim */}
      <mesh position={[0, 0.17, 0]}>
        <torusGeometry args={[0.335, 0.016, 12, 32]} />
        <meshStandardMaterial
          color={rimAccentColor}
          roughness={0.2}
          metalness={isNeon ? 0.8 : color === 'w' ? 0.1 : 0.9}
          emissive={rimAccentColor}
          emissiveIntensity={isNeon ? 0.8 : color === 'w' ? 0 : 0.45}
        />
      </mesh>

      {/* PAWN */}
      {type === 'p' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.16, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.26, 0.32, 22]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Pawn Collar Accent Trim */}
          <mesh position={[0, 0.33, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.16, 0.04, 22]} />
            <meshStandardMaterial
              color={rimAccentColor}
              roughness={0.2}
              metalness={isNeon ? 0.8 : color === 'w' ? 0.1 : 0.9}
              emissive={rimAccentColor}
              emissiveIntensity={isNeon ? 0.8 : color === 'w' ? 0 : 0.45}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Head Sphere */}
          <mesh position={[0, 0.44, 0]} castShadow>
            <sphereGeometry args={[0.17, 22, 22]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
        </group>
      )}

      {/* ROOK (Castellated Tower with 4 Battlements) */}
      {type === 'r' && (
        <group position={[0, 0.16, 0]}>
          {/* Main Tower Body */}
          <mesh position={[0, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.23, 0.29, 0.48, 22]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Turret Platform */}
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.29, 0.23, 0.1, 24]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* 4 Crenellated Parapets */}
          <mesh position={[0.18, 0.58, 0]} castShadow>
            <boxGeometry args={[0.08, 0.09, 0.16]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          <mesh position={[-0.18, 0.58, 0]} castShadow>
            <boxGeometry args={[0.08, 0.09, 0.16]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          <mesh position={[0, 0.58, 0.18]} castShadow>
            <boxGeometry args={[0.16, 0.09, 0.08]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          <mesh position={[0, 0.58, -0.18]} castShadow>
            <boxGeometry args={[0.16, 0.09, 0.08]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
        </group>
      )}

      {/* KNIGHT (Sculpted Horse Head with Muzzle & Pointed Ears) */}
      {type === 'n' && (
        <group position={[0, 0.16, 0]} rotation={[0, color === 'w' ? 0 : Math.PI, 0]}>
          {/* Arched Neck */}
          <mesh position={[0, 0.24, -0.03]} rotation={[-0.18, 0, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.26, 0.44, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Sculpted Head & Brow */}
          <mesh position={[0, 0.48, 0.06]} rotation={[0.42, 0, 0]} castShadow>
            <boxGeometry args={[0.22, 0.28, 0.32]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Snout / Muzzle */}
          <mesh position={[0, 0.38, 0.22]} rotation={[0.7, 0, 0]} castShadow>
            <boxGeometry args={[0.16, 0.15, 0.22]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Mane Crest */}
          <mesh position={[0, 0.44, -0.14]} rotation={[-0.35, 0, 0]} castShadow>
            <boxGeometry args={[0.06, 0.32, 0.12]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Left Ear */}
          <mesh position={[0.08, 0.64, -0.03]} rotation={[0.15, 0, 0.15]} castShadow>
            <coneGeometry args={[0.045, 0.14, 12]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Right Ear */}
          <mesh position={[-0.08, 0.64, -0.03]} rotation={[0.15, 0, -0.15]} castShadow>
            <coneGeometry args={[0.045, 0.14, 12]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        </group>
      )}

      {/* BISHOP (Pointed Mitre with Slit & Finial) */}
      {type === 'b' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.26, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.27, 0.52, 22]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Collar Rim Accent Trim */}
          <mesh position={[0, 0.52, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.18, 0.04, 22]} />
            <meshStandardMaterial
              color={rimAccentColor}
              roughness={0.2}
              metalness={isNeon ? 0.8 : color === 'w' ? 0.1 : 0.9}
              emissive={rimAccentColor}
              emissiveIntensity={isNeon ? 0.8 : color === 'w' ? 0 : 0.45}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Mitre Teardrop Dome */}
          <mesh position={[0, 0.68, 0]} castShadow>
            <sphereGeometry args={[0.18, 20, 20]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Pointed Mitre Peak */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <coneGeometry args={[0.12, 0.2, 18]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Finial Ball */}
          <mesh position={[0, 0.92, 0]} castShadow>
            <sphereGeometry args={[0.05, 14, 14]} />
            <meshStandardMaterial
              color={isNeon ? '#FBBF24' : '#CA8A04'}
              emissive={isNeon ? '#FBBF24' : '#CA8A04'}
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
      )}

      {/* QUEEN (Flared Coronet Crown with Golden Top Orb) */}
      {type === 'q' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.21, 0.29, 0.64, 24]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Mid-waist Ring Accent Trim */}
          <mesh position={[0, 0.58, 0]} castShadow>
            <torusGeometry args={[0.21, 0.03, 12, 24]} />
            <meshStandardMaterial
              color={rimAccentColor}
              roughness={0.2}
              metalness={isNeon ? 0.8 : color === 'w' ? 0.1 : 0.9}
              emissive={rimAccentColor}
              emissiveIntensity={isNeon ? 0.8 : color === 'w' ? 0 : 0.45}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Flared Coronet Basin */}
          <mesh position={[0, 0.74, 0]} castShadow>
            <cylinderGeometry args={[0.29, 0.19, 0.22, 24]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Coronet Spheres */}
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = (i * Math.PI) / 3;
            const x = Math.cos(angle) * 0.25;
            const z = Math.sin(angle) * 0.25;
            return (
              <mesh key={i} position={[x, 0.86, z]} castShadow>
                <sphereGeometry args={[0.04, 12, 12]} />
                <meshStandardMaterial
                  color={isNeon ? '#FBBF24' : '#CA8A04'}
                  emissive={isNeon ? '#FBBF24' : '#CA8A04'}
                  emissiveIntensity={0.5}
                />
              </mesh>
            );
          })}
          {/* Central Royal Orb */}
          <mesh position={[0, 0.88, 0]} castShadow>
            <sphereGeometry args={[0.08, 18, 18]} />
            <meshStandardMaterial
              color={isNeon ? '#FBBF24' : '#EAB308'}
              emissive={isNeon ? '#FBBF24' : '#CA8A04'}
              emissiveIntensity={0.7}
            />
          </mesh>
        </group>
      )}

      {/* KING (Imperial Tiered Crown with Golden Cross) */}
      {type === 'k' && (
        <group position={[0, 0.16, 0]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.23, 0.31, 0.72, 24]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Mid-waist Ring Accent Trim */}
          <mesh position={[0, 0.65, 0]} castShadow>
            <torusGeometry args={[0.24, 0.035, 12, 24]} />
            <meshStandardMaterial
              color={rimAccentColor}
              roughness={0.2}
              metalness={isNeon ? 0.8 : color === 'w' ? 0.1 : 0.9}
              emissive={rimAccentColor}
              emissiveIntensity={isNeon ? 0.8 : color === 'w' ? 0 : 0.45}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Crown Head Cap Accent Trim */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.22, 0.18, 24]} />
            <meshStandardMaterial
              color={rimAccentColor}
              roughness={0.2}
              metalness={isNeon ? 0.8 : color === 'w' ? 0.1 : 0.9}
              emissive={rimAccentColor}
              emissiveIntensity={isNeon ? 0.8 : color === 'w' ? 0 : 0.45}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Crown Dome */}
          <mesh position={[0, 0.9, 0]} castShadow>
            <sphereGeometry args={[0.18, 18, 18]} />
            <meshStandardMaterial
              color={primaryColor}
              roughness={0.3}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
            <Edges threshold={15} color={outlineColor} />
          </mesh>
          {/* Royal Cross - Vertical bar */}
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[0.07, 0.22, 0.05]} />
            <meshStandardMaterial
              color={isNeon ? '#FBBF24' : '#EAB308'}
              emissive={isNeon ? '#FBBF24' : '#CA8A04'}
              emissiveIntensity={0.8}
            />
          </mesh>
          {/* Royal Cross - Horizontal bar */}
          <mesh position={[0, 1.08, 0]} castShadow>
            <boxGeometry args={[0.2, 0.07, 0.05]} />
            <meshStandardMaterial
              color={isNeon ? '#FBBF24' : '#EAB308'}
              emissive={isNeon ? '#FBBF24' : '#CA8A04'}
              emissiveIntensity={0.8}
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
  isFlipped: boolean;
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
  isFlipped,
  onSelectSquare,
}) => {
  const isNeon = themeMode === '3d-neon';

  // High-contrast tile palette: in Classic, soft light slate marble (#E2E8F0) makes pure white pieces pop;
  // in Neon mode, deep indigo (#1E1B4B) vs midnight obsidian (#090D1A) makes glowing cyan and crimson pop!
  const lightTileColor = isNeon ? '#1E1B4B' : '#E2E8F0';
  const darkTileColor = isNeon ? '#090D1A' : '#334155';
  const frameColor = isNeon ? '#0B0F19' : '#1E293B';
  const coordColor = isNeon ? '#38BDF8' : '#F8FAFC';
  const coordGlow = isNeon ? '#0284C7' : '#0F172A';

  const [hoveredPos, setHoveredPos] = useState<Position | null>(null);

  // Files & Ranks for 3D frame coordinates
  const fileLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rankNumbers = ['8', '7', '6', '5', '4', '3', '2', '1'];

  return (
    <group position={[0, 0, 0]}>
      {/* Outer Board Frame */}
      <mesh position={[0, -0.14, 0]} receiveShadow>
        <boxGeometry args={[9.6, 0.28, 9.6]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={isNeon ? 0.25 : 0.45}
          metalness={isNeon ? 0.75 : 0.15}
        />
      </mesh>

      {/* Frame Border Accent Trim / Bevel */}
      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry args={[8.25, 0.05, 8.25]} />
        <meshStandardMaterial
          color={isNeon ? '#312E81' : '#0F172A'}
          roughness={0.4}
          metalness={isNeon ? 0.8 : 0.2}
          emissive={isNeon ? '#4338CA' : '#000000'}
          emissiveIntensity={isNeon ? 0.35 : 0}
        />
      </mesh>

      {/* Neon Perimeter Glow Trim */}
      {isNeon && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.12, 4.16, 4]} />
          <meshBasicMaterial color="#06B6D4" wireframe />
        </mesh>
      )}

      {/* 3D Coordinate Keys: Files (a-h) on Bottom Rail (Front) */}
      {Array.from({ length: 8 }).map((_, c) => {
        const posX = c - 3.5;
        const letter = isFlipped ? fileLetters[7 - c] : fileLetters[c];
        return (
          <Text
            key={`coord-f-b-${c}`}
            position={[posX, 0.02, 4.42]}
            rotation={[-Math.PI / 2.1, 0, 0]}
            fontSize={0.34}
            fontWeight={800}
            color={coordColor}
            outlineWidth={0.02}
            outlineColor={coordGlow}
          >
            {letter}
          </Text>
        );
      })}

      {/* 3D Coordinate Keys: Files (a-h) on Top Rail (Back) */}
      {Array.from({ length: 8 }).map((_, c) => {
        const posX = c - 3.5;
        const letter = isFlipped ? fileLetters[7 - c] : fileLetters[c];
        return (
          <Text
            key={`coord-f-t-${c}`}
            position={[posX, 0.02, -4.42]}
            rotation={[-Math.PI / 2.1, Math.PI, 0]}
            fontSize={0.34}
            fontWeight={800}
            color={coordColor}
            outlineWidth={0.02}
            outlineColor={coordGlow}
          >
            {letter}
          </Text>
        );
      })}

      {/* 3D Coordinate Keys: Ranks (1-8) on Left Rail */}
      {Array.from({ length: 8 }).map((_, r) => {
        const posZ = r - 3.5;
        const number = isFlipped ? rankNumbers[7 - r] : rankNumbers[r];
        return (
          <Text
            key={`coord-r-l-${r}`}
            position={[-4.42, 0.02, posZ]}
            rotation={[-Math.PI / 2.1, 0, 0]}
            fontSize={0.34}
            fontWeight={800}
            color={coordColor}
            outlineWidth={0.02}
            outlineColor={coordGlow}
          >
            {number}
          </Text>
        );
      })}

      {/* 3D Coordinate Keys: Ranks (1-8) on Right Rail */}
      {Array.from({ length: 8 }).map((_, r) => {
        const posZ = r - 3.5;
        const number = isFlipped ? rankNumbers[7 - r] : rankNumbers[r];
        return (
          <Text
            key={`coord-r-r-${r}`}
            position={[4.42, 0.02, posZ]}
            rotation={[-Math.PI / 2.1, 0, 0]}
            fontSize={0.34}
            fontWeight={800}
            color={coordColor}
            outlineWidth={0.02}
            outlineColor={coordGlow}
          >
            {number}
          </Text>
        );
      })}

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
            <group
              key={`sq-${r}-${c}`}
              position={[posX, 0, posZ]}
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
              {/* Tile Mesh */}
              <mesh receiveShadow position={[0, 0, 0]}>
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
                <mesh position={[0, 0.06, 0]}>
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
        <ambientLight intensity={isNeon ? 0.7 : 0.9} />
        <directionalLight
          position={[6, 12, 8]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
        />
        {/* Opposing fill/rim light for three-dimensional silhouette visibility from all angles */}
        <directionalLight
          position={[-6, 10, -8]}
          intensity={isNeon ? 1.0 : 0.85}
          color={isNeon ? '#06B6D4' : '#E2E8F0'}
        />
        <hemisphereLight
          args={[isNeon ? '#06B6D4' : '#FFFFFF', isNeon ? '#0F172A' : '#334155', isNeon ? 0.4 : 0.55]}
        />
        <pointLight position={[-6, 8, -6]} intensity={0.7} color={isNeon ? '#06B6D4' : '#FFFFFF'} />
        <pointLight position={[6, 8, -6]} intensity={0.7} color={isNeon ? '#F43F5E' : '#FFFFFF'} />

        <Board3D
          board={board}
          turn={turn}
          selectedPos={selectedPos}
          legalMoves={legalMoves}
          lastMove={lastMove}
          activeHint={activeHint}
          isCheck={isCheck}
          themeMode={themeMode}
          isFlipped={isFlipped}
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
