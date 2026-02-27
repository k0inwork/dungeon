import React, { useState, useCallback, useEffect } from "react";
import { GridView } from "../components/views/GridView";
import { useGridController, PLAYER_SKILLS } from "../hooks/useGridController";
import { forthService } from "../services/WaForthService";

interface RogueSimulationViewProps {
    displayBuffer: ArrayBuffer | null;
    playerPos: { x: number, y: number };
    currentLevelIdx: number;
    currentLevelId: string;
    tickSimulation: () => void;
    addLog: (msg: string) => void;
    onInspect: (x: number, y: number) => void;
}

export const RogueSimulationView: React.FC<RogueSimulationViewProps> = ({
    displayBuffer,
    playerPos,
    currentLevelIdx,
    currentLevelId,
    tickSimulation,
    addLog,
    onInspect
}) => {
    const triggerPickup = useCallback(() => {
        const playerProc = forthService.get("PLAYER");
        if (playerProc && playerProc.isLogicLoaded) {
            playerProc.run(`0 OUT_PTR ! 305 2 1 ${playerPos.x} ${playerPos.y} 0 BUS_SEND`);
            tickSimulation();
        }
    }, [playerPos, tickSimulation]);

    const checkTarget = useCallback((x: number, y: number, skill: any): boolean => {
        const dist = Math.abs(x - playerPos.x) + Math.abs(y - playerPos.y);
        if (dist > skill.range) return false;
        if (skill.name === "HEAL") return x === playerPos.x && y === playerPos.y;
        return true;
    }, [playerPos]);

    const gridController = useGridController(
        "GRID", playerPos, tickSimulation, addLog, triggerPickup, checkTarget, currentLevelIdx
    );

    return (
        <GridView
            displayBuffer={displayBuffer}
            cursorPos={gridController.cursorPos}
            playerPos={playerPos}
            targetMode={gridController.targetMode}
            selectedSkill={gridController.selectedSkill}
            isValidTarget={gridController.isValidTarget}
            currentLevelId={currentLevelId}
            playerSkills={PLAYER_SKILLS}
            handleInspect={onInspect}
            triggerPickup={triggerPickup}
        />
    );
};
