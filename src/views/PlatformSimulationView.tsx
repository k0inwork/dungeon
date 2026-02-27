import React, { useRef, useEffect } from "react";
import { PlatformView } from "../components/views/PlatformView";
import { usePlatformController } from "../hooks/usePlatformController";

interface PlatformSimulationViewProps {
    currentLevelIdx: number;
    keysDown: Set<string>;
    tickSimulation: () => void;
    setDisplayBuffer: (buf: ArrayBuffer | null) => void;
    onInspect: (x: number, y: number) => void;
}

export const PlatformSimulationView: React.FC<PlatformSimulationViewProps> = ({
    currentLevelIdx,
    keysDown,
    tickSimulation,
    setDisplayBuffer,
    onInspect
}) => {
    const lastTickTimeRef = useRef(0);
    const SIMULATION_TICK_RATE_MS = 100;

    const { runPlatformCycle } = usePlatformController(
        "PLATFORM",
        currentLevelIdx,
        keysDown,
        setDisplayBuffer,
        tickSimulation,
        lastTickTimeRef,
        SIMULATION_TICK_RATE_MS
    );

    useEffect(() => {
        let requestRef = 0;
        const animate = (time: number) => {
            runPlatformCycle(time);
            requestRef = requestAnimationFrame(animate);
        };
        requestRef = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef);
    }, [runPlatformCycle]);

    return (
        <PlatformView
            displayBuffer={null} // Buffer is handled by setDisplayBuffer in controller
            handleInspect={onInspect}
        />
    );
};
