import React from "react";
import { PlayerHUD } from "./PlayerHUD";
import { LogWindow } from "./LogWindow";
import { EntityInspector } from "./EntityInspector";
import { WorldData } from "../../services/GeneratorService";

interface SimulationShellProps {
    playerStats: any;
    groundItems: string[];
    log: string[];
    worldInfo: WorldData | null;
    logContainerRef: React.RefObject<HTMLDivElement>;
    inspectStats: any | null;
    onCloseInspector: () => void;
    children: React.ReactNode;
}

export const SimulationShell: React.FC<SimulationShellProps> = ({
    playerStats,
    groundItems,
    log,
    worldInfo,
    logContainerRef,
    inspectStats,
    onCloseInspector,
    children
}) => {
    return (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', justifyContent: 'center' }}>
            {/* LEFT: HUD */}
            <PlayerHUD playerStats={playerStats} groundItems={groundItems} />

            {/* CENTER: GAME + LOGS */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {children}
                </div>
                <LogWindow log={log} worldInfo={worldInfo} logContainerRef={logContainerRef} />
            </div>

            {/* RIGHT: INSPECTOR */}
            <div style={{ width: '300px' }}>
                {inspectStats ? (
                    <EntityInspector
                        inspectStats={inspectStats}
                        onClose={onCloseInspector}
                    />
                ) : (
                    <div style={{ border: '1px dashed #333', padding: '20px', color: '#333', textAlign: 'center' }}>
                        NO ENTITY SELECTED
                    </div>
                )}
            </div>
        </div>
    );
};
