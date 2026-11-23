(function(){
 const $q=document.getElementById('q'),$sug=document.getElementById('sugerencias'),$res=document.getElementById('resultado'),$chk=document.getElementById('chkRevisar'),$ruido=document.getElementById('chkRuido'),$mapaCont=document.getElementById('mapaCont'),$mapa=document.getElementById('mapa'),$tiles=document.getElementById('teselas'),$svg=document.getElementById('overlay'),$popup=document.getElementById('popupMapa'),$leyenda=document.getElementById('leyenda'),$panel=document.getElementById('capasPanel'),$fondo=document.getElementById('mapaFondo'),$estado=document.getElementById('mapaEstado');
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
   const key=norm(e.figura)+'||'+norm(e.espacio);
   if(!catalogoEspacios.has(key))catalogoEspacios.set(key,{key,figura:e.figura,espacio:e.espacio,registros:[]});
   catalogoEspacios.get(key).registros.push({cod,e});
 }));

 const listaEspacios=[...catalogoEspacios.values()].sort((a,b)=>a.espacio.localeCompare(b.espacio,'es')||a.figura.localeCompare(b.figura,'es'));
 const lista=Object.entries(DATOS).map(([cod,m])=>({cod,nombre:m.nombre,provincia:m.provincia,n:norm(m.nombre),ruido:m.espacios.some(e=>e.clasificacion==='RUIDO')})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
 const COLORES={'Espacios Naturales Protegidos':'#2f6b3a','Red Natura 2000':'#1f6fb2','Reserva de la Biosfera':'#d98a00','ZEPIM':'#8e3fb0'},colorDe=f=>COLORES[f]||'#555555';

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
 function esRuido(cod,e){return (e.clasificacion==='RUIDO'||e.clasif==='RUIDO')&&!estaConfirmado(cod,e)}

 const el=(tag,cls,txt)=>{
   const e=document.createElement(tag);
   if(cls)e.className=cls;
   if(txt!==undefined)e.textContent=txt;
   return e;
 };
 const fmt=(n,d=2)=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});

 function cambiarModo(nuevo){
   modo=nuevo;
   actual=null;
   espacioActual=null;
   entradas=[];
   capaMun=null;
   limitesExtra=[];
   municipiosEspacio=[];
   $res.innerHTML='';
   $mapaCont.style.display='none';
   $popup.style.display='none';
   const esMun=nuevo==='municipio';
   $busquedaMunicipio.style.display=esMun?'block':'none';
   $busquedaEspacio.style.display=esMun?'none':'block';
   $tabMunicipio.classList.toggle('activo',esMun);
   $tabEspacio.classList.toggle('activo',!esMun);
   if(esMun)$q.focus();
   else{$qEspacio.focus();sugerirEspacios()}
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
     li.appendChild(el('small',null,x.figura));
     li.addEventListener('mousedown',ev=>{ev.preventDefault();elegirEspacio(x)});
     $sugEspacio.appendChild(li);
   });
   $sugEspacio.style.display=visiblesEspacio.length?'block':'none';
 }

 function elegirEspacio(x){
   espacioActual=x;
   $qEspacio.value=x.espacio+' · '+x.figura;
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
     const relaciones=registros.filter(r=>r.cod===cod).map(r=>r.e).filter(e=>!estaExcluida(cod,e)&&((e.clasif!=='REVISAR'||$chk.checked||estaConfirmado(cod,e))&&(!esRuido(cod,e)||$ruido.checked)));
     if(relaciones.length)muniValidos.set(cod,{cod,nombre:m.nombre,provincia:m.provincia,relaciones});
   });

   municipiosEspacio=[...muniValidos.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));

   // Se representan todos los fragmentos cartográficos del espacio; las exclusiones solo afectan al listado municipal.
   entradas=registros.filter(r=>!estaExcluida(r.cod,r.e)).map((r,i)=>({e:r.e,activa:true,ruido:false,color:colorDe(espacioActual.figura),key:'espacio||'+r.cod+'||'+i,cod:r.cod,municipio:DATOS[r.cod]?.nombre||r.cod}));
   limitesExtra=municipiosEspacio.map(m=>({cod:m.cod,geom:GEO[m.cod]?.mun,nombre:m.nombre})).filter(x=>x.geom);
   capaMun=null;

   const cab=el('div','municipio');
   cab.appendChild(el('h2',null,espacioActual.espacio));
   cab.appendChild(el('span',null,espacioActual.figura));
   $res.appendChild(cab);
   $res.appendChild(el('p','resumen',municipiosEspacio.length+' municipios con relación registrada en los datos cartográficos.'));

   if(!municipiosEspacio.length)$res.appendChild(el('div','aviso','No hay municipios con relaciones activas para este espacio según los filtros actuales.'));

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
     const n=Math.pow(2,zoom),left=centro.x-ancho/2,top=centro.y-alto/2,x0=Math.floor(left/256),x1=Math.floor((left+ancho)/256),y0=Math.floor(top/256),y1=Math.floor((top+alto)/256);
     for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
       if(y<0||y>=n)continue;
       const im=document.createElement('img');
       im.alt='';
       im.draggable=false;
       im.src=tileUrl(zoom,x,y);
       im.style.left=(x*256-left)+'px';
       im.style.top=(y*256-top)+'px';
       im.onerror=()=>{im.style.display='none'};
       $tiles.appendChild(im);
     }
   }
   $estado.textContent=(fondo==='satellite'?'Satélite: Esri':fondo==='normal'?'Mapa normal: OpenStreetMap':'Sin mapa base')+' · arrastra para desplazarte · rueda para zoom';
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
   if(esRuido(actual,e)){
     t.appendChild(el('br'));
     t.appendChild(el('span','ruidoTxt','⚠ posible fallo de geometría'));
   }else if(estaConfirmado(actual,e)){
     t.appendChild(el('br'));
     t.appendChild(el('span','revisar','✓ solape pequeño confirmado'));
   }
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
       if(modo==='espacio')return;

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
     $mapaCont.style.display='none';
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
     if(estaExcluida(actual,e))return;
     const ruido=esRuido(actual,e);
     if(ruido&&!$ruido.checked)return;
     if(e.clasif==='REVISAR'&&!$chk.checked&&!estaConfirmado(actual,e))return;
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
   $mapaCont.scrollIntoView({behavior:'smooth',block:'center'});
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
     li.appendChild(el('small',null,(DATOS[m.cod].espacios.some(e=>esRuido(m.cod,e)&&!estaExcluida(m.cod,e))?'⚠ ':'')+m.provincia));
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
   todosRuido=m.espacios.filter(e=>esRuido(actual,e)&&!estaExcluida(actual,e)),
   espacios=m.espacios.filter(e=>!estaExcluida(actual,e)&&((e.clasificacion==='CLARO')||(e.clasificacion==='REVISAR'&&$chk.checked)||(esRuido(actual,e)&&$ruido.checked)||(estaConfirmado(actual,e)))),
   nReales=espacios.filter(e=>!esRuido(actual,e)).length,
   nRuido=espacios.length-nReales;

   const cab=el('div','municipio');
   cab.appendChild(el('h2',null,m.nombre));
   if(m.provincia)cab.appendChild(el('span',null,m.provincia));
   $res.appendChild(cab);

   if(todosRuido.length)$res.appendChild(el('div','aviso','⚠ Aviso: este municipio tiene '+todosRuido.length+(todosRuido.length===1?' solape mínimo':' solapes mínimos')+' con espacios protegidos que podrían ser un fallo de geometría (líneas que se solapan ligeramente), no una afección real. Conviene revisarlo.'));

   if(!espacios.length){
     $res.appendChild(el('div','vacio','Este municipio no tiene espacios protegidos de la RENPA registrados.'));
     return;
   }

   let txt=nReales+(nReales===1?' espacio protegido':' espacios protegidos');
   if(nRuido)txt+=' · '+nRuido+(nRuido===1?' posible fallo de geometría':' posibles fallos de geometría');
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
       if(e.clasificacion==='REVISAR'){
  	 if(confirmado)det.appendChild(el('span','revisar',' · ✓ solape pequeño confirmado'));
  	 else det.appendChild(el('span','revisar',' · solape pequeño, a revisar'));
	}
       if(e.clasificacion==='RUIDO'){
 	 if(confirmado)det.appendChild(el('span','revisar',' · ✓ solape pequeño confirmado'));
  	 else det.appendChild(el('span','ruidoTxt',' · ⚠ posible fallo de geometría (solape mínimo)'));
	}
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

 $mapa.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;
   e.preventDefault();
   arrastre={id:e.pointerId,x:e.clientX,y:e.clientY,cx:centro.x,cy:centro.y,lastX:e.clientX,lastY:e.clientY,moved:false};
   $mapa.classList.add('arrastrando');
 });

 window.addEventListener('pointermove',e=>{
   if(!arrastre||e.pointerId!==arrastre.id)return;
   const dx=e.clientX-arrastre.x,dy=e.clientY-arrastre.y;
   if(Math.abs(dx)+Math.abs(dy)>3)arrastre.moved=true;
   if(arrastre.moved){
     e.preventDefault();
     centro.x=arrastre.cx-dx;
     centro.y=arrastre.cy-dy;
     dibujarGeometrias();
   }
   arrastre.lastX=e.clientX;
   arrastre.lastY=e.clientY;
 },{passive:false});

 window.addEventListener('pointerup',e=>{
   if(!arrastre||e.pointerId!==arrastre.id)return;
   const a=arrastre;
   arrastre=null;
   $mapa.classList.remove('arrastrando');
   if(!a.moved)clicMapa(e);
 });

 window.addEventListener('pointercancel',()=>{
   arrastre=null;
   $mapa.classList.remove('arrastrando');
 });

 $mapa.addEventListener('wheel',e=>{
   e.preventDefault();
   const r=$mapa.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,world={x:centro.x+px-ancho/2,y:centro.y+py-alto/2},old=zoom;
   zoom=Math.max(2,Math.min(19,zoom+(e.deltaY<0?1:-1)));
   if(old!==zoom){
     const ratio=Math.pow(2,zoom-old);
     centro.x=world.x*ratio-(px-ancho/2);
     centro.y=world.y*ratio-(py-alto/2);
     dibujarGeometrias();
   }
 },{passive:false});

 window.addEventListener('resize',()=>{
   if(actual||espacioActual)dibujarGeometrias();
 });

 $tabMunicipio.addEventListener('click',()=>cambiarModo('municipio'));
 $tabEspacio.addEventListener('click',()=>cambiarModo('espacio'));

 $qEspacio.addEventListener('input',()=>{
   espacioActual=null;
   $res.innerHTML='';
   $mapaCont.style.display='none';
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
   $mapaCont.style.display='none';
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

 $chk.addEventListener('change',()=>{
   if(modo==='municipio'&&actual)mostrar();
   else if(modo==='espacio'&&espacioActual)mostrarEspacio();
 });

 $ruido.addEventListener('change',()=>{
   if(modo==='municipio'&&actual)mostrar();
   else if(modo==='espacio'&&espacioActual)mostrarEspacio();
 });

})();
