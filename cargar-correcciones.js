(function(){
 const key='renpa_correcciones_publicas_v1';
 const fallback=window.RENPA_CORRECCIONES_INICIALES;
 function valido(v){return v&&v.version===1&&Array.isArray(v.exclusiones)&&Array.isArray(v.confirmaciones)&&v.exclusiones.every(x=>typeof x==='string')&&v.confirmaciones.every(x=>typeof x==='string')}
 function aplicar(v){
   const ex=v.exclusiones.map(clave=>({clave,accion:'EXCLUIR'}));const co=v.confirmaciones.map(clave=>({clave,accion:'CONFIRMAR'}));
   if(Array.isArray(window.INCIDENCIAS_RENPA))window.INCIDENCIAS_RENPA.splice(0,window.INCIDENCIAS_RENPA.length,...ex);else window.INCIDENCIAS_RENPA=ex;
   if(Array.isArray(window.SOLAPES_CONFIRMADOS_RENPA))window.SOLAPES_CONFIRMADOS_RENPA.splice(0,window.SOLAPES_CONFIRMADOS_RENPA.length,...co);else window.SOLAPES_CONFIRMADOS_RENPA=co;
 }
 window.RENPA_CARGAR_CORRECCIONES=async function(){
   let data=null,origen='incluidas en la aplicación';
   const url=window.RENPA_DATOS_URL;
   if(url&&/^https:\/\//.test(url)){
     try{
       const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),6500);
       let r;try{r=await fetch(url+'?t='+Date.now(),{cache:'no-store',signal:ctl.signal})}finally{clearTimeout(tm)}
       if(!r.ok)throw Error('HTTP '+r.status);
       const v=await r.json();if(!valido(v))throw Error('Formato no válido');
       data=v;origen='actualizadas desde GitHub';
       try{localStorage.setItem(key,JSON.stringify(v))}catch(_){}
     }catch(e){console.warn('RENPA: no se pudieron actualizar las correcciones; se utilizará la copia disponible.',e)}
   }
   if(!data){try{const v=JSON.parse(localStorage.getItem(key));if(valido(v)){data=v;origen='última copia guardada'}}catch(_){}}
   if(!data){data=fallback;origen='incluidas en la aplicación'}
   if(!valido(data))throw Error('No hay datos de correcciones válidos');
   aplicar(data);
   const el=document.getElementById('estadoSincronizacion');if(el)el.textContent='Correcciones: '+origen+'.';
   return data;
 };
})();
