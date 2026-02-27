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
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <PlayerHUD playerStats={playerStats} groundItems={groundItems} />

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                {children}
            </div>

            <LogWindow log={log} worldInfo={worldInfo} logContainerRef={logContainerRef} />

            {inspectStats && (
                <EntityInspector
                    inspectStats={inspectStats}
                    onClose={onCloseInspector}
                />
            )}
        </div>
    );
};
