
import React from 'react';
import { TerminalCanvas } from '../TerminalCanvas';
import { MEMORY } from '../../constants/Memory';

interface PlatformViewProps {
    displayBuffer: ArrayBuffer | null;
    handleInspect: (x: number, y: number) => void;
}

export const PlatformView: React.FC<PlatformViewProps> = ({
    displayBuffer,
    handleInspect
}) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ border: "1px solid #333", position: "relative" }}>
                <TerminalCanvas
                    memoryBuffer={displayBuffer}
                    width={MEMORY.GRID_WIDTH}
                    height={MEMORY.GRID_HEIGHT}
                    onGridClick={handleInspect}
                />
            </div>

            <div style={{ marginTop: "10px", color: "#666", fontSize: "0.8em", fontFamily: "monospace" }}>
                PLATFORMER CONTROLS: Arrow Keys to Move/Jump. SPACE to Skill.
            </div>
        </div>
    );
};
