
import React from 'react';
import { TerminalCanvas } from '../TerminalCanvas';
import { MEMORY } from '../../constants/Memory';

interface PlayerSkill {
    id: number;
    key: string;
    name: string;
    range: number;
}

interface GridViewProps {
    displayBuffer: ArrayBuffer | null;
    cursorPos: { x: number, y: number };
    playerPos: { x: number, y: number };
    targetMode: boolean;
    selectedSkill: PlayerSkill | null;
    isValidTarget: boolean;
    currentLevelId: string;
    playerSkills: PlayerSkill[];
    handleInspect: (x: number, y: number) => void;
    triggerPickup: () => void;
}

export const GridView: React.FC<GridViewProps> = ({
    displayBuffer,
    cursorPos,
    playerPos,
    targetMode,
    selectedSkill,
    isValidTarget,
    currentLevelId,
    playerSkills,
    handleInspect,
    triggerPickup
}) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ border: "1px solid #333", position: "relative" }}>
                <TerminalCanvas
                    memoryBuffer={displayBuffer}
                    width={MEMORY.GRID_WIDTH}
                    height={MEMORY.GRID_HEIGHT}
                    onGridClick={handleInspect}
                    cursor={(targetMode && !(selectedSkill?.name === "HEAL" && cursorPos.x === playerPos.x && cursorPos.y === playerPos.y)) ? cursorPos : null}
                />

                {/* Overlay for Invalid Target */}
                {targetMode && !isValidTarget && (
                    <div style={{
                        position: 'absolute', left: 0, right: 0, textAlign: 'center',
                        color: 'red', fontWeight: 'bold', background: 'rgba(0,0,0,0.5)', pointerEvents: 'none',
                        top: '50%'
                    }}>
                        {Math.abs(cursorPos.x - playerPos.x) + Math.abs(cursorPos.y - playerPos.y) > (selectedSkill?.range || 0)
                            ? "OUT OF RANGE"
                            : "INVALID TARGET"}
                    </div>
                )}
            </div>

            {/* ACTION BAR */}
            {currentLevelId !== "hub" && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    {playerSkills.map(skill => (
                        <div key={skill.id} style={{
                            border: selectedSkill?.id === skill.id ? '2px solid #fff' : '1px solid #333',
                            background: selectedSkill?.id === skill.id ? '#333' : '#000',
                            padding: '5px 10px',
                            fontSize: '0.8em',
                            color: targetMode && selectedSkill?.id === skill.id ? (isValidTarget ? 'orange' : 'red') : '#aaa'
                        }}>
                            <span style={{color: '#0f0', fontWeight: 'bold'}}>[{skill.key}]</span> {skill.name}
                            <span style={{fontSize: '0.7em', color: '#666', marginLeft: '5px'}}>R:{skill.range}</span>
                        </div>
                    ))}

                    <button
                        onClick={triggerPickup}
                        style={{
                            background: '#002200', border: '1px solid #0f0', color: '#0f0',
                            padding: '5px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.8em'
                        }}
                    >
                        [G] PICKUP
                    </button>
                </div>
            )}
        </div>
    );
};
