// ============================================================
// RCD PRO · Modulo Volqueteros y vehiculos
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.volqueteros = function(el, ctx){
  const pCrear=ctx.can('volqueteros','escribir'), pEditar=ctx.can('volqueteros','editar'), pEliminar=ctx.can('volqueteros','eliminar');

  function badgeDoc(estado, dias){
    if(estado==='vigente') return '<span class="badge ok">Vigente</span>';
    if(estado==='por_vencer') return '<span class="badge warn">Por vencer'+(dias!=null?' ('+dias+'d)':'')+'</span>';
    if(estado==='vencida') return '<span class="badge danger">Vencida</span>';
    return '<span class="badge off">Sin fecha</span>';
  }

  // ===== Nivel 1: lista de volqueteros =====
  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let ts=[]; try{ const r=await ctx.rpc('rcd_volqueteros_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) ts=r; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<h3 style="margin-top:0">Volqueteros y volquetas</h3>'+
      '<p class="lead">El titular (transportador) y sus vehiculos, con vigencias de SOAT y tecnomecanica.</p>'+
      (pCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="bNuevo">+ Nuevo volquetero</button></div>':'')+
      (ts.length?
        '<table class="mtable"><tr><th>Volquetero</th><th>Documento</th><th>Telefono</th><th>Vehiculos</th><th>Estado</th><th></th></tr>'+
        ts.map((t,i)=>'<tr><td><b>'+esc(t.nombre)+'</b></td><td class="mono">'+esc(t.documento||'')+'</td>'+
          '<td class="mono">'+esc(t.telefono||'')+'</td><td class="mono">'+t.n_vehiculos+'</td>'+
          '<td><span class="badge '+(t.activo?'ok':'off')+'">'+(t.activo?'Activo':'Inactivo')+'</span></td>'+
          '<td><div class="rowbtns"><button class="btn ghost sm" data-open="'+i+'">Gestionar</button>'+
          (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay volqueteros.</div>')+
      '</div>';
    if(pCrear) el.querySelector('#bNuevo').onclick=()=>formVolquetero(null);
    el.querySelectorAll('[data-open]').forEach(b=>{const i=+b.dataset.open; b.onclick=()=>detalle(ts[i]);});
    el.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>formVolquetero(ts[i]);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anularVolquetero(ts[i]);});
  }

  function formVolquetero(t){
    const nuevo=!t;
    el.innerHTML=
      '<div class="mcard" style="max-width:760px">'+
      '<h3 style="margin-top:0">'+(nuevo?'Nuevo volquetero':'Editar volquetero')+'</h3>'+
      '<div class="row2">'+
        '<div class="field"><label>Nombre</label><input id="t_nombre" value="'+(nuevo?'':esc(t.nombre))+'"></div>'+
        '<div class="field"><label>Documento (cedula/NIT)</label><input id="t_doc" value="'+(nuevo?'':esc(t.documento||''))+'"></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Telefono</label><input id="t_tel" value="'+(nuevo?'':esc(t.telefono||''))+'"></div>'+
        '<div class="field"><label>Correo</label><input id="t_correo" value="'+(nuevo?'':esc(t.correo||''))+'"></div>'+
      '</div>'+
      '<div class="note" style="margin-top:4px">Datos bancarios para pagarle</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Banco</label><input id="t_banco" value="'+(nuevo?'':esc(t.banco||''))+'"></div>'+
        '<div class="field"><label>Numero de cuenta</label><input id="t_cuenta" value="'+(nuevo?'':esc(t.cuenta_numero||''))+'"></div>'+
      '</div>'+
      '<div class="field"><label>Tipo de cuenta</label><select id="t_tipo">'+
        '<option value="ahorros"'+(!nuevo&&t.cuenta_tipo==='ahorros'?' selected':'')+'>Ahorros</option>'+
        '<option value="corriente"'+(!nuevo&&t.cuenta_tipo==='corriente'?' selected':'')+'>Corriente</option>'+
      '</select></div>'+
      (nuevo?'':'<div class="field"><label>Estado</label><select id="t_activo"><option value="true"'+(t.activo?' selected':'')+'>Activo</option><option value="false"'+(!t.activo?' selected':'')+'>Inactivo</option></select></div>')+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>'+
      '</div>';
    el.querySelector('#bCancel').onclick=lista;
    el.querySelector('#bSave').onclick=async function(){
      const btn=this, nombre=v(el,'t_nombre'); if(!nombre){ ctx.toast('Escribe el nombre.','error'); return; }
      const activo=nuevo?true:(el.querySelector('#t_activo').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_volquetero_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:nuevo?null:t.id,
          p_nombre:nombre, p_documento:v(el,'t_doc'), p_telefono:v(el,'t_tel'), p_correo:v(el,'t_correo'),
          p_banco:v(el,'t_banco'), p_cuenta_numero:v(el,'t_cuenta'), p_cuenta_tipo:el.querySelector('#t_tipo').value, p_activo:activo}));
        if(r==='OK'){ ctx.toast('Volquetero guardado'); lista(); return; }
        ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.','error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularVolquetero(t){
    if(!(await ctx.confirm('Anular el volquetero "'+t.nombre+'"? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_volquetero_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:t.id}));
      if(r==='OK'){ ctx.toast('Volquetero anulado'); lista(); return; }
      ctx.toast(r==='TIENE_VEHICULOS'?'No se puede anular: tiene vehiculos activos. Anula primero los vehiculos.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.'),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===== Nivel 2: detalle del volquetero + sus vehiculos =====
  function detalle(t){
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<button class="btn ghost sm" id="bBack">&larr; Volqueteros</button>'+
      '<h3 style="margin:12px 0 2px">'+esc(t.nombre)+'</h3>'+
      '<p class="lead">'+esc(t.documento||'')+(t.telefono?' &middot; '+esc(t.telefono):'')+(t.banco?' &middot; '+esc(t.banco)+' '+esc(t.cuenta_numero||''):'')+'</p>'+
      '<div id="secVeh" style="margin-top:8px"></div>'+
      '</div>';
    el.querySelector('#bBack').onclick=lista;
    vehiculos(t);
  }

  async function vehiculos(t){
    const cont=el.querySelector('#secVeh');
    cont.innerHTML='<div class="loading">Cargando vehiculos...</div>';
    let vs=[]; try{ const r=await ctx.rpc('rcd_vehiculos_lista',{p_volquetero_id:t.id}); if(Array.isArray(r)) vs=r; }catch(e){}
    cont.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px"><b>Vehiculos</b>'+
        (pCrear?'<button class="btn ghost sm" id="bNuevoVeh" style="margin-left:auto">+ Nueva volqueta</button>':'')+'</div>'+
      (vs.length?
        '<table class="mtable"><tr><th>Placa</th><th>Tamano</th><th>SOAT</th><th>Tecno</th><th>Estado docs</th><th></th></tr>'+
        vs.map((vh,i)=>'<tr><td><b>'+esc(vh.placa)+'</b>'+(vh.conductor?'<br><span class="mono" style="font-size:11px;color:var(--muted)">'+esc(vh.conductor)+'</span>':'')+'</td>'+
          '<td>'+esc(vh.tamano||'')+'</td>'+
          '<td class="mono">'+(vh.vence_soat?esc(vh.vence_soat):'-')+'</td>'+
          '<td class="mono">'+(vh.vence_tecno?esc(vh.vence_tecno):'-')+'</td>'+
          '<td>'+badgeDoc(vh.estado_docs, vh.dias_min)+'</td>'+
          '<td><div class="rowbtns">'+
            (pEditar?'<button class="btn ghost sm" data-eveh="'+i+'">Editar</button>':'')+
            (pEliminar?'<button class="btn ghost sm" data-aveh="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'+
        '<div class="note">El SOAT/tecnomecanica vencida bloqueara el despacho; "Por vencer" avisa para notificar al volquetero.</div>'
        : '<div class="empty">Este volquetero aun no tiene vehiculos.</div>');
    if(pCrear) cont.querySelector('#bNuevoVeh').onclick=()=>formVehiculo(t,null,cont);
    cont.querySelectorAll('[data-eveh]').forEach(b=>{const i=+b.dataset.eveh; b.onclick=()=>formVehiculo(t,vs[i],cont);});
    cont.querySelectorAll('[data-aveh]').forEach(b=>{const i=+b.dataset.aveh; b.onclick=()=>anularVehiculo(t,vs[i]);});
  }

  async function formVehiculo(t, vh, cont){
    const nuevo=!vh;
    let tams=[]; try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) tams=r; }catch(e){}
    cont.innerHTML=
      '<b>'+(nuevo?'Nueva volqueta':'Editar volqueta')+'</b>'+
      '<div class="row2" style="margin-top:8px">'+
        '<div class="field"><label>Placa</label><input id="v_placa" value="'+(nuevo?'':esc(vh.placa))+'" style="text-transform:uppercase"></div>'+
        '<div class="field"><label>Tamano</label><select id="v_tam"><option value="">Selecciona...</option>'+
          tams.map(tt=>'<option value="'+tt.id+'"'+(!nuevo&&vh.tamano_id===tt.id?' selected':'')+'>'+esc(tt.nombre)+'</option>').join('')+
        '</select></div>'+
      '</div>'+
      '<div class="field"><label>Conductor / propietario (si es distinto al titular)</label><input id="v_cond" value="'+(nuevo?'':esc(vh.conductor||''))+'" placeholder="opcional"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Vence SOAT</label><input type="date" id="v_soat" value="'+(nuevo||!vh.vence_soat?'':esc(vh.vence_soat))+'"></div>'+
        '<div class="field"><label>Vence tecnomecanica</label><input type="date" id="v_tecno" value="'+(nuevo||!vh.vence_tecno?'':esc(vh.vence_tecno))+'"></div>'+
      '</div>'+
      (nuevo?'':'<div class="field"><label>Estado</label><select id="v_activo"><option value="true"'+(vh.activo?' selected':'')+'>Activo</option><option value="false"'+(!vh.activo?' selected':'')+'>Inactivo</option></select></div>')+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bC">Cancelar</button><button class="btn primary" id="bS">Guardar</button></div>';
    cont.querySelector('#bC').onclick=()=>vehiculos(t);
    cont.querySelector('#bS').onclick=async function(){
      const btn=this, placa=v(cont,'v_placa'), tam=cont.querySelector('#v_tam').value;
      if(!placa){ ctx.toast('Escribe la placa.','error'); return; }
      if(!tam){ ctx.toast('Selecciona el tamano.','error'); return; }
      const activo=nuevo?true:(cont.querySelector('#v_activo').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_vehiculo_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:nuevo?null:vh.id, p_volquetero_id:t.id,
          p_placa:placa, p_tamano_id:tam, p_conductor:v(cont,'v_cond'),
          p_vence_soat:v(cont,'v_soat')||null, p_vence_tecno:v(cont,'v_tecno')||null, p_activo:activo}));
        if(r==='OK'){ ctx.toast('Volqueta guardada'); vehiculos(t); return; }
        ctx.toast(r==='PLACA_VACIA'?'Escribe la placa.':(r==='TAMANO_VACIO'?'Selecciona el tamano.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.')),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularVehiculo(t, vh){
    if(!(await ctx.confirm('Anular la volqueta "'+vh.placa+'"? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_vehiculo_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:vh.id}));
      if(r==='OK'){ ctx.toast('Volqueta anulada'); vehiculos(t); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  lista();
};
