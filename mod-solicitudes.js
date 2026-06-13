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

  // ===================== ORDENES (Paso B) =====================
  function badgeOrden(e){
    if(e==='ofertada') return '<span class="badge warn">Ofertada</span>';
    if(e==='asignada') return '<span class="badge ok">Asignada</span>';
    if(e==='en_ruta') return '<span class="badge warn">En ruta</span>';
    if(e==='completada') return '<span class="badge off">Completada</span>';
    return '<span class="badge off">'+esc(e||'')+'</span>';
  }
  function msgOrden(r){
    return ({SIN_PERMISO:'No tienes permiso.', SOL_NO_APROBADA:'La solicitud no esta aprobada.',
      VEHICULO_VACIO:'Selecciona un vehiculo.', VEHICULO_INVALIDO:'Vehiculo invalido.',
      VEHICULO_INACTIVO:'El vehiculo esta inactivo.', DOCS_VENCIDOS:'El vehiculo tiene SOAT o tecnomecanica vencida.',
      VEHICULO_OCUPADO:'El vehiculo ya tiene una orden asignada (ocupado).',
      TAMANO_NO_COINCIDE:'Ese vehiculo no es del tamano requerido. Marca "Excepcion" si quieres usarlo.'})[r] || 'No se pudo completar la accion.';
  }
  function accionesOrden(o,i){
    let h='';
    if(o.estado==='asignada' && pEditar) h+='<button class="btn ghost sm" data-oruta="'+i+'">En ruta</button>';
    if(o.estado==='en_ruta' && pEditar) h+='<button class="btn ghost sm" data-ocomp="'+i+'">Completar</button>';
    if(o.estado!=='completada' && pEliminar) h+='<button class="btn ghost sm" data-oanu="'+i+'">Anular</button>';
    return h || '<span class="mono" style="color:#C9C9C1;font-size:11px">esperando aceptacion</span>';
  }

  async function ordenes(s){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let os=[]; try{ const r=await ctx.rpc('rcd_ordenes_lista',{p_solicitud_id:s.id}); os=Array.isArray(r)?r:[]; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<button class="btn ghost sm" id="bBackL">&larr; Solicitudes</button>'+
      '<h3 style="margin:12px 0 2px">Ordenes de '+esc(s.numero||'')+'</h3>'+
      '<p class="lead">'+esc(s.cliente||'')+' - '+esc(s.obra||'')+' · '+(s.tipo==='despacho'?'Despacho':'Recepcion')+' · declarado '+numEs(s.cantidad_declarada)+' t</p>'+
      (pCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="bNuevaO">+ Nueva orden</button></div>':'')+
      (os.length?
        '<table class="mtable"><tr><th>N.º</th><th>Vehiculo</th><th>Volquetero</th><th>Fecha</th><th>Estado</th><th></th></tr>'+
        os.map((o,i)=>'<tr><td class="mono"><b>'+esc(o.numero||'')+'</b></td>'+
          '<td class="mono">'+(o.placa?esc(o.placa)+(o.tamano?' · '+esc(o.tamano):''):'<span style="color:var(--muted)">sin asignar</span>')+'</td>'+
          '<td>'+esc(o.volquetero||'')+'</td>'+
          '<td class="mono">'+(o.fecha_programada?esc(o.fecha_programada):'-')+'</td>'+
          '<td>'+badgeOrden(o.estado)+'</td>'+
          '<td><div class="rowbtns">'+accionesOrden(o,i)+'</div></td></tr>').join('')+'</table>'+
        '<div class="note">"Ofertada" la aceptara un volquetero desde su portal (Grupo 6). El vehiculo se libera al pasar a "En ruta".</div>'
        : '<div class="empty">Esta solicitud aun no tiene ordenes.</div>')+
      '</div>';
    el.querySelector('#bBackL').onclick=lista;
    if(pCrear){ const b=el.querySelector('#bNuevaO'); if(b) b.onclick=()=>formOrden(s); }
    os.forEach((o,i)=>{
      const ruta=el.querySelector('[data-oruta="'+i+'"]'); if(ruta) ruta.onclick=()=>ordenEstado(s,o,'en_ruta');
      const comp=el.querySelector('[data-ocomp="'+i+'"]'); if(comp) comp.onclick=()=>ordenEstado(s,o,'completada');
      const anu=el.querySelector('[data-oanu="'+i+'"]'); if(anu) anu.onclick=()=>ordenAnular(s,o);
    });
  }

  async function formOrden(s){
    let elig=[]; try{ const r=await ctx.rpc('rcd_vehiculos_elegibles',{p_gestor_id:ctx.ses.gestor_id}); elig=Array.isArray(r)?r:[]; }catch(e){}
    const reqTam = s.tamano_id || '';
    el.innerHTML=
      '<div class="mcard" style="max-width:640px">'+
      '<button class="btn ghost sm" id="bBackO">&larr; Ordenes</button>'+
      '<h3 style="margin:12px 0 6px">Nueva orden · '+esc(s.numero||'')+'</h3>'+
      (reqTam?'<div class="note">Tamano requerido: <b>'+esc(s.tamano||'')+'</b>. En Oferta solo se ofrece a ese tamano; en Manual puedes elegir cualquiera.</div>':'<div class="note">Sin tamano requerido (cualquiera).</div>')+
      '<div class="field"><label>Modo de asignacion</label><select id="o_modo">'+
        '<option value="manual">Manual (asigno un vehiculo ahora)</option>'+
        '<option value="oferta">Oferta (la acepta un volquetero desde su portal)</option>'+
      '</select></div>'+
      '<div class="field" id="o_vehwrap"><label>Vehiculo elegible</label><select id="o_veh"></select><div class="note warn" id="o_vehnote" style="display:none">No hay vehiculos elegibles.</div></div>'+
      '<div class="field"><label>Fecha programada</label><input type="date" id="o_fecha"></div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancelO">Cancelar</button><button class="btn primary" id="bSaveO">Crear orden</button></div>'+
      '</div>';
    const selModo=el.querySelector('#o_modo'), vehWrap=el.querySelector('#o_vehwrap'),
          selVeh=el.querySelector('#o_veh'), vehNote=el.querySelector('#o_vehnote');

    function pintarVeh(){
      // Manual: el operador puede elegir cualquier vehiculo elegible (incluida la excepcion de tamano)
      const arr=elig;
      selVeh.innerHTML='<option value="">Selecciona...</option>'+arr.map(vh=>'<option value="'+vh.vehiculo_id+'">'+esc(vh.placa)+' · '+esc(vh.tamano||'')+' · '+esc(vh.volquetero||'')+'</option>').join('');
      vehNote.style.display = arr.length?'none':'block';
    }
    function tg(){ vehWrap.style.display = selModo.value==='manual'?'':'none'; if(selModo.value==='manual') pintarVeh(); }
    selModo.onchange=tg; tg();

    el.querySelector('#bBackO').onclick=()=>ordenes(s);
    el.querySelector('#bCancelO').onclick=()=>ordenes(s);
    el.querySelector('#bSaveO').onclick=async function(){
      const btn=this, modo=selModo.value, veh=selVeh.value;
      if(modo==='manual' && !veh){ ctx.toast('Selecciona un vehiculo elegible.','error'); return; }
      btn.disabled=true; btn.textContent='Creando...';
      try{ const r=scalar(await ctx.rpc('rcd_orden_crear',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_solicitud_id:s.id,p_modo:modo,p_vehiculo_id:(modo==='manual'?veh:null),p_fecha:v(el,'o_fecha')||null,p_es_excepcion:false}));
        if(r==='OK'){ ctx.toast('Orden creada'); ordenes(s); return; }
        ctx.toast(msgOrden(r),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Crear orden';
    };
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
