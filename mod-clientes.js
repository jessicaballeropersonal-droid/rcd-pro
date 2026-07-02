// ============================================================
// RCD PRO · Modulo Clientes y Obras
// (usa helpers globales definidos en mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.clientes = function(el, ctx){
  const pCrear=ctx.can('clientes','escribir'), pEditar=ctx.can('clientes','editar'), pEliminar=ctx.can('clientes','eliminar');

  // Tabs: Clientes y obras | Terceros (clasificacion desde TNS)
  const rootEl = el;
  rootEl.innerHTML =
    '<div class="tabbar" id="cTabs" style="margin-bottom:12px">'+
      '<button class="tab active" data-t="clientes">Clientes y obras</button>'+
      '<button class="tab" data-t="terceros">Terceros</button>'+
    '</div><div id="cBody"></div>';
  const cBody = rootEl.querySelector('#cBody');
  el = cBody;
  rootEl.querySelectorAll('#cTabs .tab').forEach(b=>b.onclick=()=>{
    rootEl.querySelectorAll('#cTabs .tab').forEach(x=>x.classList.toggle('active',x===b));
    if(b.dataset.t==='terceros') terceros(cBody, ctx); else lista();
  });

  // ===== Nivel 1: lista de clientes =====
  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let cs=[]; try{ const r=await ctx.rpc('rcd_clientes_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) cs=r; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<h3 style="margin-top:0">Clientes y obras</h3>'+
      '<p class="lead">El cliente (generador) y sus obras. La obra define el regimen (PMA/Cupo) por su area.</p>'+
      (cs.length?
        '<table class="mtable"><tr><th>Cliente</th><th>NIT</th><th>Obras</th><th>Estado</th><th></th></tr>'+
        cs.map((c,i)=>'<tr><td><b>'+esc(c.razon_social)+'</b></td><td class="mono">'+esc(c.nit||'')+'</td>'+
          '<td class="mono">'+c.n_obras+'</td>'+
          '<td><span class="badge '+(c.activo?'ok':'off')+'">'+(c.activo?'Activo':'Inactivo')+'</span></td>'+
          '<td><div class="rowbtns"><button class="btn ghost sm" data-open="'+i+'">Obras</button>'+
          (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay clientes.</div>')+
      '</div>';
    el.querySelectorAll('[data-open]').forEach(b=>{const i=+b.dataset.open; b.onclick=()=>detalle(cs[i]);});
    el.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>formCliente(cs[i]);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anularCliente(cs[i]);});
  }

  function formCliente(c){
    const nuevo=!c;
    el.innerHTML=
      '<div class="mcard" style="max-width:760px">'+
      '<h3 style="margin-top:0">Editar cliente</h3>'+
      '<div class="note" style="margin-bottom:10px">La identidad viene de TNS (solo lectura). Se actualiza al clasificar el tercero en la pestana Terceros.</div>'+
      '<div class="field"><label>Nombre o razon social <span style="color:#8A8A82;font-weight:400">&middot; TNS</span></label><input id="c_razon" value="'+esc(c.razon_social||'')+'" readonly style="background:#F0F0EC"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Documento / NIT <span style="color:#8A8A82;font-weight:400">&middot; TNS</span></label><input id="c_nit" value="'+esc(c.nit||'')+'" readonly style="background:#F0F0EC"></div>'+
        '<div class="field"><label>Representante legal <span style="color:#8A8A82;font-weight:400">&middot; TNS</span></label><input id="c_rep" value="'+esc(c.rep_legal||'')+'" readonly style="background:#F0F0EC"></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Nombre de contacto</label><input id="c_contacto" value="'+esc(c.contacto||'')+'"></div>'+
        '<div class="field"><label>Telefono <span style="color:#8A8A82;font-weight:400">&middot; TNS</span></label><input id="c_tel" value="'+esc(c.telefono||'')+'" readonly style="background:#F0F0EC"></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Correo <span style="color:#8A8A82;font-weight:400">&middot; TNS</span></label><input id="c_correo" value="'+esc(c.correo||'')+'" readonly style="background:#F0F0EC"></div>'+
        '<div class="field"><label>Direccion (domicilio) <span style="color:#8A8A82;font-weight:400">&middot; TNS</span></label><input id="c_dir" value="'+esc(c.direccion||'')+'" readonly style="background:#F0F0EC"></div>'+
      '</div>'+
      '<div class="field"><label>Estado</label><select id="c_activo"><option value="true"'+(c.activo?' selected':'')+'>Activo</option><option value="false"'+(!c.activo?' selected':'')+'>Inactivo</option></select></div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>'+
      '</div>';
    el.querySelector('#bCancel').onclick=lista;
    el.querySelector('#bSave').onclick=async function(){
      const btn=this, razon=v(el,'c_razon'); if(!razon){ ctx.toast('Escribe el nombre o razon social.','error'); return; }
      const activo=nuevo?true:(el.querySelector('#c_activo').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_cliente_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:nuevo?null:c.id,
          p_razon:razon, p_nit:v(el,'c_nit'), p_rep:v(el,'c_rep'), p_contacto:v(el,'c_contacto'),
          p_direccion:v(el,'c_dir'), p_telefono:v(el,'c_tel'), p_correo:v(el,'c_correo'), p_activo:activo}));
        if(r==='OK'){ ctx.toast('Cliente guardado'); lista(); return; }
        ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.','error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularCliente(c){
    if(!(await ctx.confirm('Anular el cliente "'+c.razon_social+'"? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_cliente_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:c.id}));
      if(r==='OK'){ ctx.toast('Cliente anulado'); lista(); return; }
      ctx.toast(r==='TIENE_OBRAS'?'No se puede anular: tiene obras activas. Anula primero las obras.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.'),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===== Nivel 2: detalle del cliente + sus obras =====
  function detalle(c){
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<button class="btn ghost sm" id="bBack">&larr; Clientes</button>'+
      '<h3 style="margin:12px 0 2px">'+esc(c.razon_social)+'</h3>'+
      '<p class="lead">'+esc(c.nit||'')+(c.contacto?' &middot; '+esc(c.contacto):'')+(c.telefono?' &middot; '+esc(c.telefono):'')+'</p>'+
      '<div id="secObras" style="margin-top:8px"></div>'+
      '</div>';
    el.querySelector('#bBack').onclick=lista;
    obras(c);
  }

  async function obras(c){
    const cont=el.querySelector('#secObras');
    cont.innerHTML='<div class="loading">Cargando obras...</div>';
    let os=[]; try{ const r=await ctx.rpc('rcd_obras_lista',{p_cliente_id:c.id}); if(Array.isArray(r)) os=r; }catch(e){}
    cont.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px"><b>Obras</b>'+
        (pCrear?'<button class="btn ghost sm" id="bNuevaObra" style="margin-left:auto">+ Nueva obra</button>':'')+'</div>'+
      (os.length?
        '<table class="mtable"><tr><th>Obra</th><th>Ubicacion</th><th>Regimen</th><th>Pago</th><th>N.º generador</th><th></th></tr>'+
        os.map((o,i)=>'<tr><td><b>'+esc(o.nombre)+'</b></td>'+
          '<td>'+esc(o.municipio||'')+(o.comuna?' &middot; '+esc(o.comuna):'')+'</td>'+
          '<td><span class="badge '+(o.regimen==='PMA'?'ok':'off')+'">'+esc(o.regimen||'')+(o.regimen==='PMA'&&o.meta_congelada!=null?' '+numEs(o.meta_congelada)+'%':'')+'</span></td>'+
          '<td class="mono">'+(o.forma_pago==='credito'?'Credito':'Anticipado')+'</td>'+
          '<td class="mono">'+(o.numero_generador?esc(o.numero_generador):'<span style="color:#B45309">en tramite</span>')+'</td>'+
          '<td><div class="rowbtns">'+
            (pEditar?'<button class="btn ghost sm" data-eobra="'+i+'">Editar</button>':'')+
            (pEliminar?'<button class="btn ghost sm" data-aobra="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Este cliente aun no tiene obras.</div>');
    if(pCrear) cont.querySelector('#bNuevaObra').onclick=()=>formObra(c,null,cont);
    cont.querySelectorAll('[data-eobra]').forEach(b=>{const i=+b.dataset.eobra; b.onclick=()=>formObra(c,os[i],cont);});
    cont.querySelectorAll('[data-aobra]').forEach(b=>{const i=+b.dataset.aobra; b.onclick=()=>anularObra(c,os[i]);});
  }

  async function formObra(c, o, cont){
    const nuevo=!o;
    // cargar municipios para el selector
    let muns=[]; try{ const r=await ctx.rpc('rcd_municipios_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) muns=r; }catch(e){}
    cont.innerHTML=
      '<b>'+(nuevo?'Nueva obra':'Editar obra')+'</b>'+
      '<div class="field" style="margin-top:8px"><label>Nombre / proyecto</label><input id="o_nombre" value="'+(nuevo?'':esc(o.nombre))+'"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Municipio</label><select id="o_mun">'+
          '<option value="">Selecciona...</option>'+
          muns.map(m=>'<option value="'+m.id+'"'+(!nuevo&&o.municipio_id===m.id?' selected':'')+'>'+esc(m.nombre)+'</option>').join('')+
        '</select></div>'+
        '<div class="field"><label>Zona</label><select id="o_com"><option value="">Selecciona municipio primero</option></select></div>'+
      '</div>'+
      '<div class="field"><label>Direccion de generacion</label><input id="o_dir" value="'+(nuevo?'':esc(o.direccion||''))+'"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Area (m2)</label><input id="o_area" value="'+(nuevo?'':numEs(o.area_m2))+'"></div>'+
        '<div class="field"><label>Regimen (automatico)</label><input id="o_reg" value="" readonly></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Forma de pago</label><select id="o_pago">'+
          '<option value="credito"'+(!nuevo&&o.forma_pago==='credito'?' selected':'')+'>Credito</option>'+
          '<option value="anticipado"'+(!nuevo&&o.forma_pago==='anticipado'?' selected':'')+'>Anticipado / cupo</option>'+
        '</select></div>'+
        '<div class="field"><label>N.º generador (opcional)</label><input id="o_numgen" value="'+(nuevo?'':esc(o.numero_generador||''))+'" placeholder="en tramite"></div>'+
      '</div>'+
      '<div class="field"><label>Total a disponer (t)</label><input id="o_total" class="cellnum" style="width:160px" value="'+(nuevo?'':numEs(o.total_declarado_t))+'"><div class="note">Total de toneladas declaradas para esta obra. Las solicitudes se vigilan contra este total.</div></div>'+
      '<div class="note" id="o_metanote" style="display:none"></div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bC">Cancelar</button><button class="btn primary" id="bS">Guardar</button></div>';

    const selMun=cont.querySelector('#o_mun'), selCom=cont.querySelector('#o_com');
    const inpArea=cont.querySelector('#o_area'), inpReg=cont.querySelector('#o_reg'), metaNote=cont.querySelector('#o_metanote');

    async function cargarComunas(preselect){
      const mid=selMun.value;
      if(!mid){ selCom.innerHTML='<option value="">Selecciona municipio primero</option>'; return; }
      let coms=[]; try{ const r=await ctx.rpc('rcd_comunas_lista',{p_municipio_id:mid}); if(Array.isArray(r)) coms=r; }catch(e){}
      selCom.innerHTML='<option value="">Sin zona</option>'+coms.map(cc=>'<option value="'+cc.id+'"'+(preselect&&preselect===cc.id?' selected':'')+'>'+esc(cc.nombre)+'</option>').join('');
    }
    function recalcRegimen(){
      const area=parseNum(inpArea.value);
      const reg = area>=2000 ? 'PMA' : 'Cupo';
      inpReg.value = reg + (area>0?' (area '+numEs(area)+' m2)':'');
      if(reg==='PMA'){ metaNote.style.display='block'; metaNote.textContent='Obra PMA: al guardar se congela la meta vigente del municipio.'; }
      else { metaNote.style.display='none'; }
    }
    selMun.onchange=()=>cargarComunas(null);
    inpArea.oninput=recalcRegimen;
    if(!nuevo){ await cargarComunas(o.comuna_id); }
    recalcRegimen();

    cont.querySelector('#bC').onclick=()=>obras(c);
    cont.querySelector('#bS').onclick=async function(){
      const btn=this, nombre=v(cont,'o_nombre');
      if(!nombre){ ctx.toast('Escribe el nombre de la obra.','error'); return; }
      if(!selMun.value){ ctx.toast('Selecciona el municipio.','error'); return; }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_obra_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:nuevo?null:o.id, p_cliente_id:c.id,
          p_nombre:nombre, p_municipio_id:selMun.value, p_comuna_id:selCom.value||null, p_direccion:v(cont,'o_dir'),
          p_area:parseNum(v(cont,'o_area')), p_forma_pago:cont.querySelector('#o_pago').value, p_numero_generador:v(cont,'o_numgen'),
          p_total_declarado:parseNum(v(cont,'o_total'))}));
        if(r==='OK'){ ctx.toast('Obra guardada'); obras(c); return; }
        ctx.toast(r==='MUNICIPIO_VACIO'?'Selecciona el municipio.':(r==='FORMA_PAGO_INVALIDA'?'Elige la forma de pago.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.')),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularObra(c, o){
    if(!(await ctx.confirm('Anular la obra "'+o.nombre+'"? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_obra_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:o.id}));
      if(r==='OK'){ ctx.toast('Obra anulada'); obras(c); return; }
      ctx.toast(r==='TIENE_MOVIMIENTOS'?'No se puede anular: la obra tiene movimientos.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.'),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===== Terceros (clasificacion desde TNS) =====
async function terceros(body, ctx){
  const puedeEditar = ctx.can('parametros','editar');
  let DATA=[], fSearch='', fFiltro='todos', syncTxt='';

  body.innerHTML = '<div class="loading">Trayendo terceros de TNS...</div>';

  let tns=null;
  try{
    tns = await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({accion:'traer_clientes',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,filtro:'',traer_todos:true})}).then(x=>x.json());
  }catch(e){ tns={ok:false,error:'NO_CONECTA'}; }

  if(!(tns&&tns.ok)){
    const msg = (tns&&tns.error==='SIN_CREDENCIALES')
      ? 'Primero conecta TNS (en Facturacion / Configuracion).'
      : ('No se pudo traer de TNS: '+((tns&&tns.error)||'sin conexion')+'.');
    body.innerHTML = '<h3 style="margin-top:0">Clasificacion de terceros</h3><div class="note warn">'+esc(msg)+'</div>';
    return;
  }

  const lista = tns.clientes||[];
  let saved=[];
  try{ const s=await ctx.rpc('rcd_terceros_clasif_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(s)) saved=s; }catch(e){}
  const map={}; saved.forEach(s=>{ if(s.cod_tercero) map[s.cod_tercero]=s; });

  DATA = lista.map(t=>{
    const key=(t.codigo||t.nit||'');
    const c=map[key]||{};
    return { key:key, codigo:t.codigo||'', nit:t.nit||'', nombre:t.nombre||'(sin nombre)',
      naturaleza:t.natJuridica||'', ciudad:t.nombreCiudad||'', telefono:t.telefono||'',
      es_cliente:!!c.es_cliente, es_transporte:!!c.es_transporte, es_maquila:!!c.es_maquila };
  }).filter(d=>d.key);

  const now=new Date();
  syncTxt='TNS sincronizado · '+now.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});

  render();

  function render(){
    body.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">'+
        '<div><h3 style="margin:0">Clasificacion de terceros</h3>'+
        '<p class="lead" style="margin:4px 0 0">Los terceros se crean en TNS. Marca como se usa cada uno en la app.</p></div>'+
        '<span style="display:inline-flex;align-items:center;gap:7px;background:#E6F4EA;color:#15803D;font-size:12px;padding:6px 11px;border-radius:8px"><span style="width:8px;height:8px;border-radius:50%;background:#15803D"></span>'+esc(syncTxt)+'</span>'+
      '</div>'+
      '<div style="font-size:11.5px;color:#6E7A77;margin:8px 0 12px"><b style="color:#15803D">Cliente</b> &rarr; Cotizaciones &nbsp;&middot;&nbsp; <b style="color:#15803D">Transporte</b> &rarr; Volqueteros &nbsp;&middot;&nbsp; <b style="color:#15803D">Maquila</b> &rarr; Aliados &nbsp;&middot;&nbsp; transporte y maquila comparten portal de proveedor</div>'+
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">'+
        '<input id="tSearch" placeholder="Buscar por nombre o NIT..." style="flex:1;min-width:180px">'+
        '<select id="tFiltro" style="width:auto">'+
          '<option value="todos">Todos</option>'+
          '<option value="sin">Sin clasificar</option>'+
          '<option value="cliente">Clientes</option>'+
          '<option value="transporte">Transporte</option>'+
          '<option value="maquila">Maquila</option>'+
        '</select>'+
        '<span id="tCount" style="font-size:12px;color:#6E7A77;white-space:nowrap"></span>'+
      '</div>'+
      '<div id="tRows"></div>'+
      '<div class="note" style="margin-top:10px">Se guarda solo. Destildar oculta pero conserva el historial. El alta en Volqueteros/Cotizaciones/Aliados se activa en la siguiente fase.</div>';
    body.querySelector('#tSearch').oninput=function(){ fSearch=this.value; renderRows(); };
    body.querySelector('#tFiltro').onchange=function(){ fFiltro=this.value; renderRows(); };
    renderRows();
  }

  function pasa(d){
    if(fFiltro==='sin' && (d.es_cliente||d.es_transporte||d.es_maquila)) return false;
    if(fFiltro==='cliente' && !d.es_cliente) return false;
    if(fFiltro==='transporte' && !d.es_transporte) return false;
    if(fFiltro==='maquila' && !d.es_maquila) return false;
    if(fSearch){
      const q=fSearch.toLowerCase().replace(/\./g,'');
      const hay=((d.nombre||'')+' '+(d.nit||'')).toLowerCase().replace(/\./g,'');
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  }

  function chip(label,k,key,on){
    const st = on ? 'background:#15803D;border:1px solid #15803D;color:#fff'
                  : 'background:#fff;border:1px solid var(--line,#E0E0DA);color:var(--muted,#6E7A77)';
    return '<button data-chip="'+k+'" data-key="'+esc(key)+'" style="font-size:12px;padding:5px 11px;border-radius:999px;cursor:'+(puedeEditar?'pointer':'default')+';'+st+'">'+label+'</button>';
  }

  function fila(d){
    const eff=[];
    if(d.es_cliente) eff.push('Cotizaciones + acceso cliente (NIT, 0000)');
    if(d.es_transporte) eff.push('Volqueteros + acceso proveedor (doc, 0000)');
    if(d.es_maquila) eff.push('Aliados + acceso proveedor (doc, 0000)');
    return '<div style="background:#fff;border:1px solid var(--line,#E0E0DA);border-radius:8px;padding:11px 13px;margin-bottom:8px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">'+
          '<div style="min-width:0"><b>'+esc(d.nombre)+'</b><br>'+
            '<span class="mono" style="font-size:12px;color:#6E7A77">'+esc(d.nit?('NIT '+d.nit):'sin NIT')+'</span>'+
            (d.naturaleza?' <span style="font-size:12px;color:#6E7A77">&middot; '+esc(d.naturaleza)+'</span>':'')+
            (d.ciudad?' <span style="font-size:12px;color:#6E7A77">&middot; '+esc(d.ciudad)+'</span>':'')+
          '</div>'+
          '<div style="display:flex;gap:6px">'+chip('Cliente','cliente',d.key,d.es_cliente)+chip('Transporte','transporte',d.key,d.es_transporte)+chip('Maquila','maquila',d.key,d.es_maquila)+'</div>'+
        '</div>'+
        (eff.length?'<div style="font-size:11.5px;color:#6E7A77;margin-top:8px">&rarr; '+esc(eff.join('   &middot;   '))+'</div>':'')+
      '</div>';
  }

  function renderRows(){
    const cont=body.querySelector('#tRows');
    const done=DATA.filter(d=>d.es_cliente||d.es_transporte||d.es_maquila).length;
    const cEl=body.querySelector('#tCount'); if(cEl) cEl.textContent=DATA.length+' terceros · '+done+' clasificados';
    const vis=DATA.filter(pasa);
    if(!vis.length){ cont.innerHTML='<div class="empty">Sin resultados.</div>'; return; }
    cont.innerHTML=vis.map(fila).join('');
    cont.querySelectorAll('[data-chip]').forEach(b=>{ b.onclick=()=>toggle(b.dataset.key,b.dataset.chip); });
  }

  async function toggle(key,k){
    if(!puedeEditar){ ctx.toast('No tienes permiso para clasificar.','error'); return; }
    const d=DATA.find(x=>x.key===key); if(!d) return;
    const field = k==='cliente'?'es_cliente':(k==='transporte'?'es_transporte':'es_maquila');
    d[field]=!d[field];
    try{
      const res=scalar(await ctx.rpc('rcd_tercero_clasif_guardar',{
        p_gestor_id:ctx.ses.gestor_id, p_usuario_id:ctx.ses.id,
        p_cod_tercero:d.key, p_nit:d.nit, p_nombre:d.nombre, p_naturaleza:d.naturaleza,
        p_ciudad:d.ciudad, p_telefono:d.telefono,
        p_es_cliente:d.es_cliente, p_es_transporte:d.es_transporte, p_es_maquila:d.es_maquila
      }));
      if(res!=='OK'){ d[field]=!d[field]; ctx.toast(res==='SIN_COD'?'Tercero sin codigo TNS.':'No se pudo guardar.','error'); }
      else { ctx.toast('Clasificacion guardada.'); if(ctx.log) ctx.log('Clientes','Clasificar tercero', d.nombre+' ['+(d.es_cliente?'C':'')+(d.es_transporte?'T':'')+(d.es_maquila?'M':'')+']'); }
    }catch(e){ d[field]=!d[field]; ctx.toast('Error de conexion al guardar.','error'); }
    renderRows();
  }
}


  lista();
};
