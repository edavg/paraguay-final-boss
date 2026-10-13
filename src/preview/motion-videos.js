import './motion-videos.css';
import {combatReferences,previousCombat,locomotionHistory,runReferenceCandidates} from './combat-reference-clips.js';

function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;}
function link(label,href,download){
 const anchor=element('a','',label);anchor.href=href;
 if(download)anchor.download=download;else{anchor.target='_blank';anchor.rel='noopener';}
 return anchor;
}
function movie(clip,label,filename){
 const figure=element('figure','movie'),heading=element('figcaption','movie-heading',label);
 const video=document.createElement('video');video.controls=true;video.loop=true;video.muted=true;video.playsInline=true;video.preload='metadata';video.src=clip.src;
 if(clip.poster)video.poster=clip.poster;
 video.setAttribute('aria-label',label);
 video.addEventListener('play',()=>{for(const other of document.querySelectorAll('video'))if(other!==video)other.pause();});
 const links=element('div','movie-links');links.append(link('Abrir el vídeo ↗',clip.src),link('Descargar MP4',clip.src,filename));
 const note=element('p','movie-note',clip.note);
 const error=element('p','video-error','Este vídeo no pudo cargar. Prueba a abrir el archivo directamente.');error.hidden=true;video.addEventListener('error',()=>{error.hidden=false;});
 figure.append(heading,video,links,note,error);return figure;
}
for(const group of ['boss','player']){
 const section=document.getElementById(group+'-moves');
 for(const clip of combatReferences.filter(clip=>clip.group===group)){
  const article=element('article','move');article.id=clip.id;
  const header=element('header','move-heading');header.append(element('h3','',clip.name),element('span','availability',clip.result?'Origen + resultado del modelo':'Origen disponible · resultado del modelo pendiente'));
  const pair=element('div','comparison');
  pair.append(movie(clip.source,`${clip.name} · Referencia generada`,`${clip.id}-reference.mp4`));
  if(clip.result)pair.append(movie(clip.result,`${clip.name} · Resultado del modelo`,`${clip.id}-model.mp4`));
  else{
    const pending=element('div','pending');pending.append(element('span','eyebrow','Resultado del modelo'),element('p','','La nueva vista previa del modelo aún no está lista.'),element('small','','Este espacio mostrará la animación sobre nuestro personaje.'));
   pair.append(pending);
  }
  article.append(header,pair);
  if(clip.raw){const raw=element('div','raw-motion');raw.append(link('Descargar movimiento en bruto · GLB',clip.raw,`${clip.id}-raw-motion.glb`),element('small','','Captura original, antes de las correcciones de arma, empuñadura y suelo.'));article.append(raw);}
  section.append(article);
 }
}
function history(id,clips){
 const container=document.getElementById(id);
 for(const [index,clip] of clips.entries()){
  const card=element('article','history-card');card.append(element('span','eyebrow',clip.actor),movie(clip,clip.name,`${id}-${index+1}.mp4`));container.append(card);
 }
}
history('previous-combat',previousCombat);history('locomotion-history',locomotionHistory);history('run-reference-candidates',runReferenceCandidates);
document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const video of document.querySelectorAll('video'))video.pause();});
document.getElementById('history').addEventListener('toggle',event=>{if(!event.currentTarget.open)for(const video of event.currentTarget.querySelectorAll('video'))video.pause();});
