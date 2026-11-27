(function(){
 const $q=document.getElementById('q'),$sug=document.getElementById('sugerencias'),$res=document.getElementById('resultado'),$mapaCont=document.getElementById('mapaCont'),$mapa=document.getElementById('mapa'),$tiles=document.getElementById('teselas'),$svg=document.getElementById('overlay'),$popup=document.getElementById('popupMapa'),$leyenda=document.getElementById('leyenda'),$panel=document.getElementById('capasPanel'),$fondo=document.getElementById('mapaFondo'),$estado=document.getElementById('mapaEstado');
 const $tabMunicipio=document.getElementById('tabMunicipio'),$tabEspacio=document.getElementById('tabEspacio'),$busquedaMunicipio=document.getElementById('busquedaMunicipio'),$busquedaEspacio=document.getElementById('busquedaEspacio'),$qEspacio=document.getElementById('qEspacio'),$sugEspacio=document.getElementById('sugerenciasEspacio');

 if(typeof DATOS==='undefined'){
   $res.innerHTML='<div class="vacio">No se han encontrado los datos (RENPA_datos.js). Colócalo en la misma carpeta que este archivo.</div>';
   return;
 }

 const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 // Clasificación operativa: SOLO porcentaje del municipio ocupado.
 // La clasificación de origen se conserva para consulta y trazabilidad.
 const clasificarPorMunicipio = e => {
   const pct = Number(e.pct_municipio);
   if (!Number.isFinite(pct)) return e.clasificacion || e.clasif || 'REVISAR';
   if (pct <= 0.01) return 'RUIDO';
   if (pct <= 0.10) return 'REVISAR';
   return 'CLARO';
 };
 Object.values(DATOS).forEach(m => (m.espacios || []).forEach(e => {
   e.clasificacion_original = e.clasificacion;
   e.clasificacion = clasificarPorMunicipio(e);
 }));
 if (typeof GEO !== 'undefined') Object.values(GEO).forEach(g => (g.esp || []).forEach(e => {
   e.clasif_original = e.clasif;
   e.clasif = clasificarPorMunicipio(e);
 }));

 const catalogoEspacios=new Map();

 if(typeof GEO!=='undefined')Object.entries(GEO).forEach(([cod,g])=>(g.esp||[]).forEach(e=>{
   const key=norm(e.figura)+'||'+norm(e.espacio)+'||'+norm(e.tipo||'');
   if(!catalogoEspacios.has(key))catalogoEspacios.set(key,{key,figura:e.figura,espacio:e.espacio,tipo:e.tipo||'',registros:[]});
   catalogoEspacios.get(key).registros.push({cod,e});
 }));

 Object.keys(window.RENPA_ESPACIOS_COMPLETOS||{}).forEach(key=>{if(!catalogoEspacios.has(key)){const [figura,espacio,tipo]=key.split('||');catalogoEspacios.set(key,{key,figura,espacio,tipo,registros:[]});}});
 const listaEspacios=[...catalogoEspacios.values()].sort((a,b)=>a.espacio.localeCompare(b.espacio,'es')||a.figura.localeCompare(b.figura,'es'));
 const lista=Object.entries(DATOS).map(([cod,m])=>({cod,nombre:m.nombre,provincia:m.provincia,n:norm(m.nombre),ruido:m.espacios.some(e=>e.clasificacion==='RUIDO')})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
 const COLORES={'Espacios Naturales Protegidos':'#2f6b3a','Red Natura 2000':'#1f6fb2','Reserva de la Biosfera':'#d98a00','ZEPIM':'#8e3fb0'},colorDe=f=>COLORES[f]||'#555555';

 let encuadre=null, punto=null, consultaId=0;
 let actual=null,idxActivo=-1,visibles=[],entradas=[],capaMun=null,zoom=7,centro={x:0,y:0},arrastre=null,ancho=0,alto=0,fondo='satellite';
 let modo='municipio',idxEspacio=-1,visiblesEspacio=[],espacioActual=null,limitesExtra=[],municipiosEspacio=[];
 // Lectura de los registros publicados. La edición no existe en la versión pública.
 const incidencias=Array.isArray(window.INCIDENCIAS_RENPA)?window.INCIDENCIAS_RENPA:[];
 const confirmaciones=Array.isArray(window.SOLAPES_CONFIRMADOS_RENPA)?window.SOLAPES_CONFIRMADOS_RENPA:[];
 function claveRelacion(cod,e){return [cod,norm(e.figura),norm(e.espacio),norm(e.tipo||'')].join('||')}
 function ultimaAccion(clave,registro=incidencias){for(let i=registro.length-1;i>=0;i--){if(registro[i].clave===clave)return registro[i].accion}return 'ACTIVA'}
 function ultimaAccionConfirmacion(clave){for(let i=confirmaciones.length-1;i>=0;i--){if(confirmaciones[i].clave===clave)return confirmaciones[i].accion}return 'SIN_CONFIRMAR'}
 function estaExcluida(cod,e){return ultimaAccion(claveRelacion(cod,e))==='EXCLUIR'}
 function estaConfirmado(cod,e){return ultimaAccionConfirmacion(claveRelacion(cod,e))==='CONFIRMAR'}
 function visiblePublico(cod,e){return !estaExcluida(cod,e)&&(estaConfirmado(cod,e)||(e.clasificacion||e.clasif)==='CLARO')}
 function esRuido(cod,e){return (e.clasificacion==='RUIDO'||e.clasif==='RUIDO')&&!estaConfirmado(cod,e)}

 const el=(tag,cls,txt)=>{
   const e=document.createElement(tag);
   if(cls)e.className=cls;
   if(txt!==undefined)e.textContent=txt;
   return e;
 };
 const fmt=(n,d=2)=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});

 function cambiarModo(nuevo){
   document.getElementById('inicio').hidden=true;document.getElementById('visor').hidden=false;document.getElementById('homeBack').hidden=false;

   modo=nuevo; punto=null; consultaId++; document.getElementById('busquedaPunto').hidden=nuevo!=='punto'; document.getElementById('tabPunto').classList.toggle('activo',nuevo==='punto');
   actual=null;
   espacioActual=null;
   entradas=[];
   capaMun=null;
   limitesExtra=[];
   municipiosEspacio=[];
   $res.innerHTML='';
   $mapaCont.style.display='block';
   $popup.style.display='none';
   const esMun=nuevo==='municipio';
   $busquedaMunicipio.style.display=esMun?'block':'none';
   $busquedaEspacio.style.display=nuevo==='espacio'?'block':'none';
   $tabMunicipio.classList.toggle('activo',esMun);
   $tabEspacio.classList.toggle('activo',nuevo==='espacio');

 vistaInicial();
 }

 function sugerirEspacios(){
   const t=norm($qEspacio.value);
   $sugEspacio.innerHTML='';
   idxEspacio=-1;
   if(!t){$sugEspacio.style.display='none';visiblesEspacio=[];return}
   visiblesEspacio=listaEspacios.filter(x=>norm(x.espacio).includes(t)||norm(x.figura).includes(t)).sort((a,b)=>(norm(a.espacio).startsWith(t)?0:1)-(norm(b.espacio).startsWith(t)?0:1)||a.espacio.localeCompare(b.espacio,'es')).slice(0,20);
   visiblesEspacio.forEach(x=>{
     const li=el('li');
     li.appendChild(el('span',null,x.espacio));
     li.appendChild(el('small',null,x.figura+(x.tipo?' · '+x.tipo:'')));
     li.addEventListener('mousedown',ev=>{ev.preventDefault();elegirEspacio(x)});
     $sugEspacio.appendChild(li);
   });
   $sugEspacio.style.display=visiblesEspacio.length?'block':'none';
 }

 function elegirEspacio(x){
   espacioActual=x;
   $qEspacio.value=x.espacio+' · '+x.figura+(x.tipo?' · '+x.tipo:'');
   $sugEspacio.style.display='none';
   mostrarEspacio();
 }

 function mostrarEspacio(){
   if(!espacioActual)return;
   $res.innerHTML='';
   const registros=espacioActual.registros.filter(r=>r.e.geom);
   const codigos=[...new Set(registros.map(r=>r.cod))];
   const muniValidos=new Map();

   codigos.forEach(cod=>{
     const m=DATOS[cod];
     if(!m)return;
     const relaciones=registros.filter(r=>r.cod===cod).map(r=>r.e).filter(e=>visiblePublico(cod,e));
     if(relaciones.length)muniValidos.set(cod,{cod,nombre:m.nombre,provincia:m.provincia,relaciones});
   });

   municipiosEspacio=[...muniValidos.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));

   // En busqueda inversa se representa el POLIGONO COMPLETO del espacio, incluso fuera de municipios y en el mar.
   // Los filtros y exclusiones solo afectan al listado de municipios, nunca recortan el limite protegido.
   const geometriaCompleta=(window.RENPA_ESPACIOS_COMPLETOS||{})[espacioActual.key];
   entradas=geometriaCompleta?[{e:{geom:geometriaCompleta,espacio:espacioActual.espacio,figura:espacioActual.figura,tipo:espacioActual.tipo},activa:true,ruido:false,color:colorDe(espacioActual.figura),key:'espacio-completo'}]:registros.map((r,i)=>({e:r.e,activa:true,ruido:false,color:colorDe(espacioActual.figura),key:'espacio||'+r.cod+'||'+i,cod:r.cod,municipio:DATOS[r.cod]?.nombre||r.cod}));
   limitesExtra=municipiosEspacio.map(m=>({cod:m.cod,geom:GEO[m.cod]?.mun,nombre:m.nombre})).filter(x=>x.geom);
   capaMun=null;

   const cab=el('div','municipio');
   cab.appendChild(el('h2',null,espacioActual.espacio));
   cab.appendChild(el('span',null,espacioActual.figura+(espacioActual.tipo?' · '+espacioActual.tipo:'')));
   $res.appendChild(cab);
   $res.appendChild(el('p','resumen',municipiosEspacio.length+' municipios con relación registrada en los datos cartográficos.'));

   if(!municipiosEspacio.length)$res.appendChild(el('div','aviso','No hay municipios con relaciones activas para este espacio.'));

   const titulo=el('h3',null,'Municipios incluidos');
   titulo.style.margin='18px 0 8px';
   $res.appendChild(titulo);

   const listaM=el('div','municipiosEspacio');
   municipiosEspacio.forEach(m=>{
     const card=el('div','municipioEspacio');
     const btn=el('button',null,m.nombre);
     btn.type='button';
     btn.addEventListener('click',()=>{
       cambiarModo('municipio');
       elegir({cod:m.cod,nombre:m.nombre,provincia:m.provincia,n:norm(m.nombre)});
     });
     card.appendChild(btn);
     card.appendChild(el('small',null,m.provincia||''));
     listaM.appendChild(card);
   });
   $res.appendChild(listaM);

   $mapaCont.style.display='block';
   $panel.innerHTML='';
   const pg=el('div','pgrupo');
   pg.appendChild(el('strong',null,'Capas visibles'));
   pg.appendChild(el('div','pitem','■ '+espacioActual.espacio));
   pg.appendChild(el('div','detalle',municipiosEspacio.length+' límites municipales resaltados'));
   $panel.appendChild(pg);

   $leyenda.innerHTML='';
   const it=el('span'),sw=el('i');
   sw.style.background=colorDe(espacioActual.figura);
   it.appendChild(sw);
   it.appendChild(document.createTextNode(espacioActual.espacio));
   $leyenda.appendChild(it);

   const it2=el('span'),sw2=el('i');
   sw2.style.background='transparent';
   sw2.style.border='2px solid #111';
   it2.appendChild(sw2);
   it2.appendChild(document.createTextNode('Límites municipales'));
   $leyenda.appendChild(it2);

   requestAnimationFrame(()=>{
     ancho=$mapa.clientWidth;
     alto=$mapa.clientHeight;
     const fc={type:'FeatureCollection',features:entradas.map(en=>({type:'Feature',geometry:en.e.geom,properties:{}}))};
     ajustarBounds(fc,19,.08);
     dibujarGeometrias();
   });
 }

 const escala=()=>256*Math.pow(2,zoom);

 function merc(lon,lat,z=zoom){
   const s=256*Math.pow(2,z),la=Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180;
   return{x:(lon+180)/360*s,y:(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*s};
 }

 function inv(p,z=zoom){
   const s=256*Math.pow(2,z),lon=p.x/s*360-180,n=Math.PI-2*Math.PI*p.y/s,lat=180/Math.PI*Math.atan(Math.sinh(n));
   return[lon,lat];
 }

 function screen(lon,lat){
   const p=merc(lon,lat);
   return[p.x-centro.x+ancho/2,p.y-centro.y+alto/2];
 }

 function geoBounds(g,b){
   if(!g)return;
   if(g.type==='Feature'){geoBounds(g.geometry,b);return}
   if(g.type==='FeatureCollection'){(g.features||[]).forEach(f=>geoBounds(f,b));return}
   const addRing=r=>r.forEach(p=>{
     b.minX=Math.min(b.minX,p[0]);
     b.maxX=Math.max(b.maxX,p[0]);
     b.minY=Math.min(b.minY,p[1]);
     b.maxY=Math.max(b.maxY,p[1]);
   });
   if(g.type==='Polygon')g.coordinates.forEach(addRing);
   else if(g.type==='MultiPolygon')g.coordinates.forEach(p=>p.forEach(addRing));
   else if(g.type==='GeometryCollection')g.geometries.forEach(x=>geoBounds(x,b));
 }

 function geometriaPath(g){
   if(!g)return'';
   if(g.type==='Feature')return geometriaPath(g.geometry);
   if(g.type==='FeatureCollection')return(g.features||[]).map(geometriaPath).join(' ');
   const ringPath=r=>r.map((p,i)=>{
     const s=screen(p[0],p[1]);
     return(i?'L':'M')+s[0].toFixed(1)+','+s[1].toFixed(1);
   }).join(' ')+' Z';
   if(g.type==='Polygon')return g.coordinates.map(ringPath).join(' ');
   if(g.type==='MultiPolygon')return g.coordinates.map(p=>p.map(ringPath).join(' ')).join(' ');
   if(g.type==='GeometryCollection')return g.geometries.map(geometriaPath).join(' ');
   return'';
 }

 function tileUrl(z,x,y){
   const n=Math.pow(2,z);
   if(y<0||y>=n)return'';
   x=((x%n)+n)%n;
   if(fondo==='satellite')return`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
   if(fondo==='normal')return`https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
   return'';
 }

 function renderTiles(){
   ancho=$mapa.clientWidth;
   alto=$mapa.clientHeight;
   if(!ancho||!alto)return;
   $tiles.innerHTML='';
   if(fondo!=='none'){
     const z=Math.floor(zoom),size=256*Math.pow(2,zoom-z),n=Math.pow(2,z),left=centro.x-ancho/2,top=centro.y-alto/2,x0=Math.floor(left/size),x1=Math.floor((left+ancho)/size),y0=Math.floor(top/size),y1=Math.floor((top+alto)/size);
     for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
       if(y<0||y>=n)continue;
       const im=document.createElement('img');
       im.alt='';
       im.draggable=false;
       im.src=tileUrl(z,x,y);
       im.style.width=im.style.height=size+'px';
       im.style.left=(x*size-left)+'px';
       im.style.top=(y*size-top)+'px';
       im.onerror=()=>{im.style.display='none'};
       $tiles.appendChild(im);
     }
   }
   $estado.textContent=(fondo==='satellite'?'Satélite: Esri':fondo==='normal'?'Mapa normal: OpenStreetMap':'Sin mapa base');
   $svg.setAttribute('viewBox',`0 0 ${ancho} ${alto}`);
 }

 function popupAt(x,y,content){
   $popup.innerHTML='';
   $popup.appendChild(content);
   $popup.style.left=Math.max(125,Math.min(ancho-125,x))+'px';
   $popup.style.top=Math.max(12,y)+'px';
   $popup.style.display='block';
 }

 function cerrarPopup(){$popup.style.display='none'}

 function lineasPopup(e,cont){
   const t=el('div');
   t.style.marginBottom='6px';
   t.appendChild(el('strong',null,e.espacio));
   t.appendChild(el('br'));
   t.appendChild(document.createTextNode(e.figura+(e.tipo?' ('+e.tipo+')':'')));
   t.appendChild(el('br'));
   t.appendChild(document.createTextNode(fmt(e.pct_municipio)+' % del municipio · '+fmt(e.solape_ha)+' ha'));
   cont.appendChild(t);
 }

 function dentroAnillo(pt,ring){
   let d=false;
   for(let i=0,j=ring.length-1;i<ring.length;j=i++){
     const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
     if((yi>pt[1])!==(yj>pt[1])&&pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi)d=!d;
   }
   return d;
 }

 function dentroPoligono(pt,poly){
   if(!dentroAnillo(pt,poly[0]))return false;
   for(let k=1;k<poly.length;k++)if(dentroAnillo(pt,poly[k]))return false;
   return true;
 }

 function contiene(g,pt){
   if(!g)return false;
   if(g.type==='Feature')return contiene(g.geometry,pt);
   if(g.type==='FeatureCollection')return(g.features||[]).some(f=>contiene(f,pt));
   if(g.type==='Polygon')return dentroPoligono(pt,g.coordinates);
   if(g.type==='MultiPolygon')return g.coordinates.some(p=>dentroPoligono(pt,p));
   if(g.type==='GeometryCollection')return g.geometries.some(x=>contiene(x,pt));
   return false;
 }

 // Popup sencillo para el mapa de búsqueda por espacio natural.
 // Muestra únicamente el municipio, la provincia, el porcentaje municipal y las hectáreas.
 function clicMapa(ev){
 if(modo==='punto'){const r=$mapa.getBoundingClientRect(); const p=inv({x:centro.x+ev.clientX-r.left-ancho/2,y:centro.y+ev.clientY-r.top-alto/2}); consultarPunto(p.lon??p[0],p.lat??p[1]);return;}
   const r=$mapa.getBoundingClientRect();
   const x=ev.clientX-r.left;
   const y=ev.clientY-r.top;
   const p=inv({
     x:centro.x+x-ancho/2,
     y:centro.y+y-alto/2
   });

   if(modo==='espacio'){
     const hits=municipiosEspacio.filter(m=>
       GEO[m.cod]?.mun&&contiene(GEO[m.cod].mun,p)
     );

     if(!hits.length){
       cerrarPopup();
       return;
     }

     const cont=el('div');

     hits.forEach((m,i)=>{
       if(i>0){
         const separador=el('hr');
         separador.style.border='0';
         separador.style.borderTop='1px solid #ddd';
         separador.style.margin='7px 0';
         cont.appendChild(separador);
       }

       cont.appendChild(el('strong',null,m.nombre));

       if(m.provincia){
         cont.appendChild(el('div','detalle',m.provincia));
       }

       m.relaciones.forEach(e=>{
         cont.appendChild(el(
           'div',
           'detalle',
           fmt(e.pct_municipio)+' % del municipio · '+fmt(e.solape_ha)+' ha'
         ));
       });
     });

     popupAt(x,y,cont);
     return;
   }

   const hits=entradas.filter(en=>
     en.activa&&contiene(en.e.geom,p)
   );

   if(!hits.length){
     cerrarPopup();
     return;
   }

   const cont=el('div');
   hits.forEach(en=>lineasPopup(en.e,cont));
   popupAt(x,y,cont);
 }

 function dibujarGeometrias(){
   renderTiles();
   $svg.innerHTML='';
   const ns='http://www.w3.org/2000/svg';

   if(capaMun){
     const path=document.createElementNS(ns,'path');
     path.setAttribute('d',geometriaPath(capaMun));
     path.setAttribute('fill','none');
     path.setAttribute('stroke','#111');
     path.setAttribute('stroke-width','3');
     path.setAttribute('vector-effect','non-scaling-stroke');
     path.style.pointerEvents='none';
     $svg.appendChild(path);
   }

   limitesExtra.forEach(lm=>{
     const path=document.createElementNS(ns,'path');
     path.setAttribute('d',geometriaPath(lm.geom));
     path.setAttribute('fill','none');
     path.setAttribute('stroke','#111');
     path.setAttribute('stroke-width','1.2');
     path.setAttribute('vector-effect','non-scaling-stroke');
     path.style.pointerEvents='none';
     $svg.appendChild(path);
   });

   entradas.forEach(en=>{
     if(!en.activa)return;

     const p=document.createElementNS(ns,'path');
     p.setAttribute('d',geometriaPath(en.e.geom));
     p.setAttribute('fill',en.color);
     p.setAttribute('fill-opacity',en.ruido?'.15':'.4');
     p.setAttribute('stroke',en.color);
     p.setAttribute('stroke-width',en.ruido?'2':'1.5');
     p.setAttribute('vector-effect','non-scaling-stroke');
     p.setAttribute('fill-rule','evenodd');

     if(en.ruido)p.setAttribute('stroke-dasharray','5 4');

     p.style.cursor='pointer';

     p.addEventListener('click',ev=>{
       ev.stopPropagation();

       // En la búsqueda por espacio, el clic lo gestiona el pointerup global.
       // Así se evita abrir el popup dos veces.
       if(modo!=='municipio')return;

       enfocar(en.key);
     });

     p.addEventListener('pointermove',ev=>{
       if(arrastre&&arrastre.moved)return;
       p.setAttribute('opacity','.85');
     });

     p.addEventListener('pointerleave',()=>{
       p.setAttribute('opacity','1');
     });

     $svg.appendChild(p);
   });
   if(punto){const pos=screen(punto[0],punto[1]),c=document.createElementNS(ns,'circle');c.setAttribute('cx',pos[0]);c.setAttribute('cy',pos[1]);c.setAttribute('r',8);c.setAttribute('fill','#d62828');c.setAttribute('stroke','white');c.setAttribute('stroke-width',3);$svg.appendChild(c);}
 }

 function ajustarBounds(g,maxZoom=19,pad=.10){
   const b={minX:180,minY:90,maxX:-180,maxY:-90};
   geoBounds(g,b);
   if(b.minX>b.maxX||!Number.isFinite(b.minX))return false;
   const w=Math.max(100,ancho*(1-pad*2)),h=Math.max(100,alto*(1-pad*2));
   let z=maxZoom;
   for(;z>2;z--){
     const a=merc(b.minX,b.maxY,z),c=merc(b.maxX,b.minY,z);
     if(c.x-a.x<=w&&c.y-a.y<=h)break;
   }
   zoom=Math.max(2,Math.min(maxZoom,z));
   const a=merc(b.minX,b.maxY,zoom),c=merc(b.maxX,b.minY,zoom);
   centro={x:(a.x+c.x)/2,y:(a.y+c.y)/2};
   encuadre={zoom,centro:{...centro}};
   return true;
 }

 function construirPanel(){
   $panel.innerHTML='';
   const grupos={};
   entradas.forEach(en=>{
     const n=en.ruido?'Solapes descartados (ruido)':en.e.figura;
     (grupos[n]=grupos[n]||[]).push(en);
   });

   Object.keys(grupos).sort().forEach(n=>{
     const bloque=el('div','pgrupo'),cab=el('label','pcab'),chkG=el('input');
     chkG.type='checkbox';
     chkG.checked=true;
     cab.appendChild(chkG);
     cab.appendChild(document.createTextNode(' '+n));
     bloque.appendChild(cab);
     const hijos=[];

     chkG.addEventListener('change',()=>{
       hijos.forEach(h=>{
         h.checked=chkG.checked;
         h.en.activa=chkG.checked;
       });
       dibujarGeometrias();
     });

     grupos[n].sort((a,b)=>b.e.pct_municipio-a.e.pct_municipio).forEach(en=>{
       const fila=el('label','pitem'),c=el('input');
       c.type='checkbox';
       c.checked=true;
       c.addEventListener('change',()=>{
         en.activa=c.checked;
         chkG.checked=hijos.every(h=>h.checked);
         dibujarGeometrias();
       });
       fila.addEventListener('click',ev=>{
         if(ev.target===c)return;
         ev.preventDefault();
         enfocar(en.key);
       });
       const sw=el('i');
       sw.style.background=en.color;
       fila.appendChild(c);
       fila.appendChild(sw);
       fila.appendChild(document.createTextNode(en.e.espacio+(en.e.tipo?' ('+en.e.tipo+')':'')));
       fila.appendChild(el('small',null,fmt(en.e.pct_municipio)+' %'));
       bloque.appendChild(fila);
       hijos.push({checked:true,en});
     });

     $panel.appendChild(bloque);
   });
 }

 function dibujarMapa(){
   if(!actual||typeof GEO==='undefined'||!GEO[actual]||!GEO[actual].mun){
     $mapaCont.style.display='block';
     return;
   }

   $mapaCont.style.display='block';
   const g=GEO[actual];
   capaMun=g.mun;
   entradas=[];
   $leyenda.innerHTML='';
   const figuras=new Set();
   let hayRuido=false;

   g.esp.forEach(e=>{
     if(!e.geom)return;
     if(!visiblePublico(actual,e))return;
     const ruido=false;
     const col=ruido?'#d62828':colorDe(e.figura);
     entradas.push({e,activa:true,ruido,color:col,key:e.figura+'||'+e.espacio+'||'+(e.tipo||'')});
     if(ruido)hayRuido=true;
     else figuras.add(e.figura);
   });

   requestAnimationFrame(()=>{
     ancho=$mapa.clientWidth;
     alto=$mapa.clientHeight;
     ajustarBounds(capaMun,19,.08);
     dibujarGeometrias();
   });

   construirPanel();

   const item=(color,txt,borde)=>{
     const s=el('span'),i=el('i');
     i.style.background=borde?'transparent':color;
     i.style.border='2px '+(borde||'solid')+' '+color;
     s.appendChild(i);
     s.appendChild(document.createTextNode(txt));
     $leyenda.appendChild(s);
   };

   item('#111','Límite municipal','solid');
   [...figuras].sort().forEach(f=>item(colorDe(f),f));
   if(hayRuido)item('#d62828','Solape descartado (ruido)','dashed');
   cerrarPopup();
   dibujarGeometrias();
 }

 function enfocar(key){
   const en=entradas.find(x=>x.key===key);
   if(!en)return;
   en.activa=true;
   const fila=[...$panel.querySelectorAll('.pitem')].find(f=>f.textContent.includes(en.e.espacio));
   if(fila){
     const chk=fila.querySelector('input[type=checkbox]');
     if(chk)chk.checked=true;
   }
   ajustarBounds(en.e.geom,19,.12);
   dibujarGeometrias();
   
   const c=el('div');
   lineasPopup(en.e,c);
   popupAt(ancho/2,alto/2,c);
 }

 function sugerir(){
   const t=norm($q.value);
   $sug.innerHTML='';
   idxActivo=-1;
   if(!t){$sug.style.display='none';visibles=[];return}
   visibles=lista.filter(m=>m.n.includes(t)).sort((a,b)=>(b.n.startsWith(t))-(a.n.startsWith(t))||a.nombre.localeCompare(b.nombre,'es')).slice(0,12);
   visibles.forEach((m,i)=>{
     const li=el('li');
     li.appendChild(el('span',null,m.nombre));
     li.appendChild(el('small',null,m.provincia));
     li.addEventListener('mousedown',e=>{e.preventDefault();elegir(m)});
     $sug.appendChild(li);
   });
   $sug.style.display=visibles.length?'block':'none';
 }

 function elegir(m){
   $q.value=m.nombre;
   $sug.style.display='none';
   actual=m.cod;
   mostrar();
 }

 function mostrar(){
   $res.innerHTML='';
   dibujarMapa();
   if(!actual)return;

   const m=DATOS[actual],
   espacios=m.espacios.filter(e=>visiblePublico(actual,e)),
   nReales=espacios.length;

   const cab=el('div','municipio');
   cab.appendChild(el('h2',null,m.nombre));
   if(m.provincia)cab.appendChild(el('span',null,m.provincia));
   $res.appendChild(cab);


   if(!espacios.length){
     $res.appendChild(el('div','vacio','Este municipio no tiene espacios protegidos de la RENPA registrados.'));
     return;
   }

   let txt=nReales+(nReales===1?' espacio protegido':' espacios protegidos');
   $res.appendChild(el('p','resumen',txt));

   const grupos={};
   espacios.forEach(e=>(grupos[e.figura]=grupos[e.figura]||[]).push(e));

   Object.keys(grupos).sort((a,b)=>a.localeCompare(b,'es')).forEach(fig=>{
     const g=el('div','grupo');
     g.appendChild(el('h3',null,fig));

     grupos[fig].sort((a,b)=>(a.clasificacion==='RUIDO')-(b.clasificacion==='RUIDO')||b.pct_municipio-a.pct_municipio).forEach(e=>{
       const ruidoActual=esRuido(actual,e),confirmado=estaConfirmado(actual,e);
       const card=el('div','espacio clic'+(ruidoActual?' ruido':''));
       card.title='Ver en el mapa';
       card.addEventListener('click',()=>enfocar(e.figura+'||'+e.espacio+'||'+(e.tipo||'')));

       const fila=el('div','fila'),izq=el('div');
       izq.appendChild(el('span','nombre',e.espacio));
       if(e.tipo)izq.appendChild(el('span','tipo',e.tipo));
       fila.appendChild(izq);
       fila.appendChild(el('span','pct',fmt(e.pct_municipio)+' % del municipio'));
       card.appendChild(fila);

       const barra=el('div','barra'),rel=el('div');
       rel.style.width=Math.max(1,Math.min(100,e.pct_municipio))+'%';
       barra.appendChild(rel);
       card.appendChild(barra);

       const det=el('div','detalle',fmt(e.solape_ha)+' ha dentro del municipio · '+fmt(e.pct_espacio)+' % del espacio');
       card.appendChild(det);

       g.appendChild(card);
     });

     $res.appendChild(g);
   });
 }

 $fondo.addEventListener('change',()=>{
   fondo=$fondo.value;
   dibujarGeometrias();
 });

 let gesto=null, ultimoToque=null, frame=0;
 const dedos=new Map();
 function pintar(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;dibujarGeometrias()});}
 function local(e){const r=$mapa.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 function medidas(){const a=[...dedos.values()];return a.length===1?{x:a[0].x,y:a[0].y,d:1}:{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y))};}
 function iniciar(moved=false){const m=medidas();gesto={...m,z:zoom,cx:centro.x,cy:centro.y,moved,multi:dedos.size>1};}
 function acercar(z,x=ancho/2,y=alto/2){const next=Math.max(2,Math.min(19,z)),ratio=Math.pow(2,next-zoom);centro.x=(centro.x+x-ancho/2)*ratio-x+ancho/2;centro.y=(centro.y+y-alto/2)*ratio-y+alto/2;zoom=next;cerrarPopup();pintar();}
 $mapa.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('#mapaBotones,#popupMapa'))return;e.preventDefault();dedos.set(e.pointerId,local(e));$mapa.setPointerCapture(e.pointerId);iniciar(dedos.size>1||!!gesto?.moved);if(dedos.size>1){ultimoToque=null;cerrarPopup();}});
 $mapa.addEventListener('pointermove',e=>{if(!dedos.has(e.pointerId))return;dedos.set(e.pointerId,local(e));const m=medidas(),g=gesto;if(!g)return;if(Math.hypot(m.x-g.x,m.y-g.y)>4||g.multi)g.moved=true;if(!g.moved)return;const z=Math.max(2,Math.min(19,g.z+(g.multi?Math.log2(m.d/g.d):0))),r=Math.pow(2,z-g.z);zoom=z;centro.x=(g.cx+g.x-ancho/2)*r-m.x+ancho/2;centro.y=(g.cy+g.y-alto/2)*r-m.y+alto/2;cerrarPopup();pintar();});
 function terminar(e,cancel=false){if(!dedos.has(e.pointerId))return;const tap=!cancel&&dedos.size===1&&!gesto.moved&&!gesto.multi;dedos.delete(e.pointerId);if(dedos.size){iniciar(true);return;}gesto=null;if(tap){const p=local(e),t=performance.now();if(ultimoToque&&t-ultimoToque.t<320&&Math.hypot(p.x-ultimoToque.x,p.y-ultimoToque.y)<30){ultimoToque=null;acercar(zoom+1,p.x,p.y);}else{ultimoToque={...p,t};clicMapa(e);}}else ultimoToque=null;}
 $mapa.addEventListener('pointerup',e=>terminar(e));$mapa.addEventListener('pointercancel',e=>terminar(e,true));$mapa.addEventListener('lostpointercapture',e=>terminar(e,true));
 $mapa.addEventListener('wheel',e=>{e.preventDefault();const p=local(e);acercar(zoom+(e.deltaY<0?1:-1),p.x,p.y);},{passive:false});
 document.getElementById('zoomMas').onclick=()=>acercar(zoom+1);
 document.getElementById('zoomMenos').onclick=()=>acercar(zoom-1);
 document.getElementById('zoomInicio').onclick=()=>{if(encuadre){zoom=encuadre.zoom;centro={...encuadre.centro};cerrarPopup();pintar();}};

 window.addEventListener('resize',()=>{
   ancho=$mapa.clientWidth;alto=$mapa.clientHeight;dibujarGeometrias();
 });

 $tabMunicipio.addEventListener('click',()=>cambiarModo('municipio'));
 $tabEspacio.addEventListener('click',()=>cambiarModo('espacio'));

 $qEspacio.addEventListener('input',()=>{
   espacioActual=null;
   $res.innerHTML='';
   $mapaCont.style.display='block';
   sugerirEspacios();
 });
 $qEspacio.addEventListener('focus',sugerirEspacios);
 $qEspacio.addEventListener('blur',()=>setTimeout(()=>$sugEspacio.style.display='none',100));
 $qEspacio.addEventListener('keydown',e=>{
   const items=$sugEspacio.children;
   if(e.key==='ArrowDown'&&items.length)idxEspacio=(idxEspacio+1)%items.length;
   else if(e.key==='ArrowUp'&&items.length)idxEspacio=(idxEspacio-1+items.length)%items.length;
   else if(e.key==='Enter'){
     const x=visiblesEspacio[idxEspacio>=0?idxEspacio:0];
     if(x)elegirEspacio(x);
     return;
   }else return;
   e.preventDefault();
   [...items].forEach((li,i)=>li.classList.toggle('activo',i===idxEspacio));
 });

 $q.addEventListener('input',()=>{
   actual=null;
   $res.innerHTML='';
   $mapaCont.style.display='block';
   sugerir();
 });
 $q.addEventListener('focus',sugerir);
 $q.addEventListener('blur',()=>setTimeout(()=>$sug.style.display='none',100));
 $q.addEventListener('keydown',e=>{
   const items=$sug.children;
   if(e.key==='ArrowDown'&&items.length)idxActivo=(idxActivo+1)%items.length;
   else if(e.key==='ArrowUp'&&items.length)idxActivo=(idxActivo-1+items.length)%items.length;
   else if(e.key==='Enter'){
     const m=visibles[idxActivo>=0?idxActivo:0];
     if(m)elegir(m);
     return;
   }else return;
   e.preventDefault();
   [...items].forEach((li,i)=>li.classList.toggle('activo',i===idxActivo));
 });


 function vistaInicial(){ $mapaCont.style.display='block'; $panel.innerHTML='';$leyenda.innerHTML=''; requestAnimationFrame(()=>{if(actual||espacioActual||punto)return;ancho=$mapa.clientWidth;alto=$mapa.clientHeight;zoom=7;centro=merc(-4.6,37.5);encuadre={zoom,centro:{...centro}};dibujarGeometrias();}); }
 const ficha=document.getElementById('ficha'), abrir=document.getElementById('abrirFicha'), contenido=document.getElementById('contenidoFicha');
 contenido.append($panel,$leyenda); function desplegar(on){ficha.classList.toggle('abierta',on);abrir.setAttribute('aria-expanded',String(on));abrir.textContent=matchMedia('(min-width:721px)').matches?'Resultados':(on?'Resultados ⌄':'Resultados ⌃');} abrir.onclick=()=>desplegar(!ficha.classList.contains('abierta'));
 new MutationObserver(()=>{if($res.children.length)desplegar(true);else desplegar(false);}).observe($res,{childList:true});
 document.getElementById('tabPunto').onclick=()=>cambiarModo('punto');
 function parsePunto(t){t=t.trim();let m; m=t.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/)||t.match(/^\s*(-?\d+,\d+)\s*;\s*(-?\d+,\d+)\s*$/);if(!m)throw Error('Introduce latitud, longitud en grados decimales.');let lat=Number(m[1].replace(',','.')),lon=Number(m[2].replace(',','.'));if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Coordenadas fuera de rango.');return [lon,lat];}
 const error=document.getElementById('errorPunto');
 document.getElementById('formPunto').onsubmit=e=>{e.preventDefault();try{consultarPunto(...parsePunto(document.getElementById('qPunto').value));}catch(e){error.textContent=e.message;}};
 async function consultarPunto(lon,lat){if(!Number.isFinite(lon)||!Number.isFinite(lat))return;const id=++consultaId;error.textContent='Consultando cartografía…';try{const datosPunto=window.RENPA_ESPACIOS_COMPLETOS;if(!datosPunto||!Object.keys(datosPunto).length)throw Error('Cartografía no disponible');if(id!==consultaId||modo!=='punto')return;punto=[lon,lat];entradas=[];capaMun=null;limitesExtra=[];$panel.innerHTML='';$leyenda.innerHTML='';$res.innerHTML='';const hits=Object.entries(datosPunto).filter(([k,g])=>contiene(g,punto));$res.append(el('h2',null,hits.length?hits.length+' figuras de protección':'Sin coincidencias en las capas consultadas'),el('p',null,lat.toFixed(6)+', '+lon.toFixed(6)));for(const [key,g] of hits){const x=catalogoEspacios.get(key);const card=el('div','espacio');card.append(el('strong',null,x.espacio),el('p',null,x.figura+' · '+x.tipo));const b=el('button',null,'Ver espacio completo');b.onclick=()=>{cambiarModo('espacio');elegirEspacio(x);};card.append(b);$res.append(card);entradas.push({e:{geom:window.RENPA_ESPACIOS_COMPLETOS[key],espacio:x.espacio,figura:x.figura,tipo:x.tipo},activa:true,color:colorDe(x.figura),key});}$res.append(el('p','detalle','Consulta orientativa sobre geometría simplificada.'));error.textContent='';document.activeElement.blur();ancho=$mapa.clientWidth;alto=$mapa.clientHeight;zoom=13;centro=merc(lon,lat);encuadre={zoom,centro:{...centro}};dibujarGeometrias();}catch(e){if(id===consultaId)error.textContent='No se pudo realizar la consulta. Comprueba que la cartografía completa está disponible.';}}
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(ancho&&alto)dibujarGeometrias();}).observe($mapa);
 document.querySelectorAll('#homeChoices button').forEach(b=>{b.disabled=false;b.onclick=()=>cambiarModo(b.dataset.mode)});
 document.getElementById('homeLoading').hidden=true;
 document.getElementById('homeBack').onclick=()=>{document.activeElement.blur();document.getElementById('visor').hidden=true;document.getElementById('inicio').hidden=false;document.getElementById('homeBack').hidden=true;};
})();
