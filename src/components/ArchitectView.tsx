import React, { useState, useEffect, useMemo } from 'react';
import { WorldData, TaxonomyDef, generatorService, TerrainDef, EntityDef } from '../services/GeneratorService';
import { MapGenerator } from '../services/MapGenerator';

interface ArchitectViewProps {
  data: WorldData;
}

const hex = (num: number) => '#' + num.toString(16).padStart(6, '0').toUpperCase();

export const ArchitectView: React.FC<ArchitectViewProps> = ({ data }) => {
  const [tab, setTab] = useState<'WORLD' | 'TAXONOMY' | 'ATLAS' | 'LEVEL' | 'DEBUG'>('LEVEL');
  const [logs, setLogs] = useState(generatorService.history);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Refresh logs when entering debug tab
  useEffect(() => {
    if (tab === 'DEBUG') {
      setLogs([...generatorService.history]);
    }
  }, [tab]);

  // Helper to render ASCII Map
  const renderAsciiMap = (layout: string[], entities: EntityDef[], legend: TerrainDef[]) => {
    // 1. Build a quick lookup for entity positions
    const entMap = new Map<string, EntityDef>();
    entities.forEach(e => entMap.set(`${e.x},${e.y}`, e));

    return (
      <div style={{ 
        fontFamily: '"Courier New", monospace', 
        fontSize: '12px', 
        lineHeight: '12px', 
        whiteSpace: 'pre', 
        background: '#000', 
        padding: '10px', 
        border: '1px solid #333',
        overflowX: 'auto'
      }}>
        {layout.map((row, y) => (
          <div key={y} style={{ height: '12px' }}>
            {row.split('').map((char, x) => {
              // Check Entity Layer
              const ent = entMap.get(`${x},${y}`);
              if (ent) {
                return (
                  <span key={x} style={{ color: hex(ent.glyph.color), fontWeight: 'bold' }}>
                    {ent.glyph.char}
                  </span>
                );
              }

              // Check Terrain Layer
              const terrain = legend.find(t => t.symbol === char);
              const color = terrain ? hex(terrain.color) : '#444';
              
              return (
                <span key={x} style={{ color: color }}>
                  {char}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Memoize Atlas Map Generation to avoid flickering
  const atlasPreview = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = data.atlas.find(n => n.id === selectedNodeId);
    if (!node) return null;

    // Use the active level's roster/legend as the "Sector Asset Pack"
    // In a real engine, we might generate unique ones per node.
    const mapGen = new MapGenerator(40, 20, node.id + data.theme.name);
    return mapGen.generate(
      data.active_level.entity_roster || [], 
      data.active_level.terrain_legend || []
    );
  }, [selectedNodeId, data]);

  const renderTaxonomyTable = (title: string, items: TaxonomyDef[]) => (
    <div style={{ marginBottom: '30px' }}>
      <h3 style={{ color: '#0ff', borderBottom: '1px solid #333', paddingBottom: '5px' }}>{title}</h3>
      <div style={{ display: 'grid', gap: '15px' }}>
        {items?.map((item, i) => (
          <div key={i} style={{ background: '#0a0a0a', border: '1px solid #333', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '5px', marginBottom: '5px' }}>
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1em' }}>{item.name}</span>
              <span style={{ color: '#888', fontStyle: 'italic' }}>{item.description}</span>
            </div>
            
            <div style={{ paddingLeft: '10px', borderLeft: '2px solid #f0f' }}>
              <div style={{ fontSize: '0.9em', color: '#f0f', fontWeight: 'bold' }}>
                ABILITY: {item.ability.name}
              </div>
              <div style={{ fontSize: '0.8em', color: '#ccc', marginBottom: '5px' }}>
                {item.ability.description}
              </div>
              <div style={{ background: '#111', padding: '5px', fontFamily: 'monospace', fontSize: '0.8em', color: '#8f8' }}>
                {`> ${item.ability.code}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Courier New", monospace',
      background: '#050505',
      color: '#0f0'
    }}>
      
      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', background: '#000' }}>
        {['LEVEL', 'ATLAS', 'TAXONOMY', 'WORLD', 'DEBUG'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            style={{
              flex: 1,
              padding: '10px',
              background: tab === t ? '#111' : '#000',
              color: tab === t ? '#fff' : '#666',
              border: 'none',
              borderRight: '1px solid #333',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9em'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        
        {/* WORLD TAB */}
        {tab === 'WORLD' && (
          <div>
            <h1 style={{ color: '#fff', fontSize: '2em', textTransform: 'uppercase' }}>{data.theme.name}</h1>
            <p style={{ lineHeight: '1.6', color: '#ccc', maxWidth: '800px', whiteSpace: 'pre-line', fontSize: '1.1em' }}>{data.theme.lore}</p>
            <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #333' }}>
               <h4 style={{margin:0, color: '#666'}}>PHYSICS CONSTANTS</h4>
               <ul style={{listStyle: 'none', padding:0, color: '#888'}}>
                 <li>GRAVITY: {data.active_level.platformer_config.gravity}</li>
                 <li>JUMP_IMPULSE: {data.active_level.platformer_config.jump_force}</li>
               </ul>
            </div>
          </div>
        )}

        {/* TAXONOMY TAB */}
        {tab === 'TAXONOMY' && (
          <div>
            {renderTaxonomyTable("KNOWN RACES (BIOLOGY)", data.taxonomy.races)}
            {renderTaxonomyTable("KNOWN CLASSES (DISCIPLINE)", data.taxonomy.classes)}
            {renderTaxonomyTable("KNOWN ORIGINS (ALLEGIANCE)", data.taxonomy.origins)}
          </div>
        )}

        {/* ATLAS TAB */}
        {tab === 'ATLAS' && (
          <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
            {/* List */}
            <div style={{ width: '300px', overflowY: 'auto', borderRight: '1px solid #333', paddingRight: '20px' }}>
              <h3 style={{ color: 'orange', borderBottom: '1px solid #333' }}>SECTOR NODES</h3>
              {data.atlas.map(node => (
                <div 
                  key={node.id} 
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{ 
                    border: selectedNodeId === node.id ? '1px solid #0f0' : '1px solid #333', 
                    padding: '15px', 
                    marginBottom: '10px',
                    background: node.id === 'loc_1' ? '#112211' : '#000',
                    cursor: 'pointer',
                    opacity: selectedNodeId && selectedNodeId !== node.id ? 0.5 : 1
                  }}
                >
                  <div style={{ fontSize: '1.2em', color: '#fff', marginBottom: '5px' }}>{node.name}</div>
                  <div style={{ color: '#888', fontSize: '0.8em' }}>ID: {node.id}</div>
                  <div style={{ color: '#f0f' }}>BIOME: {node.biome}</div>
                  <div style={{ marginTop: '5px', fontSize: '0.8em', color: '#666' }}>
                    LINKS: {node.connections.length}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Detail / Preview */}
            <div style={{ flex: 1, paddingLeft: '20px' }}>
              {selectedNodeId && atlasPreview ? (
                <div>
                   <h2 style={{ margin: 0, color: '#fff' }}>
                     {data.atlas.find(n => n.id === selectedNodeId)?.name}
                   </h2>
                   <div style={{ color: 'orange', marginBottom: '20px' }}>
                      BIOME: {data.atlas.find(n => n.id === selectedNodeId)?.biome} | 
                      DIFFICULTY: {data.atlas.find(n => n.id === selectedNodeId)?.difficulty}
                   </div>
                   
                   <h4 style={{ color: '#666' }}>PREVIEW SIMULATION (GENERATED FROM SEED)</h4>
                   {renderAsciiMap(atlasPreview.layout, atlasPreview.entities, data.active_level.terrain_legend)}
                   
                   <div style={{ marginTop: '20px', padding: '10px', background: '#111', fontSize: '0.8em', color: '#888' }}>
                     NOTE: This visualization is generated procedurally using the Sector Asset Pack.
                     Entities are populated based on difficulty and taxonomy rules.
                   </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#333' }}>
                  SELECT A NODE TO INSPECT
                </div>
              )}
            </div>
          </div>
        )}

        {/* LEVEL TAB */}
        {tab === 'LEVEL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             
             {/* MAP VISUALIZATION */}
             <div style={{ borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                <h3 style={{ color: '#0f0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>ACTIVE LEVEL GEOMETRY</span>
                  <span style={{ fontSize: '0.6em', color: '#666' }}>{data.active_level.name}</span>
                </h3>
                {renderAsciiMap(data.active_level.map_layout, data.active_level.entities, data.active_level.terrain_legend)}
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h3 style={{ borderBottom: '1px solid #333', color: '#0ff' }}>ACTIVE TERRAIN</h3>
                  <table style={{ width: '100%', fontSize: '0.8em', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{textAlign:'left', color: '#666'}}><th>SYM</th><th>NAME</th><th>PASS</th></tr>
                    </thead>
                    <tbody>
                      {data.active_level.terrain_legend.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ color: hex(t.color), fontWeight: 'bold', fontSize: '1.5em' }}>{t.symbol}</td>
                          <td>{t.name}</td>
                          <td style={{ color: t.passable ? '#0f0' : '#f00' }}>{t.passable ? 'YES' : 'NO'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ borderBottom: '1px solid #333', color: '#f0f' }}>ENTITY MANIFEST</h3>
                  {data.active_level.entities.map((ent, i) => (
                    <div key={i} style={{ marginBottom: '10px', background: '#111', padding: '10px', borderLeft: `3px solid ${hex(ent.glyph.color)}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>[{ent.glyph.char}] {ent.name}</span>
                        <span style={{ color: '#666' }}>POS: {ent.x},{ent.y}</span>
                      </div>
                      <div style={{ fontSize: '0.8em', color: '#aaa', marginTop: '5px' }}>
                        {ent.taxonomy.race} | {ent.taxonomy.class} | {ent.taxonomy.origin}
                      </div>
                      <div style={{ fontSize: '0.7em', marginTop: '5px', color: '#f0f', fontFamily: 'monospace' }}>
                        {ent.scripts.active.join(" ; ")}
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {/* DEBUG TAB */}
        {tab === 'DEBUG' && (
          <div>
            <h3 style={{ color: 'orange', borderBottom: '1px solid #333' }}>NEURO-SYMBOLIC PIPELINE</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {logs.map(log => (
                <div key={log.id} style={{ border: '1px solid #333', padding: '10px', background: '#080808' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.8em', marginBottom: '10px' }}>
                    <span style={{ color: '#0ff' }}>{log.phase}</span>
                    <span>{log.timestamp}</span>
                  </div>
                  
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ color: '#888', fontSize: '0.7em', marginBottom: '2px' }}>PROMPT</div>
                    <div style={{ background: '#000', padding: '5px', fontSize: '0.8em', color: '#aaa', whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'hidden' }}>
                      {log.prompt.substring(0, 300)}...
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#888', fontSize: '0.7em', marginBottom: '2px' }}>RESPONSE</div>
                    <div style={{ background: '#000', padding: '5px', fontSize: '0.8em', color: '#0f0', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                      {log.response}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
