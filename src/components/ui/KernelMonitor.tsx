
import React from 'react';
import { forthService } from '../../services/WaForthService';
import { KernelID, getRoleID } from '../../types/Protocol';

interface KernelMonitorProps {
    loadedKernelIds: string[];
    currentLevelIdx: number;
    busHistory: any[];
    filterMovement: boolean;
    setFilterMovement: (val: boolean) => void;
    busCategory: string;
    setBusCategory: (cat: string) => void;
}

export const KernelMonitor: React.FC<KernelMonitorProps> = ({
    loadedKernelIds,
    currentLevelIdx,
    busHistory,
    filterMovement,
    setFilterMovement,
    busCategory,
    setBusCategory
}) => {
    return (
        <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '220px',
            background: '#000', borderLeft: '1px solid #0f0', display: 'flex', flexDirection: 'column',
            fontFamily: 'monospace', zIndex: 10
        }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8em', color: '#0f0' }}>KERNEL BUS MONITOR</span>
            </div>

            <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                    <select
                        value={busCategory}
                        onChange={(e) => setBusCategory(e.target.value)}
                        style={{ background: '#000', color: '#0f0', border: '1px solid #0f0', fontSize: '10px', width: '100%' }}
                    >
                        <option value="ALL">ALL EVENTS</option>
                        <option value="BUS">BUS ONLY</option>
                        <option value="KERNEL">KERNEL ONLY</option>
                        <option value="CHANNEL">CHANNELS</option>
                    </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.8em', color: '#0f0' }}>
                    <input
                        type="checkbox"
                        checked={filterMovement}
                        onChange={(e) => setFilterMovement(e.target.checked)}
                        style={{ marginRight: '10px' }}
                    />
                    HIDE MOVEMENT/PHYSICS
                </label>
            </div>

            <div style={{ padding: '10px', borderBottom: '1px solid #333', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)' }}>
                <div style={{ color: '#aaa', fontSize: '0.7em', marginBottom: '5px', letterSpacing: '1px' }}>ACTIVE KERNEL INSTANCES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {loadedKernelIds.map(id => {
                        const proc = forthService.get(id);
                        const roleId = id === "PLAYER" ? KernelID.PLAYER : getRoleID(parseInt(id));
                        const roleName = KernelID[roleId] || `UNK(${roleId})`;
                        const isCurrent = id === "PLAYER" || proc.levelIdx === currentLevelIdx;

                        const statusColor = proc.status === "ACTIVE" ? (isCurrent ? "#0f0" : "#0a0") :
                                          proc.status === "PAUSED" ? "#aa0" : "#555";

                        return (
                            <div key={id} style={{
                                fontSize: '10px',
                                color: statusColor,
                                display: 'flex',
                                justifyContent: 'space-between',
                                background: isCurrent ? 'rgba(0, 255, 0, 0.05)' : 'transparent',
                                padding: '2px 4px',
                                borderLeft: isCurrent ? '2px solid #0f0' : (proc.status === "FLASHED" ? '2px solid #333' : '2px solid transparent')
                            }}>
                                <span style={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
                                    {roleName} {proc.status === "FLASHED" && "[F]"}
                                </span>
                                <span style={{ opacity: 0.7 }}>ID:{id} | LVL:{proc.levelIdx}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', fontSize: '11px', fontFamily: 'monospace' }}>
                {busHistory.map((p, i) => (
                    <div key={i} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                        <div style={{ color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{p.timestamp}</span>
                            <span style={{ color: '#444' }}>OP:{p.opcode}</span>
                        </div>
                        <div>
                            <span style={{color: '#0af'}}>{p.sender}</span>
                            <span style={{color: '#666'}}> &gt; </span>
                            <span style={{color: '#f0f'}}>{p.target}</span>
                        </div>
                        <div style={{ color: '#0f0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
