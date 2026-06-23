// ============================================================
// RCD PRO · Modulo Parametros
// Pestanas: Identidad (funcional) + el resto en construccion.
// Se va llenando pestana por pestana en el Grupo 1.
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.parametros = function(el, ctx){
  const TABS = [
    ['identidad','Identidad / marca'],
    ['sucursales','Sucursales'],
    ['productos','Productos terminados'],
    ['densidades','Densidades'],
    ['volquetas','Volquetas'],
    ['municipios','Municipios'],
    ['actividad','Actividad'],
    ['sistema','Sistema'],
    ['otros','Otros']
  ];
  let activa = 'identidad';

  el.innerHTML =
    '<div class="mcard" style="max-width:820px">'+
      '<div class="tabbar" id="pTabs">'+
        TABS.map(t=>'<button class="tab'+(t[0]===activa?' active':'')+'" data-t="'+t[0]+'">'+t[1]+'</button>').join('')+
      '</div>'+
      '<div id="pBody"></div>'+
    '</div>';

  el.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
    activa=b.dataset.t;
    el.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));
    pintar();
  });

  function pintar(){
    const body = el.querySelector('#pBody');
    if(activa==='identidad'){ identidad(body, ctx); }
    else if(activa==='sucursales'){ sucursales(body, ctx); }
    else if(activa==='productos'){ productos(body, ctx); }
    else if(activa==='densidades'){ densidades(body, ctx); }
    else if(activa==='volquetas'){ volquetas(body, ctx); }
    else if(activa==='municipios'){ municipios(body, ctx); }
    else if(activa==='actividad'){ actividad(body, ctx); }
    else if(activa==='sistema'){ sistema(body, ctx); }
    else {
      body.innerHTML = '<div class="note">Esta seccion se construye en su paso del Grupo 1.</div>';
    }
  }
  pintar();
};

// ---------- Pestana IDENTIDAD ----------
async function identidad(body, ctx){
  const puedeEditar = ctx.can('parametros','editar');
  body.innerHTML = '<div class="loading">Cargando datos...</div>';

  let g = {};
  try{
    const r = await ctx.rpc('rcd_gestor', {p_gestor_id: ctx.ses.gestor_id});
    if(Array.isArray(r) && r.length) g = r[0];
  }catch(e){}

  let nuevoLogo = null; // data URL del logo nuevo, o null si no cambia

  body.innerHTML =
    '<h3 style="margin-top:0">Identidad / marca</h3>'+
    '<p class="lead">El nombre, logo y datos de contacto del gestor. Aparecen en la cotizacion y en los documentos.</p>'+
    '<div class="row2">'+
      '<div>'+
        '<div class="field"><label>Logo</label>'+
          '<div style="display:flex;align-items:center;gap:12px">'+
            '<div class="logo-box" id="logoBox">'+(g.logo_url?'<img src="'+g.logo_url+'">':'Sin logo')+'</div>'+
            (puedeEditar?'<label class="btn ghost sm" style="margin:0">Subir logo<input type="file" id="logoFile" accept="image/*" hidden></label>':'')+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div>'+
        '<div class="field"><label>Nombre del gestor</label><input id="f_nombre" value="'+esc(g.nombre)+'" '+ro(puedeEditar)+'></div>'+
        '<div class="field"><label>NIT</label><input id="f_nit" value="'+esc(g.nit)+'" '+ro(puedeEditar)+'></div>'+
      '</div>'+
    '</div>'+
    '<div class="row2">'+
      '<div class="field"><label>Telefono</label><input id="f_telefono" value="'+esc(g.telefono)+'" '+ro(puedeEditar)+'></div>'+
      '<div class="field"><label>Correo</label><input id="f_correo" value="'+esc(g.correo)+'" '+ro(puedeEditar)+'></div>'+
    '</div>'+
    '<div class="field"><label>Direccion</label><input id="f_direccion" value="'+esc(g.direccion)+'" '+ro(puedeEditar)+'></div>'+
    (puedeEditar
      ? '<div style="margin-top:8px"><button class="btn primary" id="btnGuardar">Guardar</button></div>'
      : '<div class="note warn">Solo lectura: no tienes permiso de Editar en Parametros.</div>');

  if(puedeEditar){
    const fileInput = body.querySelector('#logoFile');
    if(fileInput){
      fileInput.onchange = e=>{
        const file = e.target.files[0];
        if(!file) return;
        comprimirLogo(file, dataUrl=>{
          nuevoLogo = dataUrl;
          body.querySelector('#logoBox').innerHTML = '<img src="'+dataUrl+'">';
        });
      };
    }
    body.querySelector('#btnGuardar').onclick = async function(){
      const btn = this; btn.disabled = true; btn.textContent = 'Guardando...';
      try{
        const res = await ctx.rpc('rcd_gestor_guardar', {
          p_usuario_id: ctx.ses.id,
          p_gestor_id:  ctx.ses.gestor_id,
          p_nombre:     v(body,'f_nombre'),
          p_nit:        v(body,'f_nit'),
          p_telefono:   v(body,'f_telefono'),
          p_correo:     v(body,'f_correo'),
          p_direccion:  v(body,'f_direccion'),
          p_logo_url:   nuevoLogo
        });
        const ok = (res === 'OK' || (Array.isArray(res) && res[0]==='OK'));
        if(ok){
          nuevoLogo = null;
          ctx.toast('Identidad guardada');
          const gn = document.getElementById('gestorNombre'); if(gn) gn.textContent = v(body,'f_nombre');
        } else if(res === 'SIN_PERMISO'){
          ctx.toast('No tienes permiso para editar la identidad.','error');
        } else {
          ctx.toast('No se pudo guardar. Intenta de nuevo.','error');
        }
      }catch(e){ ctx.toast('Error de conexion al guardar.','error'); }
      finally{ btn.disabled = false; btn.textContent = 'Guardar'; }
    };
  }
}

// ---------- Pestana SUCURSALES ----------
async function sucursales(body, ctx){
  const puedeCrear    = ctx.can('parametros','escribir');
  const puedeEditar   = ctx.can('parametros','editar');
  const puedeEliminar = ctx.can('parametros','eliminar');

  async function cargar(){
    body.innerHTML = '<div class="loading">Cargando...</div>';
    let lista=[];
    try{ const r = await ctx.rpc('rcd_sucursales_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) lista=r; }catch(e){}
    render(lista);
  }

  function render(lista){
    body.innerHTML =
      '<h3 style="margin-top:0">Sucursales</h3>'+
      '<p class="lead">Las plantas del gestor. El cliente no las ve; el operador elige la sucursal destino.</p>'+
      (puedeCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="btnNueva">+ Agregar sucursal</button></div>':'')+
      (lista.length? tabla(lista) : '<div class="empty">Aun no hay sucursales.</div>');
    if(puedeCrear) body.querySelector('#btnNueva').onclick=()=>form(null);
    body.querySelectorAll('[data-edit]').forEach(b=>{ const i=+b.dataset.edit; b.onclick=()=>form(lista[i]); });
    body.querySelectorAll('[data-anular]').forEach(b=>{ const i=+b.dataset.anular; b.onclick=()=>anular(lista[i]); });
  }

  function tabla(lista){
    return '<table class="mtable"><tr><th>Sucursal</th><th>Direccion</th><th>Estado</th><th></th></tr>'+
      lista.map((s,i)=>{
        const acts =
          (puedeEditar  ?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (puedeEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'');
        return '<tr><td><b>'+esc(s.nombre)+'</b></td><td>'+esc(s.direccion||'')+'</td>'+
          '<td><span class="badge '+(s.activa?'ok':'off')+'">'+(s.activa?'Activa':'Inactiva')+'</span></td>'+
          '<td><div class="rowbtns">'+(acts||'<span class="mono" style="color:#C9C9C1;font-size:11px">solo lectura</span>')+'</div></td></tr>';
      }).join('')+'</table>';
  }

  function form(s){
    const esNueva = !s;
    body.innerHTML =
      '<h3 style="margin-top:0">'+(esNueva?'Nueva sucursal':'Editar sucursal')+'</h3>'+
      '<div class="field"><label>Nombre</label><input id="s_nombre" value="'+(esNueva?'':esc(s.nombre))+'"></div>'+
      '<div class="field"><label>Direccion</label><input id="s_direccion" value="'+(esNueva?'':esc(s.direccion||''))+'"></div>'+
      (esNueva?'':'<div class="field"><label>Estado</label><select id="s_activa"><option value="true"'+(s.activa?' selected':'')+'>Activa</option><option value="false"'+(!s.activa?' selected':'')+'>Inactiva</option></select></div>')+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>';
    body.querySelector('#bCancel').onclick=cargar;
    body.querySelector('#bSave').onclick=async function(){
      const btn=this; const nombre=v(body,'s_nombre');
      if(!nombre){ ctx.toast('Escribe el nombre de la sucursal.','error'); return; }
      const activa = esNueva ? true : (body.querySelector('#s_activa').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{
        const res = await ctx.rpc('rcd_sucursal_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id,
          p_id: esNueva?null:s.id, p_nombre:nombre, p_direccion:v(body,'s_direccion'), p_activa:activa
        });
        const r = scalar(res);
        if(r==='OK'){ ctx.toast('Sucursal guardada'); cargar(); return; }
        if(r==='MIN_UNA_ACTIVA') ctx.toast('Debe quedar al menos una sucursal activa.','error');
        else if(r==='SIN_PERMISO') ctx.toast('No tienes permiso.','error');
        else if(r==='NOMBRE_VACIO') ctx.toast('El nombre no puede ir vacio.','error');
        else ctx.toast('No se pudo guardar.','error');
      }catch(e){ ctx.toast('Error de conexion al guardar.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anular(s){
    if(!(await ctx.confirm('Anular la sucursal "'+s.nombre+'"? Se ocultara, pero el historico queda.'))) return;
    try{
      const res = await ctx.rpc('rcd_sucursal_anular',{p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:s.id});
      const r = scalar(res);
      if(r==='OK'){ ctx.toast('Sucursal anulada'); cargar(); return; }
      if(r==='MIN_UNA_ACTIVA') ctx.toast('No puedes anular: debe quedar al menos una sucursal activa.','error');
      else if(r==='TIENE_MOVIMIENTOS') ctx.toast('No se puede anular: la sucursal tiene movimientos.','error');
      else if(r==='SIN_PERMISO') ctx.toast('No tienes permiso para anular.','error');
      else ctx.toast('No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  cargar();
}

// ---------- Pestana PRODUCTOS TERMINADOS ----------
async function productos(body, ctx){
  const puedeCrear    = ctx.can('parametros','escribir');
  const puedeEditar   = ctx.can('parametros','editar');
  const puedeEliminar = ctx.can('parametros','eliminar');

  async function cargar(){
    body.innerHTML = '<div class="loading">Cargando...</div>';
    let lista=[];
    try{ const r = await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) lista=r; }catch(e){}
    render(lista);
  }

  function render(lista){
    body.innerHTML =
      '<h3 style="margin-top:0">Productos terminados</h3>'+
      '<p class="lead">Lo que resulta de transformar el RCD aprovechable. Lo usan Produccion y Despacho.</p>'+
      (puedeCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="btnNuevo">+ Agregar producto</button></div>':'')+
      (lista.length? tabla(lista) : '<div class="empty">Aun no hay productos.</div>');
    if(puedeCrear) body.querySelector('#btnNuevo').onclick=()=>form(null);
    body.querySelectorAll('[data-edit]').forEach(b=>{ const i=+b.dataset.edit; b.onclick=()=>form(lista[i]); });
    body.querySelectorAll('[data-anular]').forEach(b=>{ const i=+b.dataset.anular; b.onclick=()=>anular(lista[i]); });
  }

  function tabla(lista){
    return '<table class="mtable"><tr><th>Producto</th><th>Estado</th><th></th></tr>'+
      lista.map((p,i)=>{
        const acts =
          (puedeEditar  ?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (puedeEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'');
        return '<tr><td><b>'+esc(p.nombre)+'</b></td>'+
          '<td><span class="badge '+(p.activo?'ok':'off')+'">'+(p.activo?'Activo':'Inactivo')+'</span></td>'+
          '<td><div class="rowbtns">'+(acts||'<span class="mono" style="color:#C9C9C1;font-size:11px">solo lectura</span>')+'</div></td></tr>';
      }).join('')+'</table>';
  }

  function form(p){
    const esNuevo = !p;
    body.innerHTML =
      '<h3 style="margin-top:0">'+(esNuevo?'Nuevo producto':'Editar producto')+'</h3>'+
      '<div class="field"><label>Nombre del producto</label><input id="p_nombre" value="'+(esNuevo?'':esc(p.nombre))+'"></div>'+
      (esNuevo?'':'<div class="field"><label>Estado</label><select id="p_activo"><option value="true"'+(p.activo?' selected':'')+'>Activo</option><option value="false"'+(!p.activo?' selected':'')+'>Inactivo</option></select></div>')+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>';
    body.querySelector('#bCancel').onclick=cargar;
    body.querySelector('#bSave').onclick=async function(){
      const btn=this; const nombre=v(body,'p_nombre');
      if(!nombre){ ctx.toast('Escribe el nombre del producto.','error'); return; }
      const activo = esNuevo ? true : (body.querySelector('#p_activo').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{
        const res = await ctx.rpc('rcd_producto_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id,
          p_id: esNuevo?null:p.id, p_nombre:nombre, p_activo:activo
        });
        const r = scalar(res);
        if(r==='OK'){ ctx.toast('Producto guardado'); cargar(); return; }
        if(r==='SIN_PERMISO') ctx.toast('No tienes permiso.','error');
        else if(r==='NOMBRE_VACIO') ctx.toast('El nombre no puede ir vacio.','error');
        else ctx.toast('No se pudo guardar.','error');
      }catch(e){ ctx.toast('Error de conexion al guardar.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anular(p){
    if(!(await ctx.confirm('Anular el producto "'+p.nombre+'"? Se ocultara, pero el historico queda.'))) return;
    try{
      const res = await ctx.rpc('rcd_producto_anular',{p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:p.id});
      const r = scalar(res);
      if(r==='OK'){ ctx.toast('Producto anulado'); cargar(); return; }
      if(r==='TIENE_INVENTARIO') ctx.toast('No se puede anular: el producto tiene inventario.','error');
      else if(r==='SIN_PERMISO') ctx.toast('No tienes permiso para anular.','error');
      else ctx.toast('No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  cargar();
}

// ---------- Pestana DENSIDADES ----------
async function densidades(body, ctx){
  const puedeEditar = ctx.can('parametros','editar');
  body.innerHTML = '<div class="loading">Cargando...</div>';
  let lista=[];
  try{ const r = await ctx.rpc('rcd_densidades_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) lista=r; }catch(e){}

  body.innerHTML =
    '<h3 style="margin-top:0">Densidades por tipo de RCD</h3>'+
    '<p class="lead">Solo se usan en la opcion 2 del pesaje (por volumen): m3 x densidad = toneladas.</p>'+
    '<table class="mtable"><tr><th>Tipo de RCD</th><th style="text-align:right">Densidad (t/m3)</th></tr>'+
    lista.map(d=>'<tr><td>'+esc(d.tipo)+'</td><td style="text-align:right">'+
      '<input class="cellnum dens" data-id="'+d.id+'" value="'+numEs(d.densidad)+'" '+(puedeEditar?'':'readonly')+'></td></tr>').join('')+
    '</table>'+
    '<div class="note">Si la volqueta pasa por bascula (opcion 1), la densidad no se usa: el peso es el real.</div>'+
    (puedeEditar
      ? '<div style="margin-top:14px;text-align:right"><button class="btn primary" id="bSave">Guardar</button></div>'
      : '<div class="note warn">Solo lectura: no tienes permiso de Editar en Parametros.</div>');

  if(puedeEditar){
    body.querySelector('#bSave').onclick = async function(){
      const btn=this; btn.disabled=true; btn.textContent='Guardando...';
      const datos = Array.from(body.querySelectorAll('.dens')).map(i=>({id:i.dataset.id, densidad:parseNum(i.value)}));
      try{
        const res = await ctx.rpc('rcd_densidades_guardar',{p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_datos:datos});
        const r = scalar(res);
        if(r==='OK') ctx.toast('Densidades guardadas');
        else if(r==='SIN_PERMISO') ctx.toast('No tienes permiso.','error');
        else ctx.toast('No se pudo guardar.','error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }
}

// ---------- Pestana VOLQUETAS ----------
async function volquetas(body, ctx){
  const puedeCrear    = ctx.can('parametros','escribir');
  const puedeEditar   = ctx.can('parametros','editar');
  const puedeEliminar = ctx.can('parametros','eliminar');

  async function cargar(){
    body.innerHTML = '<div class="loading">Cargando...</div>';
    let lista=[];
    try{ const r = await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) lista=r; }catch(e){}
    render(lista);
  }

  function render(lista){
    body.innerHTML =
      '<h3 style="margin-top:0">Tamanos de volqueta</h3>'+
      '<p class="lead">Capacidad y minimo en toneladas. La capacidad calcula los viajes; el minimo es lo que reserva el cupo por viaje.</p>'+
      (puedeCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="btnNueva">+ Agregar tamano</button></div>':'')+
      (lista.length? tabla(lista) : '<div class="empty">Aun no hay tamanos.</div>')+
      '<div class="note">Viajes = toneladas / capacidad (redondeo hacia arriba). El minimo por viaje es lo que reserva el cupo.</div>';
    if(puedeCrear) body.querySelector('#btnNueva').onclick=()=>form(null);
    body.querySelectorAll('[data-edit]').forEach(b=>{ const i=+b.dataset.edit; b.onclick=()=>form(lista[i]); });
    body.querySelectorAll('[data-anular]').forEach(b=>{ const i=+b.dataset.anular; b.onclick=()=>anular(lista[i]); });
  }

  function tabla(lista){
    return '<table class="mtable"><tr><th>Tamano</th><th style="text-align:right">Capacidad (t)</th><th style="text-align:right">Minimo (t)</th><th>Estado</th><th></th></tr>'+
      lista.map((vq,i)=>{
        const acts =
          (puedeEditar  ?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (puedeEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'');
        return '<tr><td><b>'+esc(vq.nombre)+'</b></td>'+
          '<td style="text-align:right" class="mono">'+numEs(vq.capacidad_t)+'</td>'+
          '<td style="text-align:right" class="mono">'+numEs(vq.minimo_t)+'</td>'+
          '<td><span class="badge '+(vq.activa?'ok':'off')+'">'+(vq.activa?'Activa':'Inactiva')+'</span></td>'+
          '<td><div class="rowbtns">'+(acts||'<span class="mono" style="color:#C9C9C1;font-size:11px">solo lectura</span>')+'</div></td></tr>';
      }).join('')+'</table>';
  }

  function form(vq){
    const esNueva = !vq;
    body.innerHTML =
      '<h3 style="margin-top:0">'+(esNueva?'Nuevo tamano':'Editar tamano')+'</h3>'+
      '<div class="field"><label>Nombre (ej. 7 m3)</label><input id="q_nombre" value="'+(esNueva?'':esc(vq.nombre))+'"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Capacidad (t)</label><input id="q_cap" value="'+(esNueva?'':numEs(vq.capacidad_t))+'"></div>'+
        '<div class="field"><label>Minimo por viaje (t)</label><input id="q_min" value="'+(esNueva?'':numEs(vq.minimo_t))+'"></div>'+
      '</div>'+
      (esNueva?'':'<div class="field"><label>Estado</label><select id="q_activa"><option value="true"'+(vq.activa?' selected':'')+'>Activa</option><option value="false"'+(!vq.activa?' selected':'')+'>Inactiva</option></select></div>')+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>';
    body.querySelector('#bCancel').onclick=cargar;
    body.querySelector('#bSave').onclick=async function(){
      const btn=this; const nombre=v(body,'q_nombre');
      const cap=parseNum(v(body,'q_cap')), min=parseNum(v(body,'q_min'));
      if(!nombre){ ctx.toast('Escribe el nombre del tamano.','error'); return; }
      if(cap<=0){ ctx.toast('La capacidad debe ser mayor a 0.','error'); return; }
      const activa = esNueva ? true : (body.querySelector('#q_activa').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{
        const res = await ctx.rpc('rcd_volqueta_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id,
          p_id: esNueva?null:vq.id, p_nombre:nombre, p_capacidad:cap, p_minimo:min, p_activa:activa
        });
        const r = scalar(res);
        if(r==='OK'){ ctx.toast('Tamano guardado'); cargar(); return; }
        if(r==='CAPACIDAD_INVALIDA') ctx.toast('La capacidad debe ser mayor a 0.','error');
        else if(r==='SIN_PERMISO') ctx.toast('No tienes permiso.','error');
        else if(r==='NOMBRE_VACIO') ctx.toast('El nombre no puede ir vacio.','error');
        else ctx.toast('No se pudo guardar.','error');
      }catch(e){ ctx.toast('Error de conexion al guardar.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anular(vq){
    if(!(await ctx.confirm('Anular el tamano "'+vq.nombre+'"? Se ocultara, pero el historico queda.'))) return;
    try{
      const res = await ctx.rpc('rcd_volqueta_anular',{p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:vq.id});
      const r = scalar(res);
      if(r==='OK'){ ctx.toast('Tamano anulado'); cargar(); return; }
      if(r==='SIN_PERMISO') ctx.toast('No tienes permiso para anular.','error');
      else ctx.toast('No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  cargar();
}

// ---------- Pestana MUNICIPIOS (Paso A: municipios + metas + comunas) ----------
async function municipios(body, ctx){
  const pCrear=ctx.can('parametros','escribir'), pEditar=ctx.can('parametros','editar'), pEliminar=ctx.can('parametros','eliminar');

  // ===== Nivel 1: lista de municipios =====
  async function listaMun(){
    body.innerHTML='<div class="loading">Cargando...</div>';
    let lista=[]; try{ const r=await ctx.rpc('rcd_municipios_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) lista=r; }catch(e){}
    body.innerHTML=
      '<h3 style="margin-top:0">Municipios</h3>'+
      '<p class="lead">Cada municipio tiene sus metas de aprovechamiento y sus comunas. Las tarifas de transporte van en el siguiente paso.</p>'+
      (pCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="bNuevo">+ Agregar municipio</button></div>':'')+
      (lista.length?
        '<table class="mtable"><tr><th>Municipio</th><th>Comunas</th><th style="text-align:right">Meta vigente</th><th>Estado</th><th></th></tr>'+
        lista.map((m,i)=>'<tr><td><b>'+esc(m.nombre)+'</b></td><td class="mono">'+m.n_comunas+'</td>'+
          '<td style="text-align:right" class="mono">'+(m.meta_vigente==null?'<span style="color:#C9C9C1">sin meta</span>':numEs(m.meta_vigente)+'%')+'</td>'+
          '<td><span class="badge '+(m.activo?'ok':'off')+'">'+(m.activo?'Activo':'Inactivo')+'</span></td>'+
          '<td><div class="rowbtns"><button class="btn ghost sm" data-open="'+i+'">Gestionar</button>'+
          (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay municipios.</div>');
    if(pCrear) body.querySelector('#bNuevo').onclick=()=>formMun(null);
    body.querySelectorAll('[data-open]').forEach(b=>{const i=+b.dataset.open; b.onclick=()=>detalle(lista[i]);});
    body.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>formMun(lista[i]);});
    body.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anularMun(lista[i]);});
  }

  function formMun(m){
    const esNuevo=!m;
    body.innerHTML=
      '<h3 style="margin-top:0">'+(esNuevo?'Nuevo municipio':'Editar municipio')+'</h3>'+
      '<div class="field"><label>Nombre</label><input id="m_nombre" value="'+(esNuevo?'':esc(m.nombre))+'"></div>'+
      (esNuevo?'':'<div class="field"><label>Estado</label><select id="m_activo"><option value="true"'+(m.activo?' selected':'')+'>Activo</option><option value="false"'+(!m.activo?' selected':'')+'>Inactivo</option></select></div>')+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>';
    body.querySelector('#bCancel').onclick=listaMun;
    body.querySelector('#bSave').onclick=async function(){
      const btn=this, nombre=v(body,'m_nombre'); if(!nombre){ ctx.toast('Escribe el nombre.','error'); return; }
      const activo=esNuevo?true:(body.querySelector('#m_activo').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_municipio_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:esNuevo?null:m.id,p_nombre:nombre,p_activo:activo}));
        if(r==='OK'){ ctx.toast('Municipio guardado'); listaMun(); return; }
        ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.','error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularMun(m){
    if(!(await ctx.confirm('Anular el municipio "'+m.nombre+'"? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_municipio_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:m.id}));
      if(r==='OK'){ ctx.toast('Municipio anulado'); listaMun(); return; }
      ctx.toast(r==='TIENE_OBRAS'?'No se puede anular: tiene obras asociadas.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.'),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===== Nivel 2: detalle del municipio (metas + comunas) =====
  function detalle(m){
    body.innerHTML=
      '<button class="btn ghost sm" id="bBack">&larr; Municipios</button>'+
      '<h3 style="margin:12px 0 2px">'+esc(m.nombre)+'</h3>'+
      '<div id="secMetas" style="margin-top:14px"></div>'+
      '<div id="secComunas" style="margin-top:22px"></div>';
    body.querySelector('#bBack').onclick=listaMun;
    metas(m); comunas(m);
  }

  // ----- METAS -----
  async function metas(m){
    const cont=body.querySelector('#secMetas');
    cont.innerHTML='<div class="loading">Cargando metas...</div>';
    let lista=[]; try{ const r=await ctx.rpc('rcd_metas_lista',{p_municipio_id:m.id}); if(Array.isArray(r)) lista=r; }catch(e){}
    cont.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px"><b>Metas de aprovechamiento</b>'+
        (pCrear?'<button class="btn ghost sm" id="bNuevaMeta" style="margin-left:auto">+ Meta</button>':'')+'</div>'+
      (lista.length?
        '<table class="mtable"><tr><th>Desde</th><th>Hasta</th><th style="text-align:right">Meta</th><th></th></tr>'+
        lista.map((x,i)=>'<tr><td class="mono">'+esc(x.vigencia_desde)+'</td>'+
          '<td class="mono">'+(x.vigencia_hasta?esc(x.vigencia_hasta):'indefinida')+'</td>'+
          '<td style="text-align:right" class="mono">'+numEs(x.porcentaje)+'%</td>'+
          '<td><div class="rowbtns">'+
            (pEditar?'<button class="btn ghost sm" data-emeta="'+i+'">Editar</button>':'')+
            (pEliminar?'<button class="btn ghost sm" data-ameta="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Sin metas. Agrega la vigente.</div>');
    if(pCrear) cont.querySelector('#bNuevaMeta').onclick=()=>formMeta(m,null,cont);
    cont.querySelectorAll('[data-emeta]').forEach(b=>{const i=+b.dataset.emeta; b.onclick=()=>formMeta(m,lista[i],cont);});
    cont.querySelectorAll('[data-ameta]').forEach(b=>{const i=+b.dataset.ameta; b.onclick=()=>anularMeta(m,lista[i]);});
  }

  function formMeta(m,x,cont){
    const esNueva=!x;
    cont.innerHTML=
      '<b>'+(esNueva?'Nueva meta':'Editar meta')+'</b>'+
      '<div class="row2" style="margin-top:8px">'+
        '<div class="field"><label>Vigente desde</label><input type="date" id="me_desde" value="'+(esNueva?'':esc(x.vigencia_desde))+'"></div>'+
        '<div class="field"><label>Hasta (opcional)</label><input type="date" id="me_hasta" value="'+(esNueva||!x.vigencia_hasta?'':esc(x.vigencia_hasta))+'"></div>'+
      '</div>'+
      '<div class="field"><label>Meta de aprovechamiento (%)</label><input id="me_pct" value="'+(esNueva?'':numEs(x.porcentaje))+'"></div>'+
      '<div style="display:flex;gap:10px"><button class="btn ghost" id="bC">Cancelar</button><button class="btn primary" id="bS">Guardar</button></div>';
    cont.querySelector('#bC').onclick=()=>metas(m);
    cont.querySelector('#bS').onclick=async function(){
      const btn=this, desde=v(cont,'me_desde'), hasta=v(cont,'me_hasta'), pct=parseNum(v(cont,'me_pct'));
      if(!desde){ ctx.toast('Pon la fecha "desde".','error'); return; }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_meta_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:esNueva?null:x.id,p_municipio_id:m.id,p_desde:desde,p_hasta:hasta||null,p_porcentaje:pct}));
        if(r==='OK'){ ctx.toast('Meta guardada'); metas(m); return; }
        ctx.toast(r==='RANGO_INVALIDO'?'La fecha "hasta" no puede ser antes de "desde".':(r==='PORCENTAJE_INVALIDO'?'El % debe estar entre 0 y 100.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.')),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularMeta(m,x){
    if(!(await ctx.confirm('Anular esta meta ('+numEs(x.porcentaje)+'%)?'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_meta_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:x.id}));
      if(r==='OK'){ ctx.toast('Meta anulada'); metas(m); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ----- COMUNAS -----
  async function comunas(m){
    const cont=body.querySelector('#secComunas');
    cont.innerHTML='<div class="loading">Cargando comunas...</div>';
    let lista=[]; try{ const r=await ctx.rpc('rcd_comunas_lista',{p_municipio_id:m.id}); if(Array.isArray(r)) lista=r; }catch(e){}
    cont.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px"><b>Comunas / zonas</b>'+
        (pCrear?'<button class="btn ghost sm" id="bNuevaComuna" style="margin-left:auto">+ Comuna</button>':'')+'</div>'+
      (lista.length?
        '<table class="mtable"><tr><th>Comuna</th><th>Estado</th><th></th></tr>'+
        lista.map((c,i)=>'<tr><td><b>'+esc(c.nombre)+'</b></td>'+
          '<td><span class="badge '+(c.activa?'ok':'off')+'">'+(c.activa?'Activa':'Inactiva')+'</span></td>'+
          '<td><div class="rowbtns">'+
            '<button class="btn ghost sm" data-tcom="'+i+'">Tarifas</button>'+
            (pEditar?'<button class="btn ghost sm" data-ecom="'+i+'">Editar</button>':'')+
            (pEliminar?'<button class="btn ghost sm" data-acom="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Sin comunas.</div>');
    if(pCrear) cont.querySelector('#bNuevaComuna').onclick=()=>formComuna(m,null,cont);
    cont.querySelectorAll('[data-tcom]').forEach(b=>{const i=+b.dataset.tcom; b.onclick=()=>tarifasComuna(m,lista[i]);});
    cont.querySelectorAll('[data-ecom]').forEach(b=>{const i=+b.dataset.ecom; b.onclick=()=>formComuna(m,lista[i],cont);});
    cont.querySelectorAll('[data-acom]').forEach(b=>{const i=+b.dataset.acom; b.onclick=()=>anularComuna(m,lista[i]);});
  }

  function formComuna(m,c,cont){
    const esNueva=!c;
    cont.innerHTML=
      '<b>'+(esNueva?'Nueva comuna':'Editar comuna')+'</b>'+
      '<div class="field" style="margin-top:8px"><label>Nombre</label><input id="c_nombre" value="'+(esNueva?'':esc(c.nombre))+'"></div>'+
      (esNueva?'':'<div class="field"><label>Estado</label><select id="c_activa"><option value="true"'+(c.activa?' selected':'')+'>Activa</option><option value="false"'+(!c.activa?' selected':'')+'>Inactiva</option></select></div>')+
      '<div style="display:flex;gap:10px"><button class="btn ghost" id="bC2">Cancelar</button><button class="btn primary" id="bS2">Guardar</button></div>';
    cont.querySelector('#bC2').onclick=()=>comunas(m);
    cont.querySelector('#bS2').onclick=async function(){
      const btn=this, nombre=v(cont,'c_nombre'); if(!nombre){ ctx.toast('Escribe el nombre.','error'); return; }
      const activa=esNueva?true:(cont.querySelector('#c_activa').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_comuna_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:esNueva?null:c.id,p_municipio_id:m.id,p_nombre:nombre,p_activa:activa}));
        if(r==='OK'){ ctx.toast('Comuna guardada'); comunas(m); return; }
        ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.','error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularComuna(m,c){
    if(!(await ctx.confirm('Anular la comuna "'+c.nombre+'"? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_comuna_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:c.id}));
      if(r==='OK'){ ctx.toast('Comuna anulada'); comunas(m); return; }
      ctx.toast(r==='TIENE_OBRAS'?'No se puede anular: tiene obras asociadas.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.'),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ----- TARIFAS (por comuna x tamano) -----
  async function tarifasComuna(m, c){
    const cont=body.querySelector('#secComunas');
    const puedeGuardar = pEditar || pCrear;
    cont.innerHTML='<div class="loading">Cargando tarifas...</div>';
    let lista=[]; try{ const r=await ctx.rpc('rcd_tarifas_comuna',{p_gestor_id:ctx.ses.gestor_id, p_comuna_id:c.id}); if(Array.isArray(r)) lista=r; }catch(e){}

    if(!lista.length){
      cont.innerHTML='<button class="btn ghost sm" id="bBackT">&larr; Comunas</button>'+
        '<h4 style="margin:12px 0 6px">Tarifas - '+esc(c.nombre)+'</h4>'+
        '<div class="note warn">Primero crea tamanos de volqueta en la pestana Volquetas.</div>';
      cont.querySelector('#bBackT').onclick=()=>comunas(m); return;
    }

    cont.innerHTML=
      '<button class="btn ghost sm" id="bBackT">&larr; Comunas</button>'+
      '<h4 style="margin:12px 0 2px">Tarifas de transporte - '+esc(c.nombre)+'</h4>'+
      '<p class="lead">Cobro a la constructora y pago al volquetero, por tamano. El margen es informativo (cobro - pago).</p>'+
      '<table class="mtable"><tr><th>Tamano</th><th style="text-align:right">Cobro</th><th style="text-align:right">Pago</th><th style="text-align:right">Margen</th></tr>'+
      lista.map(t=>'<tr data-vq="'+t.volqueta_id+'">'+
        '<td><b>'+esc(t.volqueta_nombre)+'</b></td>'+
        '<td style="text-align:right"><input class="cellnum t_cobro" value="'+numEs(t.cobro)+'" '+(puedeGuardar?'':'readonly')+'></td>'+
        '<td style="text-align:right"><input class="cellnum t_pago" value="'+numEs(t.pago)+'" '+(puedeGuardar?'':'readonly')+'></td>'+
        '<td style="text-align:right" class="mono t_margen">'+numEs(t.cobro - t.pago)+'</td></tr>').join('')+
      '</table>'+
      (puedeGuardar?'<div style="margin-top:14px;text-align:right"><button class="btn primary" id="bSaveT">Guardar tarifas</button></div>':'<div class="note warn">Solo lectura: no tienes permiso para editar tarifas.</div>');

    cont.querySelector('#bBackT').onclick=()=>comunas(m);
    cont.querySelectorAll('tr[data-vq]').forEach(tr=>{
      const recalc=()=>{ const co=parseNum(tr.querySelector('.t_cobro').value), pa=parseNum(tr.querySelector('.t_pago').value); tr.querySelector('.t_margen').textContent=numEs(co-pa); };
      tr.querySelector('.t_cobro').addEventListener('input',recalc);
      tr.querySelector('.t_pago').addEventListener('input',recalc);
    });
    if(puedeGuardar){
      cont.querySelector('#bSaveT').onclick=async function(){
        const btn=this; btn.disabled=true; btn.textContent='Guardando...';
        const datos=Array.from(cont.querySelectorAll('tr[data-vq]')).map(tr=>({
          volqueta_id:tr.dataset.vq, cobro:parseNum(tr.querySelector('.t_cobro').value), pago:parseNum(tr.querySelector('.t_pago').value)
        }));
        try{ const r=scalar(await ctx.rpc('rcd_tarifas_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_comuna_id:c.id,p_datos:datos}));
          if(r==='OK') ctx.toast('Tarifas guardadas');
          else ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.','error');
        }catch(e){ ctx.toast('Error de conexion.','error'); }
        btn.disabled=false; btn.textContent='Guardar tarifas';
      };
    }
  }

  listaMun();
}

// ---------- utilidades ----------
// ---------- Pestana ACTIVIDAD ----------
async function actividad(body, ctx){
  body.innerHTML='<div class="loading">Cargando actividad...</div>';
  const MODS=['Acceso','Solicitudes','Cotizaciones','Recepcion','Despacho','Produccion','Inventario','Liquidacion','Facturacion','Clientes','Volqueteros','Aliados','Precios','Parametros'];
  let usuarios=[]; try{ const r=await ctx.rpc('rcd_actividad_usuarios',{p_gestor_id:ctx.ses.gestor_id}); usuarios=Array.isArray(r)?r:[]; }catch(e){}
  let fUser='', fMod='', fDesde='';
  async function cargar(){
    const cont=body.querySelector('#actBody'); if(cont) cont.innerHTML='<div class="loading">Cargando...</div>';
    let rs=[]; try{ const r=await ctx.rpc('rcd_actividad_lista',{p_gestor_id:ctx.ses.gestor_id,p_usuario_id:fUser||null,p_modulo:fMod||null,p_desde:fDesde||null,p_limit:200}); rs=Array.isArray(r)?r:[]; }catch(e){}
    cont.innerHTML = rs.length?
      '<div style="overflow-x:auto;width:100%"><table class="mtable" style="min-width:680px"><tr><th>Fecha / hora</th><th>Usuario</th><th>Modulo</th><th>Accion</th><th>Detalle</th></tr>'+
      rs.map(a=>'<tr><td class="mono" style="white-space:nowrap">'+esc((a.creado_en||'').replace('T',' ').slice(0,16))+'</td>'+
        '<td>'+esc(a.usuario_nombre||'')+(a.es_admin?' <span class="badge esc">Admin</span>':'')+'</td>'+
        '<td><span class="badge off">'+esc(a.modulo||'')+'</span></td>'+
        '<td>'+esc(a.accion||'')+'</td>'+
        '<td style="color:var(--muted)">'+esc(a.detalle||'')+'</td></tr>').join('')+'</table></div>'
      : '<div class="empty">Sin actividad registrada en este filtro.</div>';
  }
  body.innerHTML=
    '<h3 style="margin:0 0 4px">Actividad de usuarios</h3>'+
    '<p class="lead">Quien hizo que, en que modulo y cuando. Solo lectura.</p>'+
    '<div class="row3" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">'+
      '<div class="field"><label>Usuario</label><select id="aFUser"><option value="">Todos</option>'+
        usuarios.map(u=>'<option value="'+u.usuario_id+'">'+esc(u.usuario_nombre||'')+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>Modulo</label><select id="aFMod"><option value="">Todos</option>'+
        MODS.map(m=>'<option value="'+m+'">'+m+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>Desde</label><input type="date" id="aFDesde"></div>'+
    '</div>'+
    '<div id="actBody"></div>';
  body.querySelector('#aFUser').onchange=e=>{ fUser=e.target.value; cargar(); };
  body.querySelector('#aFMod').onchange=e=>{ fMod=e.target.value; cargar(); };
  body.querySelector('#aFDesde').onchange=e=>{ fDesde=e.target.value; cargar(); };
  cargar();
}

// ---------- Pestana SISTEMA (reiniciar) ----------
async function sistema(body, ctx){
  const esAdmin = (ctx.ses && ctx.ses.rol==='Administrador');
  if(!esAdmin){ body.innerHTML='<div class="note warn">Solo el administrador puede ver y usar el reinicio del sistema.</div>'; return; }
  const GRUPOS=[
    ['operacion','Operacion','recepciones, despachos, ordenes, solicitudes, produccion, inventario'],
    ['comercial','Comercial','cotizaciones, liquidaciones, anticipos'],
    ['obras','Obras','arrastra comercial + operacion'],
    ['clientes','Clientes','arrastra obras + comercial + operacion'],
    ['volqueteros','Volqueteros y volquetas','arrastra comercial + operacion'],
    ['aliados','Aliados de maquila',''],
    ['productos','Productos','arrastra comercial + operacion'],
    ['precios','Lista de precios',''],
    ['usuarios','Usuarios (no administradores)','']
  ];
  const NOM={operacion:'Operacion',comercial:'Comercial',obras:'Obras',clientes:'Clientes',volqueteros:'Volqueteros y volquetas',aliados:'Aliados',productos:'Productos',precios:'Lista de precios',usuarios:'Usuarios no admin'};
  function expandir(sel){
    const g=new Set(sel);
    if(g.has('clientes')) g.add('obras');
    if(g.has('obras')||g.has('productos')||g.has('aliados')||g.has('volqueteros')){ g.add('comercial'); g.add('operacion'); }
    return g;
  }
  body.innerHTML=
    '<div style="border:1.5px solid #F1C9C4;background:#FDF4F3;border-radius:14px;padding:16px 18px">'+
      '<h3 style="margin:0;color:#A02114">Reiniciar sistema</h3>'+
      '<p style="font-size:13px;color:#7a2018;margin:4px 0 12px">Marca SOLO lo que quieres borrar. No se puede deshacer.</p>'+
      '<label class="chk" style="display:flex;gap:8px;align-items:center;margin-bottom:10px;font-weight:700"><input type="checkbox" id="rAll" style="width:auto"> Seleccionar todo</label>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        GRUPOS.map(g=>'<label class="rg" style="display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:#fff;cursor:pointer;font-size:13px">'+
          '<span><input type="checkbox" class="rgrp" value="'+g[0]+'" style="width:auto"> <b>'+g[1]+'</b></span>'+
          (g[2]?'<span style="font-size:11px;color:var(--muted);margin-top:3px">'+g[2]+'</span>':'')+
        '</label>').join('')+
      '</div>'+
      '<div class="note warn" style="margin-top:10px"><b>Aviso de cascada:</b> si marcas un grupo padre, se borran tambien sus dependientes. Te muestro la lista exacta antes de ejecutar.</div>'+
      '<div style="background:var(--ok-soft);border:1px solid #BFE3CB;border-radius:10px;padding:10px;margin:10px 0;font-size:12.5px"><b>Se conserva siempre:</b> administradores, estructura de la app (menu y permisos) y la escombrera.</div>'+
      '<div class="field" style="max-width:300px"><label>Para confirmar, escribe: REINICIAR</label><input id="rConf" placeholder="REINICIAR"></div>'+
      '<button class="btn" id="rGo" style="background:var(--bad);color:#fff">Reiniciar lo seleccionado</button>'+
    '</div>';
  const chAll=body.querySelector('#rAll');
  const chs=Array.from(body.querySelectorAll('.rgrp'));
  chAll.onchange=()=>{ chs.forEach(c=>c.checked=chAll.checked); };
  chs.forEach(c=>c.onchange=()=>{ chAll.checked=chs.every(x=>x.checked); });
  body.querySelector('#rGo').onclick=async()=>{
    const sel=chs.filter(c=>c.checked).map(c=>c.value);
    if(sel.length===0){ ctx.toast('Marca al menos un grupo.','error'); return; }
    if((body.querySelector('#rConf').value||'').trim().toUpperCase()!=='REINICIAR'){ ctx.toast('Escribe REINICIAR para confirmar.','error'); return; }
    const full=Array.from(expandir(sel)).map(k=>NOM[k]||k);
    const ok=await ctx.confirm('Se borrara: '+full.join(', ')+'. Esto NO se puede deshacer. Los administradores y la configuracion se conservan. ¿Confirmas?',{ok:'Si, reiniciar',cancel:'Cancelar'});
    if(!ok) return;
    const btn=body.querySelector('#rGo'); btn.disabled=true; btn.textContent='Reiniciando...';
    try{ const r=scalar(await ctx.rpc('rcd_sistema_reiniciar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_grupos:sel}));
      if(r==='OK'){ ctx.toast('Sistema reiniciado'); sistema(body,ctx); return; }
      else if(r==='SOLO_ADMIN'){ ctx.toast('Solo el administrador.','error'); }
      else if(r==='NADA_SELECCIONADO'){ ctx.toast('No seleccionaste nada.','error'); }
      else ctx.toast('No se pudo: '+r,'error');
    }catch(e){ ctx.toast('Error al reiniciar.','error'); }
    btn.disabled=false; btn.textContent='Reiniciar lo seleccionado';
  };
}

function numEs(n){ return (n==null?'':String(n).replace('.',',')); }
function parseNum(s){ return parseFloat(String(s||'').replace(',','.'))||0; }
function scalar(res){ return Array.isArray(res) ? res[0] : res; }
function esc(s){ return (s==null?'':String(s)).replace(/"/g,'&quot;'); }
function ro(puede){ return puede ? '' : 'readonly'; }
function v(scope,id){ const e=scope.querySelector('#'+id); return e ? e.value.trim() : ''; }

function comprimirLogo(file, cb){
  const reader = new FileReader();
  reader.onload = e=>{
    const img = new Image();
    img.onload = ()=>{
      const max = 320; let w = img.width, h = img.height;
      if(w>h && w>max){ h = Math.round(h*max/w); w = max; }
      else if(h>=w && h>max){ w = Math.round(w*max/h); h = max; }
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      cb(c.toDataURL('image/png')); // PNG conserva transparencia
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
