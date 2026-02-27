
import React, { useRef, useCallback } from 'react';
import { forthService } from '../services/WaForthService';
import { PLAYER_KERNEL_BLOCKS } from '../kernels/PlayerKernel';

export const useKernelManager = (addLog: (msg: string) => void) => {
    const loadingKernels = React.useRef<Map<string, Promise<any>>>(new Map());

    const loadKernel = React.useCallback(async (id: string, blocks: string[], lIdx: number = 0) => {
        if (loadingKernels.current.has(id)) {
            return await loadingKernels.current.get(id);
        }

        const promise = (async () => {
        try {
            console.log(`[HOST] Loading Kernel ${id} for Level ${lIdx}...`);
            await forthService.bootProcess(id);
            const proc = forthService.get(id);
            proc.levelIdx = lIdx;
            proc.logicBlocks = blocks;
            proc.status = "ACTIVE";
            addLog(`${id} Kernel Initialized.`);

            for (let i = 0; i < blocks.length; i++) {
                try {
                    proc.run(blocks[i]);
                } catch (e) {
                    console.error(`Error in ${id} Block ${i}:`, e);
                    addLog(`ERR: ${id} Block ${i} Failed`);
                    throw e;
                }
            }

            const instId = id === "PLAYER" ? 2 : parseInt(id);
            if (proc.isWordDefined("MY_ID")) {
                proc.run(`${instId} MY_ID !`);
            }

            proc.isLogicLoaded = true;
            addLog(`${id} Logic Loaded. READY.`);
            return proc;
        } catch (e) {
            console.error(`Failed to load ${id}`, e);
            addLog(`CRITICAL: ${id} Load Aborted.`);
            return null;
        } finally {
            loadingKernels.current.delete(id);
        }
        })();

        loadingKernels.current.set(id, promise);
        return await promise;
    }, [addLog]);

    const ensureKernel = React.useCallback(async (id: string, blocks: string[], lIdx: number) => {
        const proc = forthService.get(id);
        const blocksChanged = proc.logicBlocks.length > 0 && proc.logicBlocks !== blocks && JSON.stringify(proc.logicBlocks) !== JSON.stringify(blocks);

        if (proc.status === "FLASHED") {
            if (blocksChanged) {
                proc.logicBlocks = blocks;
                await proc.awaken();
                return proc;
            }
            await proc.awaken();
            return proc;
        }

        if (proc.isLogicLoaded) {
            if (blocksChanged) {
                await forthService.bootProcess(id);
                proc.logicBlocks = blocks;
                for (let i = 0; i < blocks.length; i++) {
                    proc.run(blocks[i]);
                }
                proc.isLogicLoaded = true;
            }

            const instId = id === "PLAYER" ? 2 : parseInt(id);
            if (proc.isWordDefined("MY_ID")) {
                proc.run(`${instId} MY_ID !`);
            }

            proc.status = "ACTIVE";
            return proc;
        }

        return await loadKernel(id, blocks, lIdx);
    }, [loadKernel]);

    return React.useMemo(() => ({ ensureKernel, loadKernel }), [ensureKernel, loadKernel]);
};
