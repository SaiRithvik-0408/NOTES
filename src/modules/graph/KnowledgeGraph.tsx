import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Paper, Typography, IconButton, Tooltip, Chip, Button } from '@mui/material';
import { CenterFocusStrong, Refresh, ZoomIn, ZoomOut, AutoAwesome } from '@mui/icons-material';
import { Note, Folder, Tag } from '../../types/note';

interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'folder' | 'tag';
  position: [number, number, number];
  color: string;
  size: number;
}

interface GraphLink {
  source: [number, number, number];
  target: [number, number, number];
  color: string;
}

interface KnowledgeGraphProps {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  onSelectNote: (noteId: string) => void;
}

// Interactive 3D Node Mesh
const NodeSphere: React.FC<{
  node: GraphNode;
  onSelect: (id: string) => void;
  hovered: boolean;
  setHovered: (id: string | null) => void;
}> = ({ node, onSelect, hovered, setHovered }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (hovered) {
      meshRef.current.scale.lerp(new THREE.Vector3(1.3, 1.3, 1.3), 0.1);
    } else {
      meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          if (node.type === 'note') onSelect(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(node.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[node.size, 24, 24]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={hovered ? 0.8 : 0.3}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* 3D Text Label */}
      <Text
        position={[0, node.size + 0.3, 0]}
        fontSize={0.28}
        color="#F8FAFC"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="#090D16"
      >
        {node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label}
      </Text>
    </group>
  );
};

// 3D Glowing Line for Graph Edge
const EdgeLine: React.FC<{ link: GraphLink }> = ({ link }) => {
  const points = useMemo(() => [new THREE.Vector3(...link.source), new THREE.Vector3(...link.target)], [link]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: link.color, transparent: true, opacity: 0.45 }))} />
  );
};

// Main Graph Scene
const GraphScene: React.FC<{
  nodes: GraphNode[];
  links: GraphLink[];
  onSelectNote: (id: string) => void;
  autoRotate: boolean;
}> = ({ nodes, links, onSelectNote, autoRotate }) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#8B5CF6" />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate}
        autoRotateSpeed={0.8}
        maxDistance={25}
        minDistance={3}
      />

      {/* Render Edges */}
      {links.map((link, idx) => (
        <EdgeLine key={`edge-${idx}`} link={link} />
      ))}

      {/* Render Nodes */}
      {nodes.map((node) => (
        <NodeSphere
          key={node.id}
          node={node}
          onSelect={onSelectNote}
          hovered={hoveredNodeId === node.id}
          setHovered={setHoveredNodeId}
        />
      ))}
    </>
  );
};

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  notes,
  folders,
  tags,
  onSelectNote,
}) => {
  const [autoRotate, setAutoRotate] = useState(true);

  // Compute 3D layout of nodes and links
  const { nodes, links } = useMemo(() => {
    const nodeList: GraphNode[] = [];
    const linkList: GraphLink[] = [];
    const posMap = new Map<string, [number, number, number]>();

    // 1. Position Folders in an outer orbit
    folders.forEach((folder, idx) => {
      const angle = (idx / Math.max(folders.length, 1)) * Math.PI * 2;
      const radius = 6;
      const pos: [number, number, number] = [
        Math.cos(angle) * radius,
        (Math.sin(angle * 2) * 2),
        Math.sin(angle) * radius,
      ];
      posMap.set(folder.id, pos);
      nodeList.push({
        id: folder.id,
        label: `${folder.icon || '📁'} ${folder.name}`,
        type: 'folder',
        position: pos,
        color: '#A855F7', // Purple
        size: 0.45,
      });
    });

    // 2. Position Notes clustered around their parent folders or central sphere
    notes.forEach((note, idx) => {
      let basePos: [number, number, number] = [0, 0, 0];
      if (note.folderId && posMap.has(note.folderId)) {
        const folderPos = posMap.get(note.folderId)!;
        const subAngle = idx * 1.5;
        basePos = [
          folderPos[0] + Math.cos(subAngle) * 2.2,
          folderPos[1] + (idx % 2 === 0 ? 1 : -1) * 1.2,
          folderPos[2] + Math.sin(subAngle) * 2.2,
        ];
        // Connect note to folder
        linkList.push({
          source: basePos,
          target: folderPos,
          color: '#818CF8',
        });
      } else {
        const angle = (idx / Math.max(notes.length, 1)) * Math.PI * 2;
        basePos = [Math.cos(angle) * 3.5, (idx % 3 - 1) * 1.5, Math.sin(angle) * 3.5];
      }

      posMap.set(note.id, basePos);
      nodeList.push({
        id: note.id,
        label: `${note.icon || '📝'} ${note.title}`,
        type: 'note',
        position: basePos,
        color: note.isPinned ? '#EC4899' : '#6366F1', // Pink for pinned, Indigo for normal
        size: note.isPinned ? 0.4 : 0.32,
      });
    });

    // 3. Connect Backlinks between notes
    notes.forEach((note) => {
      const sourcePos = posMap.get(note.id);
      if (!sourcePos) return;

      note.backlinks.forEach((targetId) => {
        const targetPos = posMap.get(targetId);
        if (targetPos) {
          linkList.push({
            source: sourcePos,
            target: targetPos,
            color: '#EC4899', // Pink glow for backlinks
          });
        }
      });
    });

    return { nodes: nodeList, links: linkList };
  }, [notes, folders, tags]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: '520px', borderRadius: '12px', overflow: 'hidden', background: '#090D16' }}>
      {/* HUD Overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'rgba(15, 22, 38, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          p: 1.5,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesome fontSize="small" sx={{ color: '#818CF8' }} />
          Knowledge Nexus Graph
        </Typography>
        <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5 }}>
          {notes.length} Notes • {folders.length} Folders • {links.length} Connections
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.8, mt: 1 }}>
          <Chip label="Note" size="small" sx={{ bgcolor: 'rgba(99, 102, 241, 0.25)', color: '#818CF8', height: 20, fontSize: '0.7rem' }} />
          <Chip label="Folder" size="small" sx={{ bgcolor: 'rgba(168, 85, 247, 0.25)', color: '#C084FC', height: 20, fontSize: '0.7rem' }} />
          <Chip label="Backlink" size="small" sx={{ bgcolor: 'rgba(236, 72, 153, 0.25)', color: '#F472B6', height: 20, fontSize: '0.7rem' }} />
        </Box>
      </Box>

      {/* Control Buttons */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          gap: 1,
          background: 'rgba(15, 22, 38, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          p: 0.5,
        }}
      >
        <Tooltip title={autoRotate ? 'Pause Rotation' : 'Auto Rotate'}>
          <Button
            size="small"
            variant={autoRotate ? 'contained' : 'outlined'}
            onClick={() => setAutoRotate(!autoRotate)}
            sx={{ fontSize: '0.75rem', py: 0.5 }}
          >
            {autoRotate ? 'Rotating' : 'Static'}
          </Button>
        </Tooltip>
      </Box>

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 5, 12], fov: 50 }}>
        <GraphScene
          nodes={nodes}
          links={links}
          onSelectNote={onSelectNote}
          autoRotate={autoRotate}
        />
      </Canvas>
    </Box>
  );
};

export default KnowledgeGraph;
