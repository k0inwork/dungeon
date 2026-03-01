
import React, { useState, useCallback, useEffect } from 'react';
import { forthService } from '../services/WaForthService';

export interface PlayerSkill {
    id: number;
    key: string;
    name: string;
    description: string;
    range: number;
}

export const PLAYER_SKILLS: PlayerSkill[] = [
    { id: 0, key: '1', name: "MELEE", description: "Basic Attack", range: 1 },
    { id: 1, key: '2', name: "SMASH", description: "Heavy Damage (x2)", range: 1 },
    { id: 2, key: '3', name: "HEAL", description: "Self Heal (+20)", range: 0 },
    { id: 3, key: '4', name: "FIREBALL", description: "Ranged 40 DMG", range: 5 },
];

import { KernelID, getInstanceID } from '../types/Protocol';

export const useGridController = (
    mode: string,
    playerPos: { x: number, y: number },
    tickSimulation: () => void,
    addLog: (msg: string) => void,
    triggerPickup: () => void,
    checkTarget: (x: number, y: number, skill: PlayerSkill) => boolean,
    currentLevelIdx: number
) => {
    const [targetMode, setTargetMode] = React.useState(false);
    const [cursorPos, setCursorPos] = React.useState({ x: 0, y: 0 });
    const [selectedSkill, setSelectedSkill] = React.useState<PlayerSkill | null>(null);
    const [isValidTarget, setIsValidTarget] = React.useState(true);

    const handleGridInput = React.useCallback((k: string) => {
        if (mode !== "GRID") return;

        let dx = 0;
        let dy = 0;

        if (k === "ArrowUp") dy = -1;
        if (k === "ArrowDown") dy = 1;
        if (k === "ArrowLeft") dx = -1;
        if (k === "ArrowRight") dx = 1;

        if (targetMode) {
            if (dx !== 0 || dy !== 0) {
                const nx = cursorPos.x + dx;
                const ny = cursorPos.y + dy;
                setCursorPos({ x: nx, y: ny });
                if (selectedSkill) {
                    setIsValidTarget(checkTarget(nx, ny, selectedSkill));
                }
            }
            if (k === "Enter" && selectedSkill) {
                if (isValidTarget) {
                    const playerProc = forthService.get("PLAYER");
                    const gridId = String(getInstanceID(KernelID.GRID, currentLevelIdx));
                    const gridProc = forthService.get(gridId);
                    const battleId = String(getInstanceID(KernelID.GRID_BATTLE, currentLevelIdx));

                    if (playerProc?.isLogicLoaded && gridProc?.isLogicLoaded) {
                        const tx = cursorPos.x;
                        const ty = cursorPos.y;

                        // Resolve Target ID from Grid Memory
                        const gridMem = new Uint8Array(gridProc.getMemory());
                        const entMapAddr = 0x31000;
                        const targetId = gridMem[entMapAddr + (ty * 40 + tx)];

                        // Send CMD_ATTACK (303) to Battle Kernel (Role 4)
                        // Packet: [OP, SENDER, TARGET_ROLE, P1=Src, P2=Tgt, P3=Skill]
                        const cmd = `0 OUT_PTR ! 303 2 4 0 ${targetId} ${selectedSkill.id} BUS_SEND`;
                        playerProc.run(cmd);
                        tickSimulation();
                    }
                    setTargetMode(false);
                    setSelectedSkill(null);
                }
            }
            if (k === "Escape") {
                setTargetMode(false);
                setSelectedSkill(null);
            }
            return;
        }

        // Skill Selection
        const skill = PLAYER_SKILLS.find(s => s.key === k);
        if (skill) {
            setSelectedSkill(skill);
            setCursorPos({ ...playerPos });
            setTargetMode(true);
            setIsValidTarget(skill.name === "HEAL");
            if (skill.name === "HEAL") {
                addLog(`[TARGETING] Select target for HEAL (Self). Press ENTER.`);
            } else {
                addLog(`[TARGETING] Select target for ${skill.name} (Range: ${skill.range})...`);
            }
            return;
        }

        // Standard Movement
        if (dx !== 0 || dy !== 0) {
            const playerProc = forthService.get("PLAYER");
            if (playerProc && playerProc.isLogicLoaded) {
                const cmd = `0 OUT_PTR ! 101 2 1 0 ${dx} ${dy} BUS_SEND`;
                console.log(`[GRID INPUT] Sending move request: ${dx}, ${dy}`);
                playerProc.run(cmd);
                tickSimulation();
            }
        }

        if (k === "g" || k === "G") {
            triggerPickup();
        }
    }, [mode, targetMode, cursorPos, selectedSkill, isValidTarget, playerPos, checkTarget, addLog, tickSimulation, triggerPickup]);

    React.useEffect(() => {
        const listener = (e: KeyboardEvent) => handleGridInput(e.key);
        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    }, [handleGridInput]);

    return {
        targetMode,
        cursorPos,
        selectedSkill,
        isValidTarget,
        setTargetMode,
        setCursorPos,
        setSelectedSkill
    };
};
