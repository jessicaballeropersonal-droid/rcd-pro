// ============================================================
// RCD PRO · Modulo Aliados de maquila / receptores
// (usa helpers globales de mod-parametros.js: esc, scalar, v)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.aliados = function(el, ctx){
  const pCrear=ctx.can('aliados','escribir'), pEditar=ctx.can('aliados','editar'), pEliminar=ctx.can('aliados','eliminar');

  function tipos(a){
    let t='';
    if(a.es_maquila)  t+='<span class="badge ok" style="margin-right:4px">Maquila</span>';
    if(a.es_receptor) t+='<span class="badge warn">Receptor</span>';
    return t||'<span class="badge off">-</span>';
  }

  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let as=[]; try{ const r=await ctx.rpc('rcd_aliados_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) as=r; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<h3 style="margin-top:0">Aliados de maquila</h3>'+
      '<p class="lead">Maquila = otra planta que te procesa el RCD (vuelve a ti). Receptor = quien usa el RCD como materia prima (no vuelve, genera Anexo VI).</p>'+
      (as.length?
        '<table class="mtable"><tr><th>Aliado</th><th>NIT</th><th>Municipio</th><th>Tipo</th><th style="text-align:right">Maquila $/t</th><th>Estado</th><th></th></tr>'+
        as.map((a,i)=>'<tr><td><b>'+esc(a.razon_social)+'</b></td><td class="mono">'+esc(a.nit||'')+'</td>'+
          '<td>'+esc(a.municipio||'')+'</td><td>'+tipos(a)+'</td>'+
          '<td style="text-align:right" class="mono">'+(a.es_maquila?numEs(a.precio_maquila_t):'-')+'</td>'+
          '<td><span class="badge '+(a.activo?'ok':'off')+'">'+(a.activo?'Activo':'Inactivo')+'</span></td>'+
          '<td><div class="rowbtns">'+
          (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay aliados.</div>')+
      '</div>';
    el.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>form(as[i]);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anular(as[i]);});
  }

  function form(a){
    const nuevo=!a;
    el.innerHTML=
      '<div class="mcard" style="max-width:760px">'+
      '<h3 style="margin-top:0">'+(nuevo?'Nuevo aliado':'Editar aliado')+'</h3>'+
      '<div class="field"><label>Nombre o razon social</label><input id="a_razon" value="'+(nuevo?'':esc(a.razon_social))+'"></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Documento / NIT</label><input id="a_nit" value="'+(nuevo?'':esc(a.nit||''))+'"></div>'+
        '<div class="field"><label>Representante legal</label><input id="a_rep" value="'+(nuevo?'':esc(a.rep_legal||''))+'"></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Telefono</label><input id="a_tel" value="'+(nuevo?'':esc(a.telefono||''))+'"></div>'+
        '<div class="field"><label>Correo</label><input id="a_correo" value="'+(nuevo?'':esc(a.correo||''))+'"></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Direccion</label><input id="a_dir" value="'+(nuevo?'':esc(a.direccion||''))+'"></div>'+
        '<div class="field"><label>Municipio o distrito</label><input id="a_mun" value="'+(nuevo?'':esc(a.municipio||''))+'"></div>'+
      '</div>'+
      '<div class="field"><label>N.º inscripcion ante la autoridad (opcional)</label><input id="a_insc" value="'+(nuevo?'':esc(a.numero_inscripcion||''))+'" placeholder="aplica a maquila/gestor"></div>'+
      '<div class="field"><label>Tipo de aliado (marca una o ambas)</label>'+
        '<label class="chk"><input type="checkbox" id="a_maq" '+(!nuevo&&a.es_maquila?'checked':'')+'><span>Maquila (me procesa el RCD y vuelve a mi)</span></label>'+
        '<label class="chk"><input type="checkbox" id="a_rec" '+(!nuevo&&a.es_receptor?'checked':'')+'><span>Receptor (usa el RCD como materia prima, genera Anexo VI)</span></label>'+
      '</div>'+
      '<div class="field" id="a_precio_wrap"><label>Precio de maquila ($/t)</label><input id="a_precio" class="cellnum" style="width:160px" value="'+(nuevo?'':numEs(a.precio_maquila_t))+'"><div class="note">Precio por tonelada que te cobra esta maquila. Sera el valor por defecto en cada envio (editable alli).</div></div>'+
      (nuevo?'':'<div class="field"><label>Estado</label><select id="a_activo"><option value="true"'+(a.activo?' selected':'')+'>Activo</option><option value="false"'+(!a.activo?' selected':'')+'>Inactivo</option></select></div>')+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>'+
      '</div>';
    el.querySelector('#bCancel').onclick=lista;
    const maqChk=el.querySelector('#a_maq'), precioWrap=el.querySelector('#a_precio_wrap');
    function togglePrecio(){ precioWrap.style.display = maqChk.checked ? '' : 'none'; }
    maqChk.onchange=togglePrecio; togglePrecio();
    el.querySelector('#bSave').onclick=async function(){
      const btn=this, razon=v(el,'a_razon'); if(!razon){ ctx.toast('Escribe el nombre o razon social.','error'); return; }
      const maq=el.querySelector('#a_maq').checked, rec=el.querySelector('#a_rec').checked;
      if(!maq && !rec){ ctx.toast('Marca al menos un tipo: maquila o receptor.','error'); return; }
      const activo=nuevo?true:(el.querySelector('#a_activo').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_aliado_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:nuevo?null:a.id,
          p_razon:razon, p_nit:v(el,'a_nit'), p_rep:v(el,'a_rep'), p_direccion:v(el,'a_dir'),
          p_telefono:v(el,'a_tel'), p_correo:v(el,'a_correo'), p_municipio:v(el,'a_mun'),
          p_inscripcion:v(el,'a_insc'), p_es_maquila:maq, p_es_receptor:rec,
          p_precio: maq ? parseNum(v(el,'a_precio')) : 0}));
        if(r==='OK'){ ctx.toast('Aliado guardado'); lista(); return; }
        ctx.toast(r==='TIPO_VACIO'?'Marca al menos un tipo.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.'),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anular(a){
    if(!(await ctx.confirm('Anular el aliado "'+a.razon_social+'"? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_aliado_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:a.id}));
      if(r==='OK'){ ctx.toast('Aliado anulado'); lista(); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  lista();
};
