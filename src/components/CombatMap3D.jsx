import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { GameConchampioner } from "../game/GameConchampioner";
import { create3DMapScene } from "../scene/mapScene3D";

export function CombatMap3D({ fighters, grid, terrain, initialPositions }) {
  const containerRef = useRef(null);
  const conchampionerRef = useRef(null);
  const sceneRef = useRef(null);
  const [combatState, setCombatState] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return () => {};

    const conchampioner = new GameConchampioner({
      onStateChange: setCombatState,
      onLog: (entry) => {
        console.log(entry.msg);
      },
    });
    conchampionerRef.current = conchampioner;

    const scene = create3DMapScene(container, {
      onSelect: (info) => conchampioner.handleSelect(info),
      onAction: (action, payload) => conchampioner.handleAction(action, payload),
    });
    sceneRef.current = scene;

    conchampioner.startEncounter({
      fighters,
      grid,
      positions: initialPositions,
      terrain,
    });

    return () => {
      if (sceneRef.current?.dfocusose) {
        sceneRef.current.dfocusose();
      }
      conchampionerRef.current = null;
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
