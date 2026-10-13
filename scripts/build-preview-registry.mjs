import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const jobs = JSON.parse(readFileSync('docs/model-preview-jobs.json', 'utf8'));
const selection = JSON.parse(readFileSync('docs/approved-selection.json', 'utf8'));
const info = {
  'player-body': ['Exiliado de Espinas', 'JUGADOR / CUERPO', 'Armadura oscura esculpida, hombrera creciente de marfil y una silueta estrecha y enmascarada.', 'Manos vacías. Escudo, espada, penacho y tela suelta son adosados aparte. El interruptor de tela muestra una disposición estática hecha por código.'],
  'player-shield': ['Escudo catedralicio', 'JUGADOR / ESCUDO', 'Un escudo puntiagudo separado, con filigrana de plata y cara oscura incrustada.', 'Generado por su cuenta. El cuerpo del jugador no lleva ningún escudo integrado.'],
  'player-sword': ['Flamberge de espinas', 'JUGADOR / ESPADA', 'Un arma independiente con una hoja esbelta y ondulada.', 'Geometría aparte para la empuñadura del arma, el movimiento de combate y la detección de golpes.'],
  'boss-body': ['Santa del Relicario', 'JEFE / CUERPO', 'Una máscara funeraria, extremidades ramificadas y una reliquia dorada expuesta en el pecho.', 'Revisión estática del modelo. La estructura inusual de extremidades necesita su propio plan de articulación antes de animar.'],
  'boss-blade': ['Hoja de relicario', 'JEFE / ARMA', 'Una larga hoja de hueso de ejecución con una empuñadura elaborada en gancho.', 'Aparte del cuerpo del jefe, para que sus ataques muevan el arma de forma independiente.']
};
const url = path => path ? `new URL(${JSON.stringify('../../' + path)}, import.meta.url).href` : 'null';
const entries = jobs.map(job => {
  const [title, part, description, note] = info[job.key];
  const concept = job.key.startsWith('player') ? selection.player.conceptImage : selection.boss.conceptImage;
  return `{...${JSON.stringify({ key: job.key, title, part, description, note, frontYaw: job.frontYaw ?? 0 })}, modelUrl: ${url(job.localPath)}, inputUrl: ${url(job.inputPath)}, conceptUrl: ${url(concept)}}`;
});
const rigFolder='assets/rigs/reliquary-saint/';
if (existsSync(rigFolder+'reliquary-saint-armed-rig.glb')) {
  const rig={key:'boss-rig',title:'Santa del Relicario · Rig',part:'JEFE / RIG PERSONALIZADO',frontYaw:0,
    description:'Ocho brazos independientes, garras articuladas, dos piernas y toma de armas separados.',
    note:'Esqueleto personalizado en Blender. Usa las comprobaciones de pose estática y la superposición del esqueleto para inspeccionar la deformación. El archivo Blender incluye controles de contacto de manos y pies. La animación de combate es una fase posterior.',isRig:true};
  entries.splice(4,0,`{...${JSON.stringify(rig)},modelUrl:${url(rigFolder+'reliquary-saint-armed-rig.glb')},downloadUrl:${url(rigFolder+'reliquary-saint-rig.glb')},blendUrl:${url(rigFolder+'reliquary-saint-rig.blend')},poseUrl:${url(rigFolder+'diagnostic-poses.json')},inputUrl:${url('assets/prepare-a-precise-3d-modeling-input-from-cmu12gd4.png')},conceptUrl:${url(selection.boss.conceptImage)}}`);
}
mkdirSync('src/preview', { recursive: true });
writeFileSync('src/preview/assets.generated.js', `// Generated from docs/model-preview-jobs.json. All URLs are bundled local files.\nexport const assets = [\n${entries.join(',\n')}\n];\n`);
