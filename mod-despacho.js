// ============================================================
// RCD PRO · Modulo Despacho (autonomo: Solicitudes despacho -> Ordenes -> Despachar -> Historial)
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.despacho = function(el, ctx){
  const pCrear=ctx.can('despacho','escribir'), pEditar=ctx.can('despacho','editar'), pEliminar=ctx.can('despacho','eliminar');
  const hf={ desde:'', hasta:'', cliente:'', estado:'' };

  // ---------- badges / mensajes ----------
  function badgeEstadoSol(e){
    if(e==='aprobada') return '<span class="badge ok">Aprobada</span>';
    if(e==='pendiente') return '<span class="badge warn">Pendiente</span>';
    if(e==='rechazada') return '<span class="badge danger">Rechazada</span>';
    if(e==='cerrada') return '<span class="badge off">Cerrada</span>';
    return '<span class="badge off">'+esc(e||'')+'</span>';
  }
  function badgeOrigen(o){ return o==='cliente' ? '<span class="badge warn">Cliente</span>' : '<span class="badge off">Operador</span>'; }
  function badgeOrden(e){
    if(e==='pendiente') return '<span class="badge off">Pendiente</span>';
    if(e==='ofertada') return '<span class="badge warn">Ofertada</span>';
    if(e==='asignada') return '<span class="badge ok">Asignada</span>';
    if(e==='en_ruta') return '<span class="badge warn">En ruta</span>';
    if(e==='completada') return '<span class="badge ok">Completada</span>';
    if(e==='reemplazada') return '<span class="badge off">Dividida en 2</span>';
    return '<span class="badge off">'+esc(e||'')+'</span>';
  }
  function msgOrden(r){
    return ({SIN_PERMISO:'No tienes permiso.', SOL_NO_APROBADA:'La solicitud no esta aprobada.',
      SIN_TAMANO:'Define el tamano requerido en la solicitud (editala).',
      YA_GENERADAS:'Las ordenes ya fueron generadas para esta solicitud.',
      CAPACIDAD_INVALIDA:'El tamano no tiene una capacidad valida.',
      ORDENES_EN_PROGRESO:'Hay ordenes ya asignadas o en ruta; no se pueden regenerar. Anula o completa esas primero.',
      VEHICULO_VACIO:'Selecciona un vehiculo.', VEHICULO_INVALIDO:'Vehiculo invalido.',
      VEHICULO_INACTIVO:'El vehiculo esta inactivo.', DOCS_VENCIDOS:'El vehiculo tiene SOAT o tecnomecanica vencida.',
      VEHICULO_OCUPADO:'El vehiculo ya tiene una orden asignada (ocupado).',
      TAMANO_NO_COINCIDE:'El vehiculo no es del tamano de la orden. Usa "Partir" si quieres pasar a otro tamano.',
      ORDEN_NO_ASIGNABLE:'Esa orden ya no se puede asignar.', ORDEN_NO_OFERTABLE:'Solo se ofertan ordenes pendientes.',
      ORDEN_NO_PARTIBLE:'Solo se parten ordenes pendientes u ofertadas (sin vehiculo).',
      SIN_TAMANO_MITAD:'No existe un tamano que sea la mitad; no se puede partir.',
      ORDEN_NO_LIBERABLE:'Esa orden no se puede liberar (solo ofertadas o asignadas).'})[r] || 'No se pudo completar la accion.';
  }
  function msgDesp(r){
    if(typeof r==='string' && r.indexOf('SIN_STOCK_PROD')===0) return 'No hay suficiente producto disponible en esa ubicacion.';
    return ({SIN_PERMISO:'No tienes permiso.', SIN_ORDEN:'Selecciona la orden.', SIN_CLIENTE:'Selecciona el cliente.',
      SIN_PRODUCTO:'Selecciona el producto.', SIN_BRUTO:'Falta el peso bruto.', NETO_INVALIDO:'El neto debe ser mayor a cero.',
      NO_PENDIENTE:'Este despacho ya no esta esperando tara.'})[r] || 'No se pudo completar la accion.';
  }

  // ---------- tabbar ----------
  function tabbar(activa){
    return '<div class="tabbar">'+
      '<button class="tab'+(activa==='sol'?' active':'')+'" data-t="sol">Solicitudes</button>'+
      '<button class="tab'+(activa==='des'?' active':'')+'" data-t="des">Despachar</button>'+
      '<button class="tab'+(activa==='his'?' active':'')+'" data-t="his">Historial</button>'+
      '</div>';
  }
  function wireTabs(){
    el.querySelectorAll('.tab[data-t]').forEach(function(b){
      b.onclick=function(){ const t=b.dataset.t; if(t==='sol') listaSol(); else if(t==='des') despachar(); else historial(); };
    });
  }

  // ===================== SOLICITUDES (tipo despacho) =====================
  async function listaSol(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let ss=[]; try{ const r=await ctx.rpc('rcd_solicitudes_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) ss=r.filter(x=>x.tipo==='despacho'); }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:1000px">'+
      tabbar('sol')+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
        '<h3 style="margin:0">Solicitudes de despacho</h3>'+
        (pCrear?'<button class="btn primary sm" id="bNueva">+ Nueva solicitud</button>':'')+
      '</div>'+
      '<p class="lead" style="margin:6px 0 12px">Sobre obras con cotizacion aceptada. Las de origen Cliente llegan pendientes y debes aprobarlas.</p>'+
      (ss.length?
        '<table class="mtable"><tr><th>N.º</th><th>Cliente / obra</th><th>Producto</th><th style="text-align:right">Declarado (t)</th><th>Fecha</th><th>Origen</th><th>Estado</th><th></th></tr>'+
        ss.map((s,i)=>'<tr><td class="mono"><b>'+esc(s.numero||'')+'</b></td>'+
          '<td>'+esc(s.cliente||'')+'<br><span style="font-size:12px;color:var(--muted)">'+esc(s.obra||'')+'</span></td>'+
          '<td>'+esc(s.producto||'')+'</td>'+
          '<td style="text-align:right" class="mono">'+numEs(s.cantidad_declarada)+'</td>'+
          '<td class="mono">'+esc(s.fecha||'')+'</td>'+
          '<td>'+badgeOrigen(s.origen)+'</td>'+
          '<td>'+badgeEstadoSol(s.estado)+'</td>'+
          '<td><div class="rowbtns">'+
          (s.estado==='pendiente'&&pEditar?'<button class="btn ghost sm" data-aprob="'+i+'">Aprobar</button><button class="btn ghost sm" data-rech="'+i+'">Rechazar</button>':'')+
          (s.estado==='aprobada'?'<button class="btn ghost sm" data-ord="'+i+'">Ordenes</button>':'')+
          (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay solicitudes de despacho.</div>')+
      '</div>';
    wireTabs();
    if(pCrear){ const b=el.querySelector('#bNueva'); if(b) b.onclick=()=>formSol(null,ss); }
    el.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>formSol(ss[i],ss);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anularSol(ss[i]);});
    el.querySelectorAll('[data-aprob]').forEach(b=>{const i=+b.dataset.aprob; b.onclick=()=>cambiarEstado(ss[i],'aprobada');});
    el.querySelectorAll('[data-rech]').forEach(b=>{const i=+b.dataset.rech; b.onclick=()=>cambiarEstado(ss[i],'rechazada');});
    el.querySelectorAll('[data-ord]').forEach(b=>{const i=+b.dataset.ord; b.onclick=()=>ordenes(ss[i]);});
  }

  async function cambiarEstado(s, estado){
    const m = estado==='aprobada' ? 'Aprobar la solicitud '+(s.numero||'')+'? Podra convertirse en ordenes.' : 'Rechazar la solicitud '+(s.numero||'')+'?';
    if(!(await ctx.confirm(m))) return;
    try{ const r=scalar(await ctx.rpc('rcd_solicitud_estado',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:s.id,p_estado:estado}));
      if(r==='OK'){ ctx.toast(estado==='aprobada'?'Solicitud aprobada':'Solicitud rechazada'); listaSol(); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo cambiar el estado.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  async function formSol(s, ss){
    const nuevo=!s;
    let obras=[]; try{ const r=await ctx.rpc('rcd_obras_cotizadas',{p_gestor_id:ctx.ses.gestor_id}); obras=Array.isArray(r)?r:[]; }catch(e){}
    let productos=[]; try{ const r=await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); productos=(Array.isArray(r)?r:[]).filter(p=>p.activo); }catch(e){}
    let tams=[]; try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); tams=(Array.isArray(r)?r:[]).filter(t=>t.activa); }catch(e){}
    const obraIdActual = nuevo ? '' : (s.obra_id||'');
    el.innerHTML=
      '<div class="mcard" style="max-width:720px">'+
      '<button class="btn ghost sm" id="bBack">&larr; Solicitudes</button>'+
      '<h3 style="margin:12px 0 6px">'+(nuevo?'Nueva solicitud de despacho':'Editar solicitud '+esc(s.numero||''))+'</h3>'+
      '<div class="field"><label>Obra (con cotizacion aceptada)</label><select id="s_obra"><option value="">Selecciona...</option>'+
        obras.map(o=>'<option value="'+o.id+'"'+(obraIdActual===o.id?' selected':'')+'>'+esc(o.cliente||'')+' - '+esc(o.nombre)+'</option>').join('')+'</select></div>'+
      '<div class="note" id="s_resumen" style="display:none"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Producto</label><select id="s_prod"><option value="">Selecciona...</option>'+
          productos.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('')+'</select></div>'+
        '<div class="field"><label>Fecha</label><input type="date" id="s_fecha" value="'+(nuevo?'':esc(s.fecha||''))+'"></div>'+
      '</div>'+
      '<div class="field"><label>Cantidad declarada (t)</label><input id="s_cant" class="cellnum" style="width:160px" value="'+(nuevo?'':numEs(s.cantidad_declarada))+'"></div>'+
      '<div class="field"><label>Transporte</label><select id="s_transp">'+
        '<option value="nosotros"'+(nuevo||s.transporte!=='cliente'?' selected':'')+'>Nosotros transportamos (cobra transporte)</option>'+
        '<option value="cliente"'+(!nuevo&&s.transporte==='cliente'?' selected':'')+'>Cliente envia sus volquetas (sin cobro de transporte)</option>'+
      '</select><div class="note">Si el cliente envia sus volquetas, se generan ordenes igual pero no se cobra transporte ni se paga volquetero.</div></div>'+
      '<div class="field"><label>Tamano requerido (opcional)</label><select id="s_tam"><option value="">Cualquiera</option>'+
        tams.map(t=>'<option value="'+t.id+'"'+(!nuevo&&s.tamano_id===t.id?' selected':'')+'>'+esc(t.nombre)+'</option>').join('')+
      '</select><div class="note">Si lo defines, las ordenes solo aceptaran vehiculos de ese tamano (salvo excepcion).</div></div>'+
      '<div class="field"><label>Observaciones</label><input id="s_obs" value="'+(nuevo?'':esc(s.observaciones||''))+'"></div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>'+
      '</div>';
    const selObra=el.querySelector('#s_obra'), selProd=el.querySelector('#s_prod'), inpCant=el.querySelector('#s_cant'), resumen=el.querySelector('#s_resumen');
    if(!nuevo && s.producto_id) selProd.value=s.producto_id;
    function pintarResumen(){
      const o=obras.filter(x=>x.id===selObra.value)[0];
      if(!o){ resumen.style.display='none'; return; }
      const total=+o.total_declarado_t||0, yaSol=+o.solicitado||0;
      const propia=(!nuevo && s.obra_id===o.id)?(+s.cantidad_declarada||0):0;
      const base=yaSol-propia, disp=total-base, nueva=parseNum(inpCant.value);
      resumen.style.display='block';
      let txt='Total a disponer: '+numEs(total)+' t · Ya solicitado: '+numEs(base)+' t · Disponible: '+numEs(disp)+' t';
      if(nueva>disp && total>0){ txt+=' — ATENCION: supera lo disponible.'; resumen.className='note warn'; } else resumen.className='note';
      resumen.textContent=txt;
    }
    selObra.onchange=pintarResumen; inpCant.oninput=pintarResumen; pintarResumen();
    el.querySelector('#bBack').onclick=listaSol;
    el.querySelector('#bCancel').onclick=listaSol;
    el.querySelector('#bSave').onclick=async function(){
      const btn=this;
      if(!selObra.value){ ctx.toast('Selecciona la obra.','error'); return; }
      if(!selProd.value){ ctx.toast('Selecciona el producto.','error'); return; }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_solicitud_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:nuevo?null:s.id,
          p_obra_id:selObra.value, p_tipo:'despacho', p_producto_id:selProd.value,
          p_cantidad:parseNum(inpCant.value), p_fecha:v(el,'s_fecha')||null, p_observaciones:v(el,'s_obs'),
          p_tamano_id:el.querySelector('#s_tam').value||null,
          p_transporte:el.querySelector('#s_transp').value||'nosotros'}));
        if(r==='OK'){ ctx.toast('Solicitud guardada'); listaSol(); return; }
        ctx.toast(r==='SALDO_AGOTADO'?'Obra bloqueada: el anticipo se agoto. Registra un abono o pide al administrador desbloquear en Facturacion.':(r==='OBRA_NO_COTIZADA'?'Esa obra no tiene cotizacion aceptada.':(r==='PRODUCTO_VACIO'?'Selecciona el producto.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.'))),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularSol(s){
    if(!(await ctx.confirm('Anular la solicitud '+(s.numero||'')+'? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_solicitud_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:s.id}));
      if(r==='OK'){ ctx.toast('Solicitud anulada'); listaSol(); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===================== ORDENES (drill-down de una solicitud) =====================
  function accionesOrden(o,i,s){
    let h=''; const esCli=(s&&s.transporte==='cliente');
    if(o.estado==='pendiente' && pEditar){
      h+='<button class="btn ghost sm" data-oasg="'+i+'">Asignar</button>';
      if(!esCli) h+='<button class="btn ghost sm" data-oofe="'+i+'">Ofertar</button><button class="btn ghost sm" data-opar="'+i+'">Partir</button>';
    }
    if(o.estado==='ofertada' && pEditar) h+='<button class="btn ghost sm" data-oasg="'+i+'">Asignar</button><button class="btn ghost sm" data-olib="'+i+'">Liberar</button>';
    if(o.estado==='asignada' && pEditar) h+='<button class="btn ghost sm" data-oruta="'+i+'">En ruta</button><button class="btn ghost sm" data-olib="'+i+'">Liberar</button>';
    if(o.estado==='en_ruta' && pEditar) h+='<button class="btn ghost sm" data-ocomp="'+i+'">Completar</button>';
    if(['pendiente','ofertada','asignada'].indexOf(o.estado)>=0 && pEliminar) h+='<button class="btn ghost sm" data-oanu="'+i+'">Anular</button>';
    return h || '<span class="mono" style="color:#C9C9C1;font-size:11px">-</span>';
  }
  async function ordenes(s){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let os=[]; try{ const r=await ctx.rpc('rcd_ordenes_lista',{p_solicitud_id:s.id}); os=Array.isArray(r)?r:[]; }catch(e){}
    let tams=[]; try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); tams=Array.isArray(r)?r:[]; }catch(e){}
    const sinTam=!s.tamano_id, tReq=tams.filter(t=>t.id===s.tamano_id)[0], cap=tReq?(Number(tReq.capacidad_t)||0):0;
    const qty=Number(s.cantidad_declarada)||0, est=cap>0?Math.ceil(qty/cap):null, nReales=os.filter(o=>o.estado!=='reemplazada').length;
    el.innerHTML=
      '<div class="mcard" style="max-width:940px">'+
      '<button class="btn ghost sm" id="bBackL">&larr; Solicitudes</button>'+
      '<h3 style="margin:12px 0 2px">Ordenes de '+esc(s.numero||'')+'</h3>'+
      '<p class="lead">'+esc(s.cliente||'')+' - '+esc(s.obra||'')+' · Despacho · '+esc(s.producto||'')+'</p>'+
      '<div class="note" style="background:#F0FAF8;border-color:#9FD8CE">Declarado: <b>'+numEs(qty)+' t</b>'+
        (cap>0?' · Capacidad por viaje ('+esc(s.tamano||'')+'): <b>'+numEs(cap)+' t</b> · Viajes a generar: <b>'+est+'</b>':' · define el tamano requerido para calcular los viajes')+
        ' · Ordenes actuales: <b>'+nReales+'</b></div>'+
      (pCrear?'<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'+
        '<button class="btn primary sm" id="bGen"'+(sinTam?' disabled':'')+'>'+(os.length?'Regenerar ordenes':'Generar ordenes')+'</button>'+
        '<button class="btn ghost sm" id="bAdd">+ Orden suelta</button></div>':'')+
      (sinTam?'<div class="note warn">Para generar ordenes automaticas, edita la solicitud y define un tamano requerido.</div>':'')+
      (os.length?
        '<table class="mtable"><tr><th>N.º</th><th>Tamano</th><th>Vehiculo</th><th>Volquetero</th><th>Estado</th><th></th></tr>'+
        os.map(function(o,i){ return '<tr><td class="mono"><b>'+esc(o.numero||'')+'</b>'+(o.reemplaza_numero?'<br><span style="font-size:10px;color:var(--muted)">de '+esc(o.reemplaza_numero)+'</span>':'')+'</td>'+
          '<td>'+esc(o.tamano||'')+'</td>'+
          '<td class="mono">'+(o.placa?esc(o.placa):'<span style="color:var(--muted)">-</span>')+'</td>'+
          '<td>'+esc(o.volquetero||'')+'</td>'+
          '<td>'+badgeOrden(o.estado)+'</td>'+
          '<td><div class="rowbtns">'+accionesOrden(o,i,s)+'</div></td></tr>'; }).join('')+'</table>'
        : '<div class="empty">Sin ordenes. Usa "Generar ordenes".</div>')+
      '<div class="note">Cada orden es un viaje. Las asignadas/en ruta se completan al despachar (pestana Despachar).</div>'+
      '</div>';
    el.querySelector('#bBackL').onclick=listaSol;
    if(pCrear){
      const g=el.querySelector('#bGen'); if(g && !sinTam) g.onclick=()=>generar(s, os.length>0);
      const a=el.querySelector('#bAdd'); if(a) a.onclick=()=>agregarOrden(s);
    }
    os.forEach(function(o,i){
      const asg=el.querySelector('[data-oasg="'+i+'"]'); if(asg) asg.onclick=()=>formAsignar(s,o);
      const ofe=el.querySelector('[data-oofe="'+i+'"]'); if(ofe) ofe.onclick=()=>ordenOfertar(s,o);
      const par=el.querySelector('[data-opar="'+i+'"]'); if(par) par.onclick=()=>ordenPartir(s,o);
      const lib=el.querySelector('[data-olib="'+i+'"]'); if(lib) lib.onclick=()=>ordenLiberar(s,o);
      const ruta=el.querySelector('[data-oruta="'+i+'"]'); if(ruta) ruta.onclick=()=>ordenEstado(s,o,'en_ruta');
      const comp=el.querySelector('[data-ocomp="'+i+'"]'); if(comp) comp.onclick=()=>ordenEstado(s,o,'completada');
      const anu=el.querySelector('[data-oanu="'+i+'"]'); if(anu) anu.onclick=()=>ordenAnular(s,o);
    });
  }
  async function generar(s, regen){
    const m = regen ? 'Regenerar las ordenes de '+(s.numero||'')+'? Se reemplazan las pendientes/ofertadas (no toca asignadas o en ruta).'
                    : 'Generar las ordenes de '+(s.numero||'')+' segun la cantidad y el tamano requerido?';
    if(!(await ctx.confirm(m))) return;
    try{ const r=scalar(await ctx.rpc('rcd_solicitud_generar_ordenes',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_solicitud_id:s.id}));
      if(r && !isNaN(+r)){ ctx.toast('Se generaron '+r+' ordenes'); ordenes(s); return; }
      ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }
  async function agregarOrden(s){
    let tams=[]; try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); tams=(Array.isArray(r)?r:[]).filter(t=>t.activa); }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:520px">'+
      '<button class="btn ghost sm" id="bBackAg">&larr; Ordenes</button>'+
      '<h3 style="margin:12px 0 6px">Orden suelta · '+esc(s.numero||'')+'</h3>'+
      '<div class="field"><label>Tamano del viaje</label><select id="ag_tam"><option value="">Selecciona...</option>'+
        tams.map(t=>'<option value="'+t.id+'">'+esc(t.nombre)+'</option>').join('')+'</select></div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancelAg">Cancelar</button><button class="btn primary" id="bSaveAg">Crear orden</button></div>'+
      '</div>';
    el.querySelector('#bBackAg').onclick=()=>ordenes(s);
    el.querySelector('#bCancelAg').onclick=()=>ordenes(s);
    el.querySelector('#bSaveAg').onclick=async function(){
      const btn=this, tam=el.querySelector('#ag_tam').value;
      if(!tam){ ctx.toast('Selecciona el tamano.','error'); return; }
      btn.disabled=true; btn.textContent='Creando...';
      try{ const r=scalar(await ctx.rpc('rcd_orden_agregar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_solicitud_id:s.id,p_tamano_id:tam}));
        if(r==='OK'){ ctx.toast('Orden agregada'); ordenes(s); return; }
        ctx.toast(msgOrden(r),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Crear orden';
    };
  }
  async function formAsignar(s,o){
    let elig=[]; try{ const r=await ctx.rpc('rcd_vehiculos_elegibles',{p_gestor_id:ctx.ses.gestor_id}); elig=Array.isArray(r)?r:[]; }catch(e){}
    const arr=elig.filter(vh=>vh.tamano_id===o.tamano_id);
    el.innerHTML=
      '<div class="mcard" style="max-width:560px">'+
      '<button class="btn ghost sm" id="bBackAs">&larr; Ordenes</button>'+
      '<h3 style="margin:12px 0 6px">Asignar · '+esc(o.numero||'')+' ('+esc(o.tamano||'')+')</h3>'+
      '<div class="field"><label>Vehiculo elegible de '+esc(o.tamano||'')+'</label><select id="as_veh"><option value="">Selecciona...</option>'+
        arr.map(vh=>'<option value="'+vh.vehiculo_id+'">'+esc(vh.placa)+' · '+esc(vh.volquetero||'')+'</option>').join('')+'</select>'+
        (arr.length?'':'<div class="note warn">No hay vehiculos elegibles de ese tamano. Usa "Partir" para pasar a un tamano menor.</div>')+'</div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancelAs">Cancelar</button><button class="btn primary" id="bSaveAs">Asignar</button></div>'+
      '</div>';
    el.querySelector('#bBackAs').onclick=()=>ordenes(s);
    el.querySelector('#bCancelAs').onclick=()=>ordenes(s);
    el.querySelector('#bSaveAs').onclick=async function(){
      const btn=this, veh=el.querySelector('#as_veh').value;
      if(!veh){ ctx.toast('Selecciona un vehiculo.','error'); return; }
      btn.disabled=true; btn.textContent='Asignando...';
      try{ const r=scalar(await ctx.rpc('rcd_orden_asignar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id,p_vehiculo_id:veh}));
        if(r==='OK'){ ctx.toast('Vehiculo asignado'); ordenes(s); return; }
        ctx.toast(msgOrden(r),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Asignar';
    };
  }
  async function ordenOfertar(s,o){
    try{ const r=scalar(await ctx.rpc('rcd_orden_ofertar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id}));
      if(r==='OK'){ ctx.toast('Orden ofertada'); ordenes(s); return; } ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }
  async function ordenPartir(s,o){
    if(!(await ctx.confirm('Partir la orden '+(o.numero||'')+' ('+(o.tamano||'')+') en 2 viajes de la mitad? Quedara la trazabilidad.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_orden_partir',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id}));
      if(r==='OK'){ ctx.toast('Orden partida en 2'); ordenes(s); return; } ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }
  async function ordenLiberar(s,o){
    if(!(await ctx.confirm('Liberar la orden '+(o.numero||'')+'? Vuelve a Pendiente y deja libre el vehiculo.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_orden_liberar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id}));
      if(r==='OK'){ ctx.toast('Orden liberada'); ordenes(s); return; } ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }
  async function ordenEstado(s,o,estado){
    try{ const r=scalar(await ctx.rpc('rcd_orden_estado',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id,p_estado:estado}));
      if(r==='OK'){ ctx.toast(estado==='en_ruta'?'Orden en ruta':'Orden completada'); ordenes(s); return; } ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }
  async function ordenAnular(s,o){
    if(!(await ctx.confirm('Anular la orden '+(o.numero||'')+'?'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_orden_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id}));
      if(r==='OK'){ ctx.toast('Orden anulada'); ordenes(s); return; } ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===================== DESPACHAR =====================
  async function despachar(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let ords=[]; try{ const r=await ctx.rpc('rcd_ordenes_para_despacho',{p_gestor_id:ctx.ses.gestor_id}); ords=Array.isArray(r)?r:[]; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      tabbar('des')+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
        '<h3 style="margin:0">Despachar</h3>'+
        (pCrear?'<button class="btn primary sm" id="bDirecta">+ Venta directa</button>':'')+
      '</div>'+
      '<p class="lead" style="margin:6px 0 12px">Ordenes de despacho listas (asignadas / en ruta). Al despachar baja el inventario y se completa la orden.</p>'+
      (ords.length?
        '<table class="mtable"><tr><th>Orden</th><th>Cliente / obra</th><th>Producto</th><th>Vehiculo</th><th></th></tr>'+
        ords.map(function(o,i){ return '<tr><td class="mono"><b>'+esc((o.etiqueta||'').split(' · ')[0])+'</b></td>'+
          '<td>'+esc(o.cliente||'')+'<br><span style="font-size:12px;color:var(--muted)">'+esc(o.obra||'')+(o.regimen==='PMA'?' · <b style="color:var(--esc)">PMA</b>':'')+'</span></td>'+
          '<td>'+esc(o.producto||'')+'</td>'+
          '<td class="mono">'+esc(o.placa||'-')+'<br><span style="font-size:11px;color:var(--muted)">'+esc(o.volquetero||'')+'</span></td>'+
          '<td><div class="rowbtns">'+(pCrear?'<button class="btn primary sm" data-desp="'+i+'">Despachar</button>':'')+'</div></td></tr>'; }).join('')+'</table>'
        : '<div class="empty">No hay ordenes de despacho listas. Puedes hacer una venta directa.</div>')+
      '</div>';
    wireTabs();
    if(pCrear){ const b=el.querySelector('#bDirecta'); if(b) b.onclick=()=>formDespacho('directa',null); }
    ords.forEach(function(o,i){ const b=el.querySelector('[data-desp="'+i+'"]'); if(b) b.onclick=()=>formDespacho('orden',o); });
  }

  async function formDespacho(modo, od){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let ubics=[]; try{ const r=await ctx.rpc('rcd_ubicaciones_lista',{p_gestor_id:ctx.ses.gestor_id}); ubics=Array.isArray(r)?r:[]; }catch(e){}
    let clientes=[], productos=[], obrasPma=[];
    if(modo==='directa'){
      try{ const r=await ctx.rpc('rcd_clientes_lista',{p_gestor_id:ctx.ses.gestor_id}); clientes=(Array.isArray(r)?r:[]).filter(c=>c.activo!==false); }catch(e){}
      try{ const r=await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); productos=(Array.isArray(r)?r:[]).filter(p=>p.activo); }catch(e){}
      try{ const r=await ctx.rpc('rcd_obras_cotizadas',{p_gestor_id:ctx.ses.gestor_id}); obrasPma=Array.isArray(r)?r:[]; }catch(e){}
    }
    let ubic=(ubics[0]&&ubics[0].id)||'planta';
    let metodo='bascula', transporte='cliente';
    const prodFijo = modo==='orden' ? (od.producto_id||'') : '';

    function head(){
      if(modo==='orden'){
        return '<div class="note" style="background:#F0FAF8;border-color:#9FD8CE">'+
          'Cliente: <b>'+esc(od.cliente||'')+'</b><br>Obra: <b>'+esc(od.obra||'')+'</b>'+(od.regimen==='PMA'?' · <b style="color:var(--esc)">PMA</b>':'')+
          '<br>Producto: <b>'+esc(od.producto||'')+'</b><br>Transporte: <b>'+esc(od.placa||'')+' · '+esc(od.volquetero||'')+'</b></div>'+
          '<div id="metaBox"></div>';
      }
      return '<div class="field"><label>Cliente</label><select id="d_cli"><option value="">Selecciona...</option>'+
          clientes.map(c=>'<option value="'+c.id+'">'+esc(c.razon_social||c.nombre||'')+'</option>').join('')+'</select></div>'+
        '<div class="field"><label>Producto</label><select id="d_prod"><option value="">Selecciona...</option>'+
          productos.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('')+'</select></div>'+
        '<div class="chk"><input type="checkbox" id="d_pma" style="width:auto"> <label for="d_pma" style="margin:0;text-transform:none;letter-spacing:0;font-family:inherit;font-size:13px;color:var(--ink)">Asociar a obra PMA (suma a su meta de aprovechamiento)</label></div>'+
        '<div class="field" id="d_obrawrap" style="display:none"><label>Obra PMA</label><select id="d_obra"><option value="">Selecciona...</option>'+
          obrasPma.map(o=>'<option value="'+o.id+'">'+esc(o.cliente||'')+' - '+esc(o.nombre)+'</option>').join('')+'</select><div id="metaBox"></div></div>'+
        '<div class="field"><label>Transporte</label><select id="d_transp"><option value="cliente">Cliente recoge</option><option value="nosotros">Nosotros entregamos</option></select></div>'+
        '<div class="row2" id="d_cliwrap"><div class="field"><label>Placa</label><input id="d_placa" placeholder="ABC123"></div><div class="field"><label>Conductor</label><input id="d_cond"></div></div>';
    }

    el.innerHTML=
      '<div class="mcard" style="max-width:680px">'+
      '<button class="btn ghost sm" id="bBackD">&larr; Despachar</button>'+
      '<h3 style="margin:12px 0 8px">'+(modo==='orden'?'Despachar orden':'Venta directa')+'</h3>'+
      head()+
      '<div class="field"><label>Ubicacion de salida</label><select id="d_ubic">'+
        ubics.map(u=>'<option value="'+esc(u.id)+'"'+(ubic===u.id?' selected':'')+'>'+esc(u.nombre)+'</option>').join('')+'</select>'+
        '<div class="avail" id="d_disp" style="font-size:11px;color:var(--muted);font-family:JetBrains Mono,monospace;margin-top:4px">-</div></div>'+
      '<div class="field"><label>Metodo de pesaje</label><select id="d_metodo"><option value="bascula">Bascula</option><option value="volumen">Volumen x densidad</option></select></div>'+
      '<div id="d_bas"><div class="row2"><div class="field"><label>Peso bruto (t)</label><input id="d_bruto" class="cellnum"></div><div class="field"><label>Tara (t)</label><input id="d_tara" class="cellnum"></div></div>'+
        '<div class="note">Si aun no tienes la tara, se guarda como "Esperando tara" y la completas luego.</div></div>'+
      '<div id="d_vol" style="display:none"><div class="row2"><div class="field"><label>Volumen (m3)</label><input id="d_volumen" class="cellnum"></div><div class="field"><label>Densidad (t/m3)</label><input id="d_dens" class="cellnum" value="1,50"></div></div></div>'+
      '<div class="field"><label>Neto</label><div class="neto" id="d_neto" style="background:var(--esc-soft);border:1px solid var(--esc-bd,#9FD8CE);border-radius:10px;padding:10px 14px;font-family:JetBrains Mono,monospace;font-weight:700;color:var(--esc-d)">-</div></div>'+
      '<div class="field"><label>Observaciones</label><input id="d_obs"></div>'+
      '<div style="display:flex;gap:10px"><button class="btn ghost" id="bCancelD">Cancelar</button><button class="btn primary" id="bSaveD">Guardar despacho</button></div>'+
      '</div>';

    el.querySelector('#bBackD').onclick=despachar;
    el.querySelector('#bCancelD').onclick=despachar;

    function prodActual(){ return modo==='orden' ? prodFijo : (v(el,'d_prod')||''); }
    async function pintarDisp(){
      const pid=prodActual(); const d=el.querySelector('#d_disp');
      if(!pid){ d.textContent='-'; return; }
      try{ const r=await ctx.rpc('rcd_inv_stock_producto',{p_gestor_id:ctx.ses.gestor_id,p_producto_id:pid,p_ubicacion:ubic});
        d.textContent='Disponible del producto: '+numEs(Number(scalar(r))||0)+' t';
      }catch(e){ d.textContent='-'; }
    }
    function calcNeto(){
      let n=null;
      if(metodo==='volumen') n=(parseNum(v(el,'d_volumen'))||0)*(parseNum(v(el,'d_dens'))||0);
      else { const b=parseNum(v(el,'d_bruto')), t=v(el,'d_tara')===''?null:parseNum(v(el,'d_tara')); if(b>0 && t!=null) n=b-t; }
      el.querySelector('#d_neto').textContent = (n!=null && n>0) ? numEs(Math.round(n*1000)/1000)+' t' : (metodo==='bascula'?'Esperando tara':'-');
    }
    async function pintarMeta(obraId){
      const box=el.querySelector('#metaBox'); if(!box) return;
      if(!obraId){ box.innerHTML=''; return; }
      try{ const r=await ctx.rpc('rcd_obra_meta_aprov',{p_gestor_id:ctx.ses.gestor_id,p_obra_id:obraId}); const m=Array.isArray(r)?r[0]:r;
        const meta=Number(m&&m.meta_t)||0, apr=Number(m&&m.aprovechado_t)||0, pct=meta>0?Math.min(100,Math.round(apr/meta*100)):0;
        box.innerHTML='<div class="meta" style="background:#FAFAF8;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-top:8px">'+
          '<div style="font-size:12px;color:var(--muted)">Meta de aprovechamiento (PMA)</div>'+
          '<div style="display:flex;justify-content:space-between;font-family:JetBrains Mono,monospace;font-size:13px;margin-top:4px"><span>Aprovechado '+numEs(apr)+' t</span><span>Meta '+numEs(meta)+' t</span></div>'+
          '<div style="height:8px;background:#E5E7EB;border-radius:99px;overflow:hidden;margin-top:6px"><i style="display:block;height:100%;background:var(--esc);width:'+pct+'%"></i></div>'+
          '<div style="font-size:11px;color:var(--muted);margin-top:6px">Este despacho sumara a este avance.</div></div>';
      }catch(e){ box.innerHTML=''; }
    }

    el.querySelector('#d_ubic').onchange=function(){ ubic=this.value; pintarDisp(); };
    el.querySelector('#d_metodo').onchange=function(){ metodo=this.value;
      el.querySelector('#d_bas').style.display = metodo==='bascula'?'':'none';
      el.querySelector('#d_vol').style.display = metodo==='volumen'?'':'none'; calcNeto(); };
    ['d_bruto','d_tara','d_volumen','d_dens'].forEach(id=>{ const e=el.querySelector('#'+id); if(e) e.oninput=calcNeto; });

    if(modo==='orden'){
      pintarDisp();
      if(od.regimen==='PMA' && od.obra_id) pintarMeta(od.obra_id);
    } else {
      el.querySelector('#d_prod').onchange=pintarDisp;
      el.querySelector('#d_pma').onclick=function(){ el.querySelector('#d_obrawrap').style.display=this.checked?'':'none'; if(!this.checked) pintarMeta(null); };
      el.querySelector('#d_obra').onchange=function(){ pintarMeta(this.value); };
      el.querySelector('#d_transp').onchange=function(){ transporte=this.value;
        el.querySelector('#d_cliwrap').style.display=transporte==='cliente'?'':'none'; };
    }
    calcNeto();

    el.querySelector('#bSaveD').onclick=async function(){
      const btn=this;
      const metodoV=v(el,'d_metodo');
      const body={ p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_origen:modo,
        p_orden_id: modo==='orden'?od.orden_id:null,
        p_cliente_id: modo==='directa'?(v(el,'d_cli')||null):null,
        p_producto_id: modo==='directa'?(v(el,'d_prod')||null):null,
        p_obra_id: (modo==='directa' && el.querySelector('#d_pma').checked)?(v(el,'d_obra')||null):null,
        p_es_pma: modo==='directa' && el.querySelector('#d_pma').checked,
        p_ubicacion: v(el,'d_ubic'), p_transporte: modo==='directa'?v(el,'d_transp'):null,
        p_volquetero_id: null,
        p_placa: (modo==='directa' && v(el,'d_transp')==='cliente')?v(el,'d_placa'):null,
        p_conductor: (modo==='directa' && v(el,'d_transp')==='cliente')?v(el,'d_cond'):null,
        p_metodo: metodoV,
        p_bruto: metodoV==='bascula'?parseNum(v(el,'d_bruto')):null,
        p_tara: (metodoV==='bascula' && v(el,'d_tara')!=='')?parseNum(v(el,'d_tara')):null,
        p_volumen: metodoV==='volumen'?parseNum(v(el,'d_volumen')):null,
        p_densidad: metodoV==='volumen'?parseNum(v(el,'d_dens')):null,
        p_observaciones: v(el,'d_obs') };
      if(modo==='directa'){
        if(!body.p_cliente_id){ ctx.toast('Selecciona el cliente.','error'); return; }
        if(!body.p_producto_id){ ctx.toast('Selecciona el producto.','error'); return; }
      }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_despacho_crear',body));
        if(typeof r==='string' && r.indexOf('DES-')===0){ ctx.toast('Despacho '+r+' guardado'); historial(); return; }
        ctx.toast(msgDesp(r),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar despacho';
    };
  }

  // ===================== HISTORIAL =====================
  async function historial(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let rows=[]; try{ const r=await ctx.rpc('rcd_despachos_lista',{p_gestor_id:ctx.ses.gestor_id,p_desde:hf.desde||null,p_hasta:hf.hasta||null,p_cliente:hf.cliente||null,p_estado:hf.estado||null}); rows=Array.isArray(r)?r:[]; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:980px">'+
      tabbar('his')+
      '<h3 style="margin:0 0 4px">Historial de despachos</h3>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:8px">'+
        '<div class="field" style="margin:0"><label>Desde</label><input type="date" id="h_desde" value="'+esc(hf.desde)+'"></div>'+
        '<div class="field" style="margin:0"><label>Hasta</label><input type="date" id="h_hasta" value="'+esc(hf.hasta)+'"></div>'+
        '<div class="field" style="margin:0"><label>Cliente</label><input id="h_cli" value="'+esc(hf.cliente)+'" placeholder="Buscar"></div>'+
        '<div class="field" style="margin:0"><label>Estado</label><select id="h_estado"><option value="">Todos</option>'+
          '<option value="ok"'+(hf.estado==='ok'?' selected':'')+'>OK</option>'+
          '<option value="esperando_tara"'+(hf.estado==='esperando_tara'?' selected':'')+'>Esperando tara</option></select></div>'+
        '<button class="btn ghost sm" id="hFiltrar">Filtrar</button><button class="btn ghost sm" id="hLimpiar">Limpiar</button>'+
      '</div>'+
      (rows.length?
        '<table class="mtable"><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Ubicacion</th><th style="text-align:right">Neto</th><th>Origen</th><th>Estado</th><th></th></tr>'+
        rows.map(function(d,i){ return '<tr><td class="mono"><b>'+esc(d.numero||'')+'</b></td><td class="mono">'+esc(d.fecha||'')+'</td>'+
          '<td>'+esc(d.cliente||'')+'</td><td>'+esc(d.producto||'')+'</td><td>'+esc(d.ubicacion||'')+'</td>'+
          '<td class="mono" style="text-align:right">'+(d.neto_t!=null?numEs(d.neto_t):'-')+'</td>'+
          '<td>'+(d.origen==='orden'?'Orden':'Directa')+(d.es_pma?' · <b style="color:var(--esc)">PMA</b>':'')+'</td>'+
          '<td>'+(d.estado==='ok'?'<span class="badge ok">OK</span>':(d.estado==='esperando_tara'?'<span class="badge warn">Esperando tara</span>':'<span class="badge off">'+esc(d.estado||'')+'</span>'))+'</td>'+
          '<td><div class="rowbtns">'+
            (d.estado==='esperando_tara'&&pEditar?'<button class="btn ghost sm" data-tara="'+i+'">Completar</button>':'')+
            (pEliminar?'<button class="btn ghost sm" data-anu="'+i+'">Anular</button>':'')+
          '</div></td></tr>'; }).join('')+'</table>'
        : '<div class="empty">Sin despachos con esos filtros.</div>')+
      '</div>';
    wireTabs();
    el.querySelector('#hFiltrar').onclick=function(){ hf.desde=v(el,'h_desde'); hf.hasta=v(el,'h_hasta'); hf.cliente=v(el,'h_cli'); hf.estado=v(el,'h_estado'); historial(); };
    el.querySelector('#hLimpiar').onclick=function(){ hf.desde=hf.hasta=hf.cliente=hf.estado=''; historial(); };
    rows.forEach(function(d,i){
      const t=el.querySelector('[data-tara="'+i+'"]'); if(t) t.onclick=()=>completarTara(d);
      const a=el.querySelector('[data-anu="'+i+'"]'); if(a) a.onclick=()=>anularDespacho(d);
    });
  }
  function completarTara(d){
    el.innerHTML=
      '<div class="mcard" style="max-width:480px">'+
      '<button class="btn ghost sm" id="bBackT">&larr; Historial</button>'+
      '<h3 style="margin:12px 0 6px">Completar tara · '+esc(d.numero||'')+'</h3>'+
      '<p class="lead">'+esc(d.cliente||'')+' · '+esc(d.producto||'')+'</p>'+
      '<div class="field"><label>Tara (t)</label><input id="t_tara" class="cellnum"></div>'+
      '<div style="display:flex;gap:10px"><button class="btn ghost" id="bCancelT">Cancelar</button><button class="btn primary" id="bSaveT">Guardar tara</button></div>'+
      '</div>';
    el.querySelector('#bBackT').onclick=historial;
    el.querySelector('#bCancelT').onclick=historial;
    el.querySelector('#bSaveT').onclick=async function(){
      const btn=this; const tara=parseNum(v(el,'t_tara'));
      if(!(tara>=0)){ ctx.toast('Escribe la tara.','error'); return; }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_despacho_tara',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:d.id,p_tara:tara}));
        if(r==='OK'){ ctx.toast('Despacho completado'); historial(); return; } ctx.toast(msgDesp(r),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar tara';
    };
  }
  async function anularDespacho(d){
    if(!(await ctx.confirm('Anular el despacho '+(d.numero||'')+'? Se revierte su efecto en el inventario.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_despacho_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:d.id}));
      if(r==='OK'){ ctx.toast('Despacho anulado'); historial(); return; } ctx.toast(msgDesp(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  listaSol();
};
