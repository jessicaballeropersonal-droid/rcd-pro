// ============================================================
// RCD PRO · Modulo Clientes y Obras
// (usa helpers globales definidos en mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.clientes = function(el, ctx){
  const pCrear=ctx.can('clientes','escribir'), pEditar=ctx.can('clientes','editar'), pEliminar=ctx.can('clientes','eliminar');

  // ===== Nivel 1: lista de clientes =====
  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let cs=[]; try{ const r=await ctx.rpc('rcd_clientes_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) cs=r; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<h3 style="margin-top:0">Clientes y obras</h3>'+
      '<p class="lead">El cliente (generador) y sus obras. La obra define el regimen (PMA/Cupo) por su area.</p>'+
      (pCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="bNuevo">+ Nuevo cliente</button></div>':'')+
      (cs.length?
        '<table class="mtable"><tr><th>Cliente</th><th>NIT</th><th>Obras</th><th>Estado</th><th></th></tr>'+
        cs.map((c,i)=>'<tr><td><b>'+esc(c.razon_social)+'</b></td><td class="mono">'+esc(c.nit||'')+'</td>'+
          '<td class="mono">'+c.n_obras+'</td>'+
          '<td><span class="badge '+(c.activo?'ok':'off')+'">'+(c.activo?'Activo':'Inactivo')+'</span></td>'+
          '<td><div class="rowbtns"><button class="btn ghost sm" data-open="'+i+'">Gestionar</button>'+
          (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay clientes.</div>')+
      '</div>';
    if(pCrear) el.querySelector('#bNuevo').onclick=()=>formCliente(null);
    el.querySelectorAll('[data-open]').forEach(b=>{const i=+b.dataset.open; b.onclick=()=>detalle(cs[i]);});
    el.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>formCliente(cs[i]);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anularCliente(cs[i]);});
  }

  function formCliente(c){
    const nuevo=!c;
    el.innerHTML=
      '<div class="mcard" style="max-width:760px">'+
      '<h3 style="margin-top:0">'+(nuevo?'Nuevo cliente':'Editar cliente')+'</h3>'+
      '<div class="field"><label>Nombre o razon social</label><input id="c_razon" value="'+(nuevo?'':esc(c.razon_social))+'"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Documento / NIT</label><input id="c_nit" value="'+(nuevo?'':esc(c.nit||''))+'"></div>'+
        '<div class="field"><label>Representante legal</label><input id="c_rep" value="'+(nuevo?'':esc(c.rep_legal||''))+'"></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Nombre de contacto</label><input id="c_contacto" value="'+(nuevo?'':esc(c.contacto||''))+'"></div>'+
        '<div class="field"><label>Telefono</label><input id="c_tel" value="'+(nuevo?'':esc(c.telefono||''))+'"></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Correo</label><input id="c_correo" value="'+(nuevo?'':esc(c.correo||''))+'"></div>'+
        '<div class="field"><label>Direccion (domicilio)</label><input id="c_dir" value="'+(nuevo?'':esc(c.direccion||''))+'"></div>'+
      '</div>'+
      (nuevo?'':'<div class="field"><label>Estado</label><select id="c_activo"><option value="true"'+(c.activo?' selected':'')+'>Activo</option><option value="false"'+(!c.activo?' selected':'')+'>Inactivo</option></select></div>')+
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
        '<div class="field"><label>Comuna / zona</label><select id="o_com"><option value="">Selecciona municipio primero</option></select></div>'+
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
      selCom.innerHTML='<option value="">Sin comuna</option>'+coms.map(cc=>'<option value="'+cc.id+'"'+(preselect&&preselect===cc.id?' selected':'')+'>'+esc(cc.nombre)+'</option>').join('');
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

  lista();
};
