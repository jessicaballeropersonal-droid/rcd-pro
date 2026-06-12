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

// ---------- utilidades ----------
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
