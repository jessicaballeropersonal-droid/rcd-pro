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

  // Sigla automatica del aliado: 3 primeras letras del nombre, sin tildes ni espacios
  function siglaDe(nombre){
    return (nombre||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').slice(0,3);
  }

  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let as=[]; try{ const r=await ctx.rpc('rcd_aliados_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) as=r; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:900px">'+
      '<h3 style="margin-top:0">Aliados de maquila</h3>'+
      '<p class="lead">Maquila = otra planta que te procesa el RCD (vuelve a ti). Receptor = quien usa el RCD como materia prima (no vuelve, genera Anexo VI).</p>'+
      (as.length?
        '<table class="mtable"><tr><th>Aliado</th><th>Sigla</th><th>NIT</th><th>Municipio</th><th>Tipo</th><th style="text-align:right">Maquila $/t</th><th>Estado</th><th></th></tr>'+
        as.map((a,i)=>'<tr><td><b>'+esc(a.razon_social)+'</b></td><td class="mono" style="color:#0F766E">'+siglaDe(a.razon_social)+'</td><td class="mono">'+esc(a.nit||'')+'</td>'+
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
    const ro=' readonly style="background:#F0F0EC"';
    const tns='<span style="color:#8A8A82;font-weight:400">&middot; TNS</span>';
    el.innerHTML=
      '<div class="mcard" style="max-width:760px">'+
      '<h3 style="margin-top:0">Editar aliado</h3>'+
      '<div class="note" style="margin-bottom:10px">La identidad viene de TNS (solo lectura). El tipo (maquila/receptor) se define en Terceros. El precio de maquila esta en Lista de precios.</div>'+
      '<div class="field"><label>Nombre o razon social '+tns+'</label><input value="'+esc(a.razon_social||'')+'"'+ro+'></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Documento / NIT '+tns+'</label><input value="'+esc(a.nit||'')+'"'+ro+'></div>'+
        '<div class="field"><label>Representante legal '+tns+'</label><input value="'+esc(a.rep_legal||'')+'"'+ro+'></div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Telefono '+tns+'</label><input value="'+esc(a.telefono||'')+'"'+ro+'></div>'+
        '<div class="field"><label>Correo '+tns+'</label><input value="'+esc(a.correo||'')+'"'+ro+'></div>'+
      '</div>'+
      '<div class="field"><label>Direccion '+tns+'</label><input value="'+esc(a.direccion||'')+'"'+ro+'></div>'+
      '<div class="row2">'+
        '<div class="field"><label>Municipio o distrito</label><input id="a_mun" value="'+esc(a.municipio||'')+'"></div>'+
        '<div class="field"><label>N.&ordm; inscripcion ante la autoridad (opcional)</label><input id="a_insc" value="'+esc(a.numero_inscripcion||'')+'"></div>'+
      '</div>'+
      '<div class="field"><label>Tipo</label><div>'+
        (a.es_maquila?'<span class="badge ok" style="margin-right:4px">Maquila</span>':'')+
        (a.es_receptor?'<span class="badge warn">Receptor</span>':'')+
        ((!a.es_maquila&&!a.es_receptor)?'<span class="badge off">sin tipo</span>':'')+
        ' <span class="note" style="font-size:11px">Se define en Terceros</span></div></div>'+
      '<div class="field"><label>Estado</label><select id="a_activo"><option value="true"'+(a.activo?' selected':'')+'>Activo</option><option value="false"'+(!a.activo?' selected':'')+'>Inactivo</option></select></div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>'+
      '</div>';
    el.querySelector('#bCancel').onclick=lista;
    el.querySelector('#bSave').onclick=async function(){
      const btn=this;
      const activo=(el.querySelector('#a_activo').value==='true');
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_aliado_guardar',{
          p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:a.id,
          p_razon:a.razon_social||'', p_nit:a.nit||'', p_rep:a.rep_legal||'', p_direccion:a.direccion||'',
          p_telefono:a.telefono||'', p_correo:a.correo||'', p_municipio:v(el,'a_mun'),
          p_inscripcion:v(el,'a_insc'), p_es_maquila:!!a.es_maquila, p_es_receptor:!!a.es_receptor,
          p_precio: +a.precio_maquila_t||0}));
        if(r==='OK'){ ctx.toast('Aliado guardado'); lista(); return; }
        ctx.toast(r==='TIPO_VACIO'?'Este aliado no tiene tipo. Clasificalo en Terceros.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.'),'error');
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
