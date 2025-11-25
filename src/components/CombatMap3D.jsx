import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { GameController } from "../game/GameController";
import { create3DMapScene } from "../scene/mapScene3D";

export function CombatMap3D({ fighters, grid, terrain, initialPositions }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const sceneRef = useRef(null);
  const [combatState, setCombatState] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return () => {};

    const controller = new GameController({
      onStateChange: setCombatState,
      onLog: (entry) => {
        console.log(entry.msg);
      },
    });
    controllerRef.current = controller;

    const scene = create3DMapScene(container, {
      onSelect: (info) => controller.handleSelect(info),
      onAction: (action, payload) => controller.handleAction(action, payload),
    });
    sceneRef.current = scene;

    controller.startEncounter({
      fighters,
      grid,
      positions: initialPositions,
      terrain,
    });

    return () => {
      if (sceneRef.current?.dispose) {
        sceneRef.current.dispose();
      }
      controllerRef.current = null;
      sceneRef.current = null;
    };
  }, [fighters, grid, terrain, initialPositions]);

  useEffect(() => {
    if (!combatState || !sceneRef.current?.updateFromState) return;
    sceneRef.current.updateFromState(combatState);
  }, [combatState]);

  return (
    <div
      ref={containerRef}
      className="combat-map-3d"
      style={{ position: "relative", width: "100%", height: "100%" }}
    />
  );
}

CombatMap3D.propTypes = {
  fighters: PropTypes.arrayOf(PropTypes.object),
  grid: PropTypes.object,
  terrain: PropTypes.object,
  initialPositions: PropTypes.object,
};

CombatMap3D.defaultProps = {
  fighters: [],
  grid: {},
  terrain: {},
  initialPositions: {},
};
