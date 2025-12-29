import React, { useState } from "react";
import {
  OrthographicCamera,
  OrbitControls,
  Stars,
  Text,
} from "@react-three/drei";
import { GridCell, getYearColor } from "../utils";

const BLOCK_SIZE = 0.8;
const HORIZONTAL_GAP = 0.4;
const VERTICAL_GAP = 0.05;
const TOTAL_HORIZONTAL_SIZE = BLOCK_SIZE + HORIZONTAL_GAP;
const TOTAL_VERTICAL_SIZE = BLOCK_SIZE + VERTICAL_GAP;

const Block = ({
  position,
  color,
  info,
  dimmed,
  onHover,
  onClick,
}: {
  position: [number, number, number];
  color: string;
  info: string;
  dimmed: boolean;
  onHover: (info: string | null) => void;
  onClick?: () => void;
}) => {
  const [hovered, setHover] = useState(false);

  return (
    <mesh
      position={position}
      castShadow
      receiveShadow
      onClick={(e) => {
        if (dimmed) return;
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        if (dimmed) return;
        e.stopPropagation();
        setHover(true);
        onHover(info);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        if (dimmed) return;
        setHover(false);
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
      <meshStandardMaterial
        color={color}
        emissive={hovered && !dimmed ? "white" : "black"}
        emissiveIntensity={hovered && !dimmed ? 0.5 : 0}
        transparent
        opacity={dimmed ? 0.1 : 1}
      />
    </mesh>
  );
};

const BaseGrid = ({
  cells,
  selectedWeek,
}: {
  cells: GridCell[];
  selectedWeek: number | null;
}) => {
  return (
    <group>
      {cells.map((cell, i) => (
        <mesh
          key={`base-${i}`}
          receiveShadow
          position={[
            cell.weekIndex * TOTAL_HORIZONTAL_SIZE,
            -BLOCK_SIZE,
            cell.dayIndex * TOTAL_HORIZONTAL_SIZE,
          ]}
        >
          <boxGeometry args={[BLOCK_SIZE, 0.1, BLOCK_SIZE]} />
          <meshStandardMaterial
            color="#334155"
            transparent
            opacity={
              selectedWeek !== null && selectedWeek !== cell.weekIndex ? 0.1 : 1
            }
          />
        </mesh>
      ))}
    </group>
  );
};

const WeekLabels = ({
  count,
  onSelect,
  selectedWeek,
}: {
  count: number;
  onSelect: (week: number) => void;
  selectedWeek: number | null;
}) => {
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          <Text
            position={[
              i * TOTAL_HORIZONTAL_SIZE,
              0,
              7 * TOTAL_HORIZONTAL_SIZE + 0.5,
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.5}
            color={selectedWeek === i ? "cyan" : "gray"}
            anchorX="center"
            anchorY="middle"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "auto")}
          >
            {i + 1}
          </Text>
          <Text
            position={[
              i * TOTAL_HORIZONTAL_SIZE,
              0,
              -1 * TOTAL_HORIZONTAL_SIZE - 0.5,
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.5}
            color={selectedWeek === i ? "cyan" : "gray"}
            anchorX="center"
            anchorY="middle"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "auto")}
          >
            {i + 1}
          </Text>
        </React.Fragment>
      ))}
    </group>
  );
};

export const MainScene = ({
  cells,
  years,
  setTooltip,
  selectedYear,
}: {
  cells: GridCell[];
  years: number[];
  setTooltip: (text: string | null) => void;
  selectedYear: number | null;
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const centerX = (52 * TOTAL_HORIZONTAL_SIZE) / 2;
  const centerZ = (7 * TOTAL_HORIZONTAL_SIZE) / 2;

  const handleWeekSelect = (weekIndex: number) => {
    setSelectedWeek((prev) => (prev === weekIndex ? null : weekIndex));
  };

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[40, 40, 40]}
        zoom={20}
        near={-200}
        far={2000}
        onUpdate={(c) => c.lookAt(centerX, 0, centerZ)}
      />
      <OrbitControls target={[centerX, 0, centerZ]} />

      <color attach="background" args={["#000000"]} />
      <Stars
        radius={50}
        depth={50}
        count={10000}
        factor={10}
        saturation={0}
        fade
        speed={1}
      />

      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 5]} intensity={1.2} castShadow />

      <BaseGrid cells={cells} selectedWeek={selectedWeek} />
      <WeekLabels
        count={53}
        onSelect={handleWeekSelect}
        selectedWeek={selectedWeek}
      />

      <group>
        {cells.map((cell) => {
          const isWeekDimmed =
            selectedWeek !== null && selectedWeek !== cell.weekIndex;

          let currentY = 0;
          return cell.stacks.map((stack) => {
            const isYearDimmed =
              selectedYear !== null && selectedYear !== stack.year;

            const isDimmed = isWeekDimmed || isYearDimmed;

            const blocks = [];
            for (let i = 0; i < stack.count; i++) {
              const y = currentY * TOTAL_VERTICAL_SIZE;
              blocks.push(
                <Block
                  key={`${cell.dateStr}-${stack.year}-${i}`}
                  position={[
                    cell.weekIndex * TOTAL_HORIZONTAL_SIZE,
                    y,
                    cell.dayIndex * TOTAL_HORIZONTAL_SIZE,
                  ]}
                  color={getYearColor(stack.yearIndex, years.length)}
                  info={`${stack.year}-${cell.dateStr}: ${stack.count} articles`}
                  dimmed={isDimmed}
                  onHover={setTooltip}
                  onClick={() => {
                    const pageName = cell.dateStr.replace("-", "");
                    window.location.assign(`/pages/${pageName}`);
                  }}
                />
              );
              currentY++;
            }
            return blocks;
          });
        })}
      </group>
    </>
  );
};
