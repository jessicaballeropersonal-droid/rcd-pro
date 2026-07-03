// ============================================================
// RCD PRO · Modulo Produccion
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.produccion = function(el, ctx){
  const pCrear=ctx.can('produccion','escribir'), pEliminar=ctx.can('produccion','eliminar');
  const hf = { desde:'', hasta:'', ubic:'', lote:'' };
  let UBICS=[], TIPOS=[], PRODUCTOS=[], ALIADOS_MAQ=[];
  const rootEl=el;
  rootEl.innerHTML='<div class="tabbar" id="pTabs" style="margin-bottom:12px">'+
    '<button class="tab active" data-t="prod">Produccion</button>'+
    '<button class="tab" data-t="maq">Maquila</button></div><div id="pBody"></div>';
  const pBody=rootEl.querySelector('#pBody');
  el=pBody;
  rootEl.querySelectorAll('#pTabs .tab').forEach(b=>b.onclick=()=>{
    rootEl.querySelectorAll('#pTabs .tab').forEach(x=>x.classList.toggle('active',x===b));
    if(b.dataset.t==='maq') maquila(); else lista();
  });

  function msg(r){
    if(typeof r==='string' && r.indexOf('SIN_STOCK:')===0) return 'No hay suficiente stock del tipo '+r.slice(10)+'. Usa otro tipo o ajusta el inventario.';
    return ({SIN_PERMISO:'No tienes permiso.', SIN_CONSUMO:'Agrega al menos un consumo de RCD.',
      SIN_SALIDA:'Agrega al menos un producto generado.', CONSUMO_INVALIDO:'Revisa las lineas de consumo.',
      SALIDA_INVALIDA:'Revisa las lineas de producto.'})[r] || 'No se pudo completar la accion.';
  }
  function ubicTxt(id){ const u=UBICS.filter(x=>x.id===id)[0]; return u?u.nombre:(id||''); }

  async function cargarCatalogos(){
    if(!UBICS.length){ try{ const r=await ctx.rpc('rcd_ubicaciones_lista',{p_gestor_id:ctx.ses.gestor_id}); UBICS=Array.isArray(r)?r:[]; }catch(e){} }
    if(!TIPOS.length){ try{ const r=await ctx.rpc('rcd_tipos_residuo_lista',{}); TIPOS=(Array.isArray(r)?r:[]).filter(t=>t.aprovechable); }catch(e){} }
    if(!PRODUCTOS.length){ try{ const r=await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); PRODUCTOS=(Array.isArray(r)?r:[]).filter(p=>p.activo); }catch(e){} }
    if(!ALIADOS_MAQ.length){ try{ const r=await ctx.rpc('rcd_aliados_lista',{p_gestor_id:ctx.ses.gestor_id}); ALIADOS_MAQ=(Array.isArray(r)?r:[]).filter(a=>a.es_maquila && a.activo!==false); }catch(e){} }
  }

  // ===================== HISTORIAL =====================
  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    await cargarCatalogos();
    let rows=[];
    try{ const r=await ctx.rpc('rcd_produccion_lista',{p_gestor_id:ctx.ses.gestor_id,p_desde:hf.desde||null,p_hasta:hf.hasta||null,p_ubicacion:hf.ubic||null,p_lote:hf.lote||null}); rows=Array.isArray(r)?r:[]; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
        '<h3 style="margin:0">Produccion</h3>'+
        (pCrear?'<button class="btn primary sm" id="bNueva">+ Nueva produccion</button>':'')+
      '</div>'+
      '<p class="lead" style="margin:6px 0 12px">Consume materia prima y genera producto terminado. Mueve el inventario.</p>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">'+
        '<div class="field" style="margin:0"><label>Desde</label><input type="date" id="f_desde" value="'+esc(hf.desde)+'"></div>'+
        '<div class="field" style="margin:0"><label>Hasta</label><input type="date" id="f_hasta" value="'+esc(hf.hasta)+'"></div>'+
        '<div class="field" style="margin:0"><label>Ubicacion</label><select id="f_ubic"><option value="">Todas</option>'+
          UBICS.map(u=>'<option value="'+esc(u.id)+'"'+(hf.ubic===u.id?' selected':'')+'>'+esc(u.nombre)+'</option>').join('')+'</select></div>'+
        '<div class="field" style="margin:0"><label>Lote</label><input id="f_lote" value="'+esc(hf.lote)+'" placeholder="Buscar"></div>'+
        '<button class="btn ghost sm" id="bFiltrar">Filtrar</button>'+
        '<button class="btn ghost sm" id="bLimpiar">Limpiar</button>'+
      '</div>'+
      (rows.length?
        '<table class="mtable" style="margin-top:12px"><tr><th>N.º</th><th>Fecha</th><th>Turno</th><th>Lote</th><th>Ubicacion</th><th style="text-align:right">Consumido</th><th style="text-align:right">Producido</th><th></th></tr>'+
        rows.map(function(p,i){ return '<tr><td class="mono"><b>'+esc(p.numero||'')+'</b></td><td class="mono">'+esc(p.fecha||'')+'</td>'+
          '<td>'+(p.turno?esc(p.turno.charAt(0).toUpperCase()+p.turno.slice(1)):'-')+'</td><td>'+esc(p.lote||'-')+'</td><td>'+esc(p.ubicacion||'')+'</td>'+
          '<td class="mono" style="text-align:right">'+numEs(p.consumido)+'</td><td class="mono" style="text-align:right">'+numEs(p.producido)+'</td>'+
          '<td><div class="rowbtns"><button class="btn ghost sm" data-ver="'+i+'">Ver</button>'+(pEliminar?'<button class="btn ghost sm" data-anu="'+i+'">Anular</button>':'')+'</div></td></tr>'; }).join('')+'</table>'
        : '<div class="empty" style="margin-top:12px">Sin producciones con esos filtros.</div>')+
      '</div>';
    const b=el.querySelector('#bNueva'); if(b) b.onclick=()=>form();
    el.querySelector('#bFiltrar').onclick=function(){ hf.desde=v(el,'f_desde'); hf.hasta=v(el,'f_hasta'); hf.ubic=v(el,'f_ubic'); hf.lote=v(el,'f_lote'); lista(); };
    el.querySelector('#bLimpiar').onclick=function(){ hf.desde=hf.hasta=hf.ubic=hf.lote=''; lista(); };
    rows.forEach(function(p,i){
      const vb=el.querySelector('[data-ver="'+i+'"]'); if(vb) vb.onclick=()=>detalle(p);
      const ab=el.querySelector('[data-anu="'+i+'"]'); if(ab) ab.onclick=()=>anular(p);
    });
  }

  // ===================== NUEVA PRODUCCION =====================
  async function form(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    await cargarCatalogos();
    let ubic = (UBICS[0]&&UBICS[0].id) || 'planta';
    const consumo=[{tipo:'',cant:''}], salida=[{prod:'',cant:''}];

    function render(){
      el.innerHTML=
        '<div class="mcard" style="max-width:760px">'+
        '<button class="btn ghost sm" id="bBack">&larr; Produccion</button>'+
        '<h3 style="margin:12px 0 10px">Nueva produccion</h3>'+
        '<div class="row2"><div class="field"><label>Fecha</label><input type="date" id="p_fecha"></div>'+
          '<div class="field"><label>Turno</label><select id="p_turno"><option value="dia">Dia</option><option value="noche">Noche</option></select></div></div>'+
        '<div class="row2"><div class="field"><label>Lote (opcional)</label><input id="p_lote" placeholder="Ej. L-045"></div>'+
          '<div class="field"><label>Ubicacion</label><select id="p_ubic">'+UBICS.map(u=>'<option value="'+esc(u.id)+'"'+(ubic===u.id?' selected':'')+'>'+esc(u.nombre)+'</option>').join('')+'</select></div></div>'+

        '<div style="font-size:13px;font-weight:700;color:var(--esc-d);margin:14px 0 6px">Consumo · materia prima</div>'+
        '<table class="mtable"><tr><th>Tipo de RCD</th><th>Disponible</th><th style="text-align:right">Cantidad (t)</th><th></th></tr>'+
          consumo.map(function(c,i){ return '<tr>'+
            '<td><select data-ct="'+i+'"><option value="">Selecciona...</option>'+TIPOS.map(t=>'<option value="'+t.id+'"'+(c.tipo===t.id?' selected':'')+'>'+esc(t.codigo)+' · '+esc(t.nombre)+'</option>').join('')+'</select></td>'+
            '<td class="mono" data-disp="'+i+'" style="font-size:11px;color:var(--muted)">'+(c.disp!=null?numEs(c.disp)+' t':'-')+'</td>'+
            '<td style="text-align:right"><input class="cellnum" data-cc="'+i+'" value="'+esc(c.cant)+'"></td>'+
            '<td><button class="btn ghost sm" data-cx="'+i+'">×</button></td></tr>'; }).join('')+'</table>'+
        '<button class="btn ghost sm" id="bAddC" style="margin-top:6px">+ Agregar consumo</button>'+

        '<div style="font-size:13px;font-weight:700;color:var(--esc-d);margin:16px 0 6px">Producto generado</div>'+
        '<table class="mtable"><tr><th>Producto</th><th style="text-align:right">Cantidad (t)</th><th></th></tr>'+
          salida.map(function(s,i){ return '<tr>'+
            '<td><select data-st="'+i+'"><option value="">Selecciona...</option>'+PRODUCTOS.map(p=>'<option value="'+p.id+'"'+(s.prod===p.id?' selected':'')+'>'+esc(p.nombre)+'</option>').join('')+'</select></td>'+
            '<td style="text-align:right"><input class="cellnum" data-sc="'+i+'" value="'+esc(s.cant)+'"></td>'+
            '<td><button class="btn ghost sm" data-sx="'+i+'">×</button></td></tr>'; }).join('')+'</table>'+
        '<button class="btn ghost sm" id="bAddS" style="margin-top:6px">+ Agregar producto</button>'+

        '<div style="display:flex;gap:18px;flex-wrap:wrap;background:#FAFAF8;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:14px">'+
          '<div style="font-size:12px;color:var(--muted)">Consumido<b style="display:block;font-family:JetBrains Mono,monospace;font-size:16px;color:var(--ink)" id="totC">0</b></div>'+
          '<div style="font-size:12px;color:var(--muted)">Producido<b style="display:block;font-family:JetBrains Mono,monospace;font-size:16px;color:var(--ink)" id="totS">0</b></div>'+
          '<div style="font-size:12px;color:var(--muted)">Diferencia (merma)<b style="display:block;font-family:JetBrains Mono,monospace;font-size:16px;color:var(--ink)" id="totD">0</b></div>'+
        '</div>'+

        '<div class="field" style="margin-top:12px"><label>Observaciones</label><input id="p_obs"></div>'+
        '<div style="display:flex;gap:10px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar produccion</button></div>'+
        '</div>';
      wire();
    }

    function leer(){
      consumo.forEach((c,i)=>{ const ts=el.querySelector('[data-ct="'+i+'"]'); const cc=el.querySelector('[data-cc="'+i+'"]'); if(ts) c.tipo=ts.value; if(cc) c.cant=cc.value; });
      salida.forEach((s,i)=>{ const ps=el.querySelector('[data-st="'+i+'"]'); const sc=el.querySelector('[data-sc="'+i+'"]'); if(ps) s.prod=ps.value; if(sc) s.cant=sc.value; });
    }
    function totales(){
      const tc=consumo.reduce((a,c)=>a+(parseNum(c.cant)||0),0);
      const ts=salida.reduce((a,s)=>a+(parseNum(s.cant)||0),0);
      const tC=el.querySelector('#totC'), tS=el.querySelector('#totS'), tD=el.querySelector('#totD');
      if(tC) tC.textContent=numEs(Math.round(tc*1000)/1000);
      if(tS) tS.textContent=numEs(Math.round(ts*1000)/1000);
      if(tD) tD.textContent=numEs(Math.round((tc-ts)*1000)/1000);
    }
    async function dispDe(i){
      const c=consumo[i]; if(!c.tipo){ c.disp=null; return; }
      try{ const r=await ctx.rpc('rcd_inv_stock_materia',{p_gestor_id:ctx.ses.gestor_id,p_tipo_id:c.tipo,p_ubicacion:ubic}); c.disp=Number(scalar(r))||0; }catch(e){ c.disp=null; }
      const d=el.querySelector('[data-disp="'+i+'"]'); if(d) d.textContent=(c.disp!=null?numEs(c.disp)+' t':'-');
    }

    function wire(){
      el.querySelector('#bBack').onclick=lista;
      el.querySelector('#bCancel').onclick=lista;
      el.querySelector('#p_ubic').onchange=function(){ leer(); ubic=this.value; consumo.forEach((c,i)=>dispDe(i)); };
      el.querySelector('#bAddC').onclick=function(){ leer(); consumo.push({tipo:'',cant:''}); render(); };
      el.querySelector('#bAddS').onclick=function(){ leer(); salida.push({prod:'',cant:''}); render(); };
      consumo.forEach(function(c,i){
        const ts=el.querySelector('[data-ct="'+i+'"]'); if(ts) ts.onchange=function(){ leer(); dispDe(i); };
        const cc=el.querySelector('[data-cc="'+i+'"]'); if(cc) cc.oninput=function(){ c.cant=cc.value; totales(); };
        const cx=el.querySelector('[data-cx="'+i+'"]'); if(cx) cx.onclick=function(){ leer(); if(consumo.length>1) consumo.splice(i,1); else { consumo[0]={tipo:'',cant:''}; } render(); };
      });
      salida.forEach(function(s,i){
        const ps=el.querySelector('[data-st="'+i+'"]'); if(ps) ps.onchange=function(){ leer(); };
        const sc=el.querySelector('[data-sc="'+i+'"]'); if(sc) sc.oninput=function(){ s.cant=sc.value; totales(); };
        const sx=el.querySelector('[data-sx="'+i+'"]'); if(sx) sx.onclick=function(){ leer(); if(salida.length>1) salida.splice(i,1); else { salida[0]={prod:'',cant:''}; } render(); };
      });
      el.querySelector('#bSave').onclick=guardar;
      // cargar disponibles iniciales
      consumo.forEach((c,i)=>{ if(c.tipo) dispDe(i); });
      totales();
    }

    async function guardar(){
      leer();
      const btn=el.querySelector('#bSave');
      const cons=consumo.filter(c=>c.tipo && parseNum(c.cant)>0).map(c=>({tipo_id:c.tipo, cantidad:parseNum(c.cant)}));
      const sal =salida.filter(s=>s.prod && parseNum(s.cant)>0).map(s=>({producto_id:s.prod, cantidad:parseNum(s.cant)}));
      if(!cons.length){ ctx.toast('Agrega al menos un consumo de RCD.','error'); return; }
      if(!sal.length){ ctx.toast('Agrega al menos un producto generado.','error'); return; }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_produccion_crear',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_fecha:v(el,'p_fecha')||null,
          p_turno:v(el,'p_turno'), p_lote:v(el,'p_lote'), p_ubicacion:v(el,'p_ubic'),
          p_observaciones:v(el,'p_obs'), p_consumo:cons, p_salida:sal }));
        if(typeof r==='string' && r.indexOf('PRD-')===0){ ctx.toast('Produccion '+r+' guardada'); lista(); return; }
        ctx.toast(msg(r),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar produccion';
    }

    render();
  }

  // ===================== MAQUILA (envio) =====================
  async function maquila(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    await cargarCatalogos();
    const APR = PRODUCTOS.filter(p=>p.es_aprovechado);
    const consumo=[{tipo:'',cant:''}], salida=[{prod:'',cant:''}];
    let destino='propio';
    function aliadoSel(){ return destino==='propio'?null:ALIADOS_MAQ.filter(a=>a.id===destino)[0]; }
    function totalTons(){ return consumo.reduce((a,c)=>a+(parseNum(c.cant)||0),0); }

    function render(){
      const a=aliadoSel();
      const precio=a?(+a.precio_maquila_t||0):0, costo=precio*totalTons();
      el.innerHTML=
        '<div class="mcard" style="max-width:760px">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><h3 style="margin:0 0 4px">Envio a maquila</h3><button class="btn ghost sm" id="bLiq">Liquidacion</button></div>'+
        '<p class="lead" style="margin:0 0 12px">Procesa RCD aprovechable en un aliado (con costo) o en tu propio patio (sin costo). Entra X, sale X.</p>'+
        '<div class="row2"><div class="field"><label>Fecha</label><input type="date" id="m_fecha"></div>'+
          '<div class="field"><label>Destino (patio)</label><select id="m_dest">'+
            '<option value="propio"'+(destino==='propio'?' selected':'')+'>Mi patio propio (sin costo)</option>'+
            ALIADOS_MAQ.map(x=>'<option value="'+esc(x.id)+'"'+(destino===x.id?' selected':'')+'>'+esc(x.razon_social)+' (con costo)</option>').join('')+
          '</select></div></div>'+

        '<div style="font-size:13px;font-weight:700;color:var(--esc-d);margin:14px 0 6px">Aprovechable que entra (sale de planta)</div>'+
        '<table class="mtable"><tr><th>Tipo de RCD</th><th>Disponible</th><th style="text-align:right">Cantidad (t)</th><th></th></tr>'+
          consumo.map(function(c,i){ return '<tr>'+
            '<td><select data-ct="'+i+'"><option value="">Selecciona...</option>'+TIPOS.map(t=>'<option value="'+t.id+'"'+(c.tipo===t.id?' selected':'')+'>'+esc(t.codigo)+' · '+esc(t.nombre)+'</option>').join('')+'</select></td>'+
            '<td class="mono" data-disp="'+i+'" style="font-size:11px;color:var(--muted)">'+(c.disp!=null?numEs(c.disp)+' t':'-')+'</td>'+
            '<td style="text-align:right"><input class="cellnum" data-cc="'+i+'" value="'+esc(c.cant)+'"></td>'+
            '<td><button class="btn ghost sm" data-cx="'+i+'">×</button></td></tr>'; }).join('')+'</table>'+
        '<button class="btn ghost sm" id="bAddC" style="margin-top:6px">+ Agregar</button>'+

        '<div style="font-size:13px;font-weight:700;color:var(--esc-d);margin:16px 0 6px">Aprovechado que sale (queda en '+(a?esc(a.razon_social):'tu patio')+')</div>'+
        (APR.length?'':'<div class="note warn" style="margin-bottom:8px">No hay materiales aprovechados. Clasifica un articulo como "Aprovechado" en Lista de precios &rarr; Articulos.</div>')+
        '<table class="mtable"><tr><th>Material aprovechado</th><th style="text-align:right">Cantidad (t)</th><th></th></tr>'+
          salida.map(function(s,i){ return '<tr>'+
            '<td><select data-st="'+i+'"><option value="">Selecciona...</option>'+APR.map(p=>'<option value="'+p.id+'"'+(s.prod===p.id?' selected':'')+'>'+esc(p.nombre)+'</option>').join('')+'</select></td>'+
            '<td style="text-align:right"><input class="cellnum" data-sc="'+i+'" value="'+esc(s.cant)+'"></td>'+
            '<td><button class="btn ghost sm" data-sx="'+i+'">×</button></td></tr>'; }).join('')+'</table>'+
        '<button class="btn ghost sm" id="bAddS" style="margin-top:6px">+ Agregar</button>'+

        '<div style="display:flex;gap:18px;flex-wrap:wrap;background:#FAFAF8;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:14px">'+
          '<div style="font-size:12px;color:var(--muted)">Toneladas<b style="display:block;font-family:JetBrains Mono,monospace;font-size:16px;color:var(--ink)" id="m_tons">'+numEs(totalTons())+'</b></div>'+
          '<div style="font-size:12px;color:var(--muted)">Costo de maquila<b style="display:block;font-family:JetBrains Mono,monospace;font-size:16px;color:'+(costo>0?'#993C1D':'var(--ink)')+'" id="m_costo">'+(a?('$ '+numEs(costo)):'$ 0 (propio)')+'</b></div>'+
        '</div>'+

        '<div class="field" style="margin-top:12px"><label>Observaciones</label><input id="m_obs"></div>'+
        '<div style="display:flex;gap:10px"><button class="btn primary" id="bSaveM">Guardar envio</button></div>'+
        '</div>';
      wire();
    }
    function leer(){
      consumo.forEach((c,i)=>{ const ts=el.querySelector('[data-ct="'+i+'"]'); const cc=el.querySelector('[data-cc="'+i+'"]'); if(ts) c.tipo=ts.value; if(cc) c.cant=cc.value; });
      salida.forEach((s,i)=>{ const ps=el.querySelector('[data-st="'+i+'"]'); const sc=el.querySelector('[data-sc="'+i+'"]'); if(ps) s.prod=ps.value; if(sc) s.cant=sc.value; });
    }
    function refreshTot(){
      const a=aliadoSel(), precio=a?(+a.precio_maquila_t||0):0, t=totalTons(), costo=precio*t;
      const et=el.querySelector('#m_tons'), ec=el.querySelector('#m_costo');
      if(et) et.textContent=numEs(t);
      if(ec){ ec.textContent=a?('$ '+numEs(costo)):'$ 0 (propio)'; ec.style.color=(costo>0?'#993C1D':'var(--ink)'); }
    }
    async function dispDe(i){
      const c=consumo[i]; if(!c.tipo){ c.disp=null; return; }
      try{ const r=await ctx.rpc('rcd_inv_stock_materia',{p_gestor_id:ctx.ses.gestor_id,p_tipo_id:c.tipo,p_ubicacion:'planta'}); c.disp=Number(scalar(r))||0; }catch(e){ c.disp=null; }
      const d=el.querySelector('[data-disp="'+i+'"]'); if(d) d.textContent=(c.disp!=null?numEs(c.disp)+' t':'-');
    }
    function wire(){
      el.querySelector('#m_dest').onchange=function(){ leer(); destino=this.value; render(); };
      el.querySelector('#bAddC').onclick=function(){ leer(); consumo.push({tipo:'',cant:''}); render(); };
      el.querySelector('#bAddS').onclick=function(){ leer(); salida.push({prod:'',cant:''}); render(); };
      consumo.forEach(function(c,i){
        const ts=el.querySelector('[data-ct="'+i+'"]'); if(ts) ts.onchange=function(){ leer(); dispDe(i); };
        const cc=el.querySelector('[data-cc="'+i+'"]'); if(cc) cc.oninput=function(){ c.cant=cc.value; refreshTot(); };
        const cx=el.querySelector('[data-cx="'+i+'"]'); if(cx) cx.onclick=function(){ leer(); if(consumo.length>1) consumo.splice(i,1); else consumo[0]={tipo:'',cant:''}; render(); };
      });
      salida.forEach(function(s,i){
        const ps=el.querySelector('[data-st="'+i+'"]'); if(ps) ps.onchange=function(){ leer(); };
        const sc=el.querySelector('[data-sc="'+i+'"]'); if(sc) sc.oninput=function(){ s.cant=sc.value; };
        const sx=el.querySelector('[data-sx="'+i+'"]'); if(sx) sx.onclick=function(){ leer(); if(salida.length>1) salida.splice(i,1); else salida[0]={prod:'',cant:''}; render(); };
      });
      el.querySelector('#bSaveM').onclick=guardar;
      const bl=el.querySelector('#bLiq'); if(bl) bl.onclick=maquilaLiq;
      consumo.forEach((c,i)=>{ if(c.tipo) dispDe(i); });
    }
    async function guardar(){
      leer();
      const btn=el.querySelector('#bSaveM');
      const cons=consumo.filter(c=>c.tipo && parseNum(c.cant)>0).map(c=>({tipo_id:c.tipo, cantidad:parseNum(c.cant)}));
      const sal =salida.filter(s=>s.prod && parseNum(s.cant)>0).map(s=>({producto_id:s.prod, cantidad:parseNum(s.cant)}));
      if(!cons.length){ ctx.toast('Agrega al menos un aprovechable.','error'); return; }
      if(!sal.length){ ctx.toast('Agrega al menos un material aprovechado.','error'); return; }
      const a=aliadoSel();
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_maquila_crear',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_fecha:v(el,'m_fecha')||null,
          p_aliado_id: a?a.id:null, p_consumo:cons, p_salida:sal, p_observaciones:v(el,'m_obs') }));
        if(typeof r==='string' && r.indexOf('MAQ-')===0){ ctx.toast('Envio '+r+' guardado'); maquila(); return; }
        ctx.toast(msg(r),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar envio';
    }
    render();
  }

  async function maquilaLiq(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let rows=[]; try{ const r=await ctx.rpc('rcd_maquila_costos',{p_gestor_id:ctx.ses.gestor_id}); rows=Array.isArray(r)?r:[]; }catch(e){}
    const money=n=>'$ '+Math.round(+n||0).toLocaleString('es-CO');
    const total=rows.reduce((a,r)=>a+(+r.costo_total||0),0);
    el.innerHTML=
      '<div class="mcard" style="max-width:760px">'+
      '<button class="btn ghost sm" id="bBackM">&larr; Envio a maquila</button>'+
      '<h3 style="margin:12px 0 4px">Liquidacion de maquila</h3>'+
      '<p class="lead" style="margin:0 0 12px">Lo que le debes a cada maquila por procesar (costo de los envios).</p>'+
      (rows.length?
        '<table class="mtable"><tr><th>Maquila</th><th style="text-align:right">Envios</th><th style="text-align:right">Costo total</th></tr>'+
        rows.map(r=>'<tr><td><b>'+esc(r.aliado)+'</b></td><td class="mono" style="text-align:right">'+numEs(r.envios)+'</td><td class="mono" style="text-align:right">'+money(r.costo_total)+'</td></tr>').join('')+
        '<tr><td><b>Total</b></td><td></td><td class="mono" style="text-align:right;font-weight:700">'+money(total)+'</td></tr></table>'
        : '<div class="empty">Sin envios a maquila con costo todavia.</div>')+
      '</div>';
    el.querySelector('#bBackM').onclick=maquila;
  }

  // ===================== DETALLE =====================
  async function detalle(p){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let lines=[];
    try{ const r=await ctx.rpc('rcd_produccion_detalle',{p_id:p.id}); lines=Array.isArray(r)?r:[]; }catch(e){}
    const cons=lines.filter(l=>l.clase==='consumo'), sal=lines.filter(l=>l.clase==='producto');
    function tabla(titulo,arr){
      const tot=arr.reduce((a,l)=>a+Number(l.cantidad_t||0),0);
      return '<div style="font-size:13px;font-weight:700;color:var(--esc-d);margin:14px 0 6px">'+titulo+'</div>'+
        (arr.length?'<table class="mtable"><tr><th>Item</th><th style="text-align:right">Cantidad (t)</th></tr>'+
          arr.map(l=>'<tr><td>'+esc(l.item||'')+'</td><td class="mono" style="text-align:right">'+numEs(l.cantidad_t)+'</td></tr>').join('')+
          '<tr><td style="font-weight:700;border-top:2px solid var(--line)">Total</td><td class="mono" style="text-align:right;font-weight:700;border-top:2px solid var(--line)">'+numEs(tot)+'</td></tr></table>'
          :'<div class="empty">-</div>');
    }
    el.innerHTML=
      '<div class="mcard" style="max-width:640px">'+
      '<button class="btn ghost sm" id="bBackD">&larr; Produccion</button>'+
      '<h3 style="margin:12px 0 2px">'+esc(p.numero||'')+'</h3>'+
      '<p class="lead">'+esc(p.fecha||'')+' · '+(p.turno?esc(p.turno):'')+' · '+esc(p.ubicacion||'')+(p.lote?' · Lote '+esc(p.lote):'')+'</p>'+
      tabla('Consumo · materia prima', cons)+
      tabla('Producto generado', sal)+
      '</div>';
    el.querySelector('#bBackD').onclick=lista;
  }

  async function anular(p){
    if(!(await ctx.confirm('Anular la produccion '+(p.numero||'')+'? Se revierte su efecto en el inventario.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_produccion_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:p.id}));
      if(r==='OK'){ ctx.toast('Produccion anulada'); lista(); return; }
      ctx.toast(msg(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  lista();
};
