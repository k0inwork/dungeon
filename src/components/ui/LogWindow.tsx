
import React, { RefObject } from 'react';

interface LogWindowProps {
    log: string[];
    worldInfo: any;
    logContainerRef: RefObject<HTMLDivElement | null>;
}

export const LogWindow: React.FC<LogWindowProps> = ({ log, worldInfo, logContainerRef }) => {
    return (
        <div
            ref={logContainerRef}
            style={{
                marginTop: "10px",
                width: "600px",
                border: "1px solid #333",
                padding: "10px",
                height: "120px",
                overflowY: "auto",
                background: "#000",
                fontSize: "0.9em",
                display: "flex",
                flexDirection: "column-reverse"
            }}
        >
           <div style={{ display: 'contents' }}>
               {log.map((l, i) => {
                   let color = "#0f0";
                   if (l.includes("ERR") || l.includes("CRITICAL")) color = "#f00";
                   if (l.includes("WARN")) color = "orange";
                   return <div key={i} style={{ color }}>{`${l}`}</div>
               })}
               <div style={{color: '#aaa', fontSize: '0.8em', marginBottom: '5px'}}>TIP: Use [1-4] to Select Skill. Arrow Keys to Target. ENTER to Fire. 'G' to Get Loot.</div>
               {worldInfo && <div style={{borderBottom: "1px solid #333", marginBottom: "5px", color: "white"}}>LORE: {worldInfo.theme.name}</div>}
           </div>
        </div>
    );
};
