
import { useEffect, useRef } from 'react';

export const useGameInput = () => {
    const keysDown = useRef<Set<string>>(new Set());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysDown.current.add(e.key);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysDown.current.delete(e.key);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    return keysDown;
};
