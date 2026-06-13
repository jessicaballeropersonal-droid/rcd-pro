// ============================================================
// RCD PRO · Modulo Solicitudes (Paso A: cabecera)
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.solicitudes = function(el, ctx){
  const pCrear=ctx.can('solicitudes','escribir'), pEditar=ctx.can('solicitudes','editar'), pEliminar=ctx.can('solicitudes','eliminar');
  function badgeTipo(t){ return t==='despacho' ? '<span class="badge warn">Despacho</span>' : '<span class="badge ok">Recepcion</span>'; }
  function badgeEstado(e){
    if(e==='aprobada') return '<span class="badge ok">Aprobada</span>';
    if(e==='pendiente') return '<span class="badge warn">Pendiente</span>';
    if(e==='rechazada') return '<span class="badge danger">Rechazada</span>';
    if(e==='cerrada') return '<span class="badge off">Cerrada</span>';
    return '<span class="badge off">'+esc(e||'')+'</span>';
  }
  function badgeOrigen(o){ return o==='cliente' ? '<span class="badge warn">Cliente</span>' : '<span class="badge off">Operador</span>'; }

  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let ss=[]; try{ const r=await ctx.rpc('rcd_solicitudes_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) ss=r; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:1000px">'+
      '<h3 style="margin-top:0">Solicitudes y ordenes</h3>'+
      '<p class="lead">Se crean sobre obras con cotizacion aceptada. Cada solicitud declara una cantidad (parcial del total de la obra).</p>'+
      (pCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="bNueva">+ Nueva solicitud</button></div>':'')+
      (ss.length?
        '<table class="mtable"><tr><th>N.º</th><th>Cliente / obra</th><th>Tipo</th><th>Detalle</th><th style="text-align:right">Declarado (t)</th><th>Fecha</th><th>Origen</th><th>Estado</th><th></th></tr>'+
        ss.map((s,i)=>'<tr><td class="mono"><b>'+esc(s.numero||'')+'</b></td>'+
          '<td>'+esc(s.cliente||'')+'<br><span style="font-size:12px;color:var(--muted)">'+esc(s.obra||'')+'</span></td>'+
          '<td>'+badgeTipo(s.tipo)+'</td>'+
          '<td>'+(s.tipo==='despacho'?esc(s.producto||''):'RCD')+'</td>'+
          '<td style="text-align:right" class="mono">'+numEs(s.cantidad_declarada)+'</td>'+
          '<td class="mono">'+esc(s.fecha||'')+'</td>'+
          '<td>'+badgeOrigen(s.origen)+'</td>'+
          '<td>'+badgeEstado(s.estado)+'</td>'+
          '<td><div class="rowbtns">'+
          (s.estado==='pendiente'&&pEditar?'<button class="btn ghost sm" data-aprob="'+i+'">Aprobar</button><button class="btn ghost sm" data-rech="'+i+'">Rechazar</button>':'')+
          (s.estado==='aprobada'?'<button class="btn ghost sm" data-ord="'+i+'">Ordenes</button>':'')+
          (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay solicitudes.</div>')+
      '</div>';
    if(pCrear) el.querySelector('#bNueva').onclick=()=>form(null,ss);
    el.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>form(ss[i],ss);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anular(ss[i]);});
    el.querySelectorAll('[data-aprob]').forEach(b=>{const i=+b.dataset.aprob; b.onclick=()=>cambiarEstado(ss[i],'aprobada');});
    el.querySelectorAll('[data-rech]').forEach(b=>{const i=+b.dataset.rech; b.onclick=()=>cambiarEstado(ss[i],'rechazada');});
    el.querySelectorAll('[data-ord]').forEach(b=>{const i=+b.dataset.ord; b.onclick=()=>ordenes(ss[i]);});
  }

  async function cambiarEstado(s, estado){
    const msg = estado==='aprobada' ? 'Aprobar la solicitud '+(s.numero||'')+'? Podra convertirse en ordenes.' : 'Rechazar la solicitud '+(s.numero||'')+'?';
    if(!(await ctx.confirm(msg))) return;
    try{ const r=scalar(await ctx.rpc('rcd_solicitud_estado',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:s.id,p_estado:estado}));
      if(r==='OK'){ ctx.toast(estado==='aprobada'?'Solicitud aprobada':'Solicitud rechazada'); lista(); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo cambiar el estado.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  async function form(s, ss){
    const nuevo=!s;
    let obras=[]; try{ const r=await ctx.rpc('rcd_obras_cotizadas',{p_gestor_id:ctx.ses.gestor_id}); obras=Array.isArray(r)?r:[]; }catch(e){}
    let productos=[]; try{ const r=await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); productos=(Array.isArray(r)?r:[]).filter(p=>p.activo); }catch(e){}
    let tams=[]; try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); tams=(Array.isArray(r)?r:[]).filter(t=>t.activa); }catch(e){}

    // si edito, necesito el obra_id; lo obtengo emparejando por nombre no es fiable -> guardo obra_id en la solicitud lista? no viene.
    // Para editar, recargamos por el id de solicitud via lista (ya trae lo necesario salvo obra_id). Pedimos obra por selector.
    const obraIdActual = nuevo ? '' : (s.obra_id||'');

    el.innerHTML=
      '<div class="mcard" style="max-width:720px">'+
      '<button class="btn ghost sm" id="bBack">&larr; Solicitudes</button>'+
      '<h3 style="margin:12px 0 6px">'+(nuevo?'Nueva solicitud':'Editar solicitud '+esc(s.numero||''))+'</h3>'+
      '<div class="field"><label>Obra (con cotizacion aceptada)</label><select id="s_obra"><option value="">Selecciona...</option>'+
        obras.map(o=>'<option value="'+o.id+'"'+(obraIdActual===o.id?' selected':'')+'>'+esc(o.cliente||'')+' - '+esc(o.nombre)+'</option>').join('')+
      '</select></div>'+
      '<div class="note" id="s_resumen" style="display:none"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Tipo</label><select id="s_tipo">'+
          '<option value="recepcion"'+(!nuevo&&s.tipo==='recepcion'?' selected':'')+'>Recepcion de RCD</option>'+
          '<option value="despacho"'+(!nuevo&&s.tipo==='despacho'?' selected':'')+'>Despacho de producto</option>'+
        '</select></div>'+
        '<div class="field"><label>Fecha</label><input type="date" id="s_fecha" value="'+(nuevo?'':esc(s.fecha||''))+'"></div>'+
      '</div>'+
      '<div class="field" id="s_prodwrap" style="display:none"><label>Producto</label><select id="s_prod"><option value="">Selecciona...</option>'+
        productos.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('')+
      '</select></div>'+
      '<div class="field"><label>Cantidad declarada (t)</label><input id="s_cant" class="cellnum" style="width:160px" value="'+(nuevo?'':numEs(s.cantidad_declarada))+'"></div>'+
      '<div class="field"><label>Tamano requerido (opcional)</label><select id="s_tam"><option value="">Cualquiera</option>'+
        tams.map(t=>'<option value="'+t.id+'"'+(!nuevo&&s.tamano_id===t.id?' selected':'')+'>'+esc(t.nombre)+'</option>').join('')+
      '</select><div class="note">Si lo defines, las ordenes solo aceptaran vehiculos de ese tamano (salvo excepcion).</div></div>'+
      '<div class="field"><label>Observaciones</label><input id="s_obs" value="'+(nuevo?'':esc(s.observaciones||''))+'"></div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>'+
      '</div>';

    const selObra=el.querySelector('#s_obra'), selTipo=el.querySelector('#s_tipo'), prodWrap=el.querySelector('#s_prodwrap'),
          selProd=el.querySelector('#s_prod'), inpCant=el.querySelector('#s_cant'), resumen=el.querySelector('#s_resumen');

    if(!nuevo && s.tipo==='despacho' && s.producto_id) selProd.value=s.producto_id;

    function toggleProd(){ prodWrap.style.display = selTipo.value==='despacho' ? '' : 'none'; }
    function pintarResumen(){
      const o=obras.find(x=>x.id===selObra.value);
      if(!o){ resumen.style.display='none'; return; }
      const total=+o.total_declarado_t||0, yaSol=+o.solicitado||0;
      // si estoy editando esta misma solicitud, su cantidad ya esta dentro de "solicitado"; resto para no contarla doble
      const propia = (!nuevo && s.obra_id===o.id) ? (+s.cantidad_declarada||0) : 0;
      const base = yaSol - propia;
      const nueva = parseNum(inpCant.value);
      const disp = total - base;
      resumen.style.display='block';
      let txt='Total a disponer: '+numEs(total)+' t · Ya solicitado: '+numEs(base)+' t · Disponible: '+numEs(disp)+' t';
      if(nueva>disp && total>0){ txt+=' — ATENCION: esta cantidad supera lo disponible.'; resumen.className='note warn'; }
      else resumen.className='note';
      resumen.textContent=txt;
    }
    selObra.onchange=pintarResumen;
    selTipo.onchange=toggleProd;
    inpCant.oninput=pintarResumen;
    toggleProd(); pintarResumen();

    el.querySelector('#bBack').onclick=lista;
    el.querySelector('#bCancel').onclick=lista;
    el.querySelector('#bSave').onclick=async function(){
      const btn=this;
      if(!selObra.value){ ctx.toast('Selecciona la obra.','error'); return; }
      const tipo=selTipo.value;
      if(tipo==='despacho' && !selProd.value){ ctx.toast('Selecciona el producto.','error'); return; }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_solicitud_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:nuevo?null:s.id,
          p_obra_id:selObra.value, p_tipo:tipo, p_producto_id:(tipo==='despacho'?selProd.value:null),
          p_cantidad:parseNum(inpCant.value), p_fecha:v(el,'s_fecha')||null, p_observaciones:v(el,'s_obs'),
          p_tamano_id:el.querySelector('#s_tam').value||null}));
        if(r==='OK'){ ctx.toast('Solicitud guardada'); lista(); return; }
        ctx.toast(r==='OBRA_NO_COTIZADA'?'Esa obra no tiene cotizacion aceptada.':(r==='PRODUCTO_VACIO'?'Selecciona el producto.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.')),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anular(s){
    if(!(await ctx.confirm('Anular la solicitud '+(s.numero||'')+'? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_solicitud_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:s.id}));
      if(r==='OK'){ ctx.toast('Solicitud anulada'); lista(); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===================== ORDENES (automaticas + partir manual + suelta) =====================
  function badgeOrden(e){
    if(e==='pendiente') return '<span class="badge off">Pendiente</span>';
    if(e==='ofertada') return '<span class="badge warn">Ofertada</span>';
    if(e==='asignada') return '<span class="badge ok">Asignada</span>';
    if(e==='en_ruta') return '<span class="badge warn">En ruta</span>';
    if(e==='completada') return '<span class="badge ok">Completada</span>';
    if(e==='reemplazada') return '<span class="badge off">Reemplazada</span>';
    return '<span class="badge off">'+esc(e||'')+'</span>';
  }
  function msgOrden(r){
    return ({SIN_PERMISO:'No tienes permiso.', SOL_NO_APROBADA:'La solicitud no esta aprobada.',
      SIN_TAMANO:'Define el tamano requerido en la solicitud (editala).',
      YA_GENERADAS:'Las ordenes ya fueron generadas para esta solicitud.',
      CAPACIDAD_INVALIDA:'El tamano no tiene una capacidad valida.',
      VEHICULO_VACIO:'Selecciona un vehiculo.', VEHICULO_INVALIDO:'Vehiculo invalido.',
      VEHICULO_INACTIVO:'El vehiculo esta inactivo.', DOCS_VENCIDOS:'El vehiculo tiene SOAT o tecnomecanica vencida.',
      VEHICULO_OCUPADO:'El vehiculo ya tiene una orden asignada (ocupado).',
      TAMANO_NO_COINCIDE:'El vehiculo no es del tamano de la orden. Usa "Partir" si quieres pasar a otro tamano.',
      ORDEN_NO_ASIGNABLE:'Esa orden ya no se puede asignar.',
      ORDEN_NO_OFERTABLE:'Solo se ofertan ordenes pendientes.',
      ORDEN_NO_PARTIBLE:'Solo se parten ordenes pendientes u ofertadas (sin vehiculo).',
      SIN_TAMANO_MITAD:'No existe un tamano que sea la mitad; no se puede partir.'})[r] || 'No se pudo completar la accion.';
  }
  function accionesOrden(o,i){
    let h='';
    if(o.estado==='pendiente' && pEditar) h+='<button class="btn ghost sm" data-oasg="'+i+'">Asignar</button><button class="btn ghost sm" data-oofe="'+i+'">Ofertar</button><button class="btn ghost sm" data-opar="'+i+'">Partir</button>';
    if(o.estado==='ofertada' && pEditar) h+='<button class="btn ghost sm" data-oasg="'+i+'">Asignar</button>';
    if(o.estado==='asignada' && pEditar) h+='<button class="btn ghost sm" data-oruta="'+i+'">En ruta</button>';
    if(o.estado==='en_ruta' && pEditar) h+='<button class="btn ghost sm" data-ocomp="'+i+'">Completar</button>';
    if(['pendiente','ofertada','asignada'].indexOf(o.estado)>=0 && pEliminar) h+='<button class="btn ghost sm" data-oanu="'+i+'">Anular</button>';
    return h || '<span class="mono" style="color:#C9C9C1;font-size:11px">-</span>';
  }

  async function ordenes(s){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let os=[]; try{ const r=await ctx.rpc('rcd_ordenes_lista',{p_solicitud_id:s.id}); os=Array.isArray(r)?r:[]; }catch(e){}
    const sinTam = !s.tamano_id;
    el.innerHTML=
      '<div class="mcard" style="max-width:940px">'+
      '<button class="btn ghost sm" id="bBackL">&larr; Solicitudes</button>'+
      '<h3 style="margin:12px 0 2px">Ordenes de '+esc(s.numero||'')+'</h3>'+
      '<p class="lead">'+esc(s.cliente||'')+' - '+esc(s.obra||'')+' · '+(s.tipo==='despacho'?'Despacho':'Recepcion')+' · declarado '+numEs(s.cantidad_declarada)+' t · tamano '+esc(s.tamano||'cualquiera')+'</p>'+
      (pCrear?'<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'+
        (os.length===0 ? '<button class="btn primary sm" id="bGen"'+(sinTam?' disabled':'')+'>Generar ordenes</button>' : '')+
        '<button class="btn ghost sm" id="bAdd">+ Orden suelta</button>'+
      '</div>':'')+
      (sinTam?'<div class="note warn">Para generar ordenes automaticas, edita la solicitud y define un tamano requerido.</div>':'')+
      (os.length?
        '<table class="mtable"><tr><th>N.º</th><th>Tamano</th><th>Vehiculo</th><th>Volquetero</th><th>Estado</th><th></th></tr>'+
        os.map(function(o,i){ return '<tr><td class="mono"><b>'+esc(o.numero||'')+'</b>'+(o.reemplaza_numero?'<br><span style="font-size:10px;color:var(--muted)">de '+esc(o.reemplaza_numero)+'</span>':'')+'</td>'+
          '<td>'+esc(o.tamano||'')+'</td>'+
          '<td class="mono">'+(o.placa?esc(o.placa):'<span style="color:var(--muted)">-</span>')+'</td>'+
          '<td>'+esc(o.volquetero||'')+'</td>'+
          '<td>'+badgeOrden(o.estado)+'</td>'+
          '<td><div class="rowbtns">'+accionesOrden(o,i)+'</div></td></tr>'; }).join('')+'</table>'
        : '<div class="empty">Sin ordenes. Acepta la solicitud y usa "Generar ordenes".</div>')+
      '<div class="note">Cada orden es un viaje. Pendiente: Asignar (vehiculo del mismo tamano), Ofertar (la acepta un volquetero), o Partir (1 grande -> 2 de la mitad, lo autorizas tu). El vehiculo se libera al pasar a "En ruta".</div>'+
      '</div>';
    el.querySelector('#bBackL').onclick=lista;
    if(pCrear){
      const g=el.querySelector('#bGen'); if(g && !sinTam) g.onclick=()=>generar(s);
      const a=el.querySelector('#bAdd'); if(a) a.onclick=()=>agregarOrden(s);
    }
    os.forEach(function(o,i){
      const asg=el.querySelector('[data-oasg="'+i+'"]'); if(asg) asg.onclick=()=>formAsignar(s,o);
      const ofe=el.querySelector('[data-oofe="'+i+'"]'); if(ofe) ofe.onclick=()=>ordenOfertar(s,o);
      const par=el.querySelector('[data-opar="'+i+'"]'); if(par) par.onclick=()=>ordenPartir(s,o);
      const ruta=el.querySelector('[data-oruta="'+i+'"]'); if(ruta) ruta.onclick=()=>ordenEstado(s,o,'en_ruta');
      const comp=el.querySelector('[data-ocomp="'+i+'"]'); if(comp) comp.onclick=()=>ordenEstado(s,o,'completada');
      const anu=el.querySelector('[data-oanu="'+i+'"]'); if(anu) anu.onclick=()=>ordenAnular(s,o);
    });
  }

  async function generar(s){
    if(!(await ctx.confirm('Generar las ordenes de '+(s.numero||'')+' segun la cantidad declarada y el tamano requerido?'))) return;
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
        (arr.length?'':'<div class="note warn">No hay vehiculos elegibles de ese tamano. Vuelve y usa "Partir" para pasar a un tamano menor.</div>')+'</div>'+
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
      if(r==='OK'){ ctx.toast('Orden ofertada'); ordenes(s); return; }
      ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  async function ordenPartir(s,o){
    if(!(await ctx.confirm('Partir la orden '+(o.numero||'')+' ('+(o.tamano||'')+') en 2 viajes de la mitad? Quedara la trazabilidad del cambio.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_orden_partir',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id}));
      if(r==='OK'){ ctx.toast('Orden partida en 2'); ordenes(s); return; }
      ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  async function ordenEstado(s,o,estado){
    try{ const r=scalar(await ctx.rpc('rcd_orden_estado',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id,p_estado:estado}));
      if(r==='OK'){ ctx.toast(estado==='en_ruta'?'Orden en ruta':'Orden completada'); ordenes(s); return; }
      ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  async function ordenAnular(s,o){
    if(!(await ctx.confirm('Anular la orden '+(o.numero||'')+'?'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_orden_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_orden_id:o.id}));
      if(r==='OK'){ ctx.toast('Orden anulada'); ordenes(s); return; }
      ctx.toast(msgOrden(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  lista();
};
