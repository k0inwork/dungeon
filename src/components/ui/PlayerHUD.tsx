
import React from 'react';

export const ITEM_NAMES: Record<number, string> = {
    36: "Gold Coin",
    40: "Iron Sword",
    105: "Iron Sword",
    91: "Small Potion",
    112: "Potion",
    97: "Apple",
    114: "Rat Corpse",
    82: "Giant Rat Corpse",
    2001: "Rat Tooth",
    2002: "Rat Tail",
    2003: "Rat Meat",
    93: "Healing Herb",
    33: "Power Up",
    63: "Mystery Box",
    95: "Whetstone",
    100: "Dragon Scale"
};

interface PlayerStats {
    hp: number;
    maxHp: number;
    invCount: number;
    inventory: number[];
}

interface PlayerHUDProps {
    playerStats: PlayerStats;
    groundItems: string[];
}

export const PlayerHUD: React.FC<PlayerHUDProps> = ({ playerStats, groundItems }) => {
    return (
        <div style={{
            width: '200px',
            background: 'rgba(0, 20, 0, 0.9)', border: '1px solid #0f0',
            padding: '10px', fontFamily: 'monospace', fontSize: '0.8em', zIndex: 20
        }}>
            <div style={{ borderBottom: '1px solid #333', marginBottom: '8px', color: '#fff' }}>PLAYER HUD</div>
            <div style={{ marginBottom: '4px' }}>HP: <span style={{ color: playerStats.hp < 30 ? 'red' : '#0f0' }}>{playerStats.hp}/{playerStats.maxHp}</span></div>
            <div style={{ marginBottom: '4px' }}>INV: <span style={{ color: 'cyan' }}>{playerStats.invCount}/32</span></div>

            <div style={{ borderBottom: '1px solid #333', marginTop: '15px', marginBottom: '8px', color: '#fff' }}>LOOT</div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {playerStats.invCount > 0 ? (() => {
                    const counts: Record<string, number> = {};
                    for (let i = 0; i < playerStats.invCount; i++) {
                        const id = playerStats.inventory[i];
                        const name = ITEM_NAMES[id] || `Item (${id})`;
                        counts[name] = (counts[name] || 0) + 1;
                    }
                    return Object.entries(counts).map(([name, num], i) => (
                        <div key={i} style={{ color: 'cyan', marginBottom: '2px' }}>
                            {name} {num > 1 ? `x${num}` : ''}
                        </div>
                    ));
                })() : <div style={{ color: '#444' }}>Empty</div>}
            </div>

            <div style={{ borderBottom: '1px solid #333', marginTop: '15px', marginBottom: '8px', color: '#fff' }}>ON GROUND</div>
            {groundItems.length > 0 ? groundItems.map((it, i) => (
                <div key={i} style={{ color: '#aaa' }}>{it}</div>
            )) : <div style={{ color: '#444' }}>Empty</div>}
        </div>
    );
};
