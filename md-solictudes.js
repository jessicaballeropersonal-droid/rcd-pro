// ============================================================
// RCD PRO · Modulo Solicitudes (Paso A: cabecera)
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.solicitudes = function(el, ctx){
  const pCrear=ctx.can('solicitudes','escribir'), pEditar=ctx.can('solicitudes','editar'), pEliminar=ctx.can('solicitudes','eliminar');
  function badgeTipo(t){ return t==='despacho' ? '<span class="badge warn">Despacho</span>' : '<span class="badge ok">Recepcion</span>'; }
  function badgeEstado(e){ return e==='cerrada'?'<span class="badge off">Cerrada</span>':'<span class="badge ok">Abierta</span>'; }

  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let ss=[]; try{ const r=await ctx.rpc('rcd_solicitudes_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) ss=r; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:1000px">'+
      '<h3 style="margin-top:0">Solicitudes y ordenes</h3>'+
      '<p class="lead">Se crean sobre obras con cotizacion aceptada. Cada solicitud declara una cantidad (parcial del total de la obra).</p>'+
      (pCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="bNueva">+ Nueva solicitud</button></div>':'')+
      (ss.length?
        '<table class="mtable"><tr><th>N.º</th><th>Cliente / obra</th><th>Tipo</th><th>Detalle</th><th style="text-align:right">Declarado (t)</th><th>Fecha</th><th>Estado</th><th></th></tr>'+
        ss.map((s,i)=>'<tr><td class="mono"><b>'+esc(s.numero||'')+'</b></td>'+
          '<td>'+esc(s.cliente||'')+'<br><span style="font-size:12px;color:var(--muted)">'+esc(s.obra||'')+'</span></td>'+
          '<td>'+badgeTipo(s.tipo)+'</td>'+
          '<td>'+(s.tipo==='despacho'?esc(s.producto||''):'RCD')+'</td>'+
          '<td style="text-align:right" class="mono">'+numEs(s.cantidad_declarada)+'</td>'+
          '<td class="mono">'+esc(s.fecha||'')+'</td>'+
          '<td>'+badgeEstado(s.estado)+'</td>'+
          '<td><div class="rowbtns">'+
          (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay solicitudes.</div>')+
      '</div>';
    if(pCrear) el.querySelector('#bNueva').onclick=()=>form(null,ss);
    el.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>form(ss[i],ss);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anular(ss[i]);});
  }

  async function form(s, ss){
    const nuevo=!s;
    let obras=[]; try{ const r=await ctx.rpc('rcd_obras_cotizadas',{p_gestor_id:ctx.ses.gestor_id}); obras=Array.isArray(r)?r:[]; }catch(e){}
    let productos=[]; try{ const r=await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); productos=(Array.isArray(r)?r:[]).filter(p=>p.activo); }catch(e){}

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
          p_cantidad:parseNum(inpCant.value), p_fecha:v(el,'s_fecha')||null, p_observaciones:v(el,'s_obs')}));
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

  lista();
};
