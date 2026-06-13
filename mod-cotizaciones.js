// ============================================================
// RCD PRO · Modulo Cotizaciones
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.cotizaciones = function(el, ctx){
  const pCrear=ctx.can('cotizaciones','escribir'), pEditar=ctx.can('cotizaciones','editar'), pEliminar=ctx.can('cotizaciones','eliminar');
  function money(n){ return '$ '+Math.round(+n||0).toLocaleString('es-CO'); }
  function badgeEstado(e){
    if(e==='aceptada') return '<span class="badge ok">Aceptada</span>';
    if(e==='rechazada') return '<span class="badge danger">Rechazada</span>';
    return '<span class="badge off">Borrador</span>';
  }

  // ===================== LISTA =====================
  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let cs=[]; try{ const r=await ctx.rpc('rcd_cotizaciones_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) cs=r; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:1000px">'+
      '<h3 style="margin-top:0">Cotizaciones</h3>'+
      '<p class="lead">Disposicion + transporte + producto. Al aceptar una cotizacion se habilita la obra.</p>'+
      (pCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="bNueva">+ Nueva cotizacion</button></div>':'')+
      (cs.length?
        '<table class="mtable"><tr><th>N.º</th><th>Cliente / obra</th><th>Fecha</th><th style="text-align:right">Total</th><th>Estado</th><th></th></tr>'+
        cs.map((c,i)=>'<tr><td class="mono"><b>'+esc(c.numero||'')+'</b></td>'+
          '<td>'+esc(c.cliente||'')+'<br><span style="font-size:12px;color:var(--muted)">'+esc(c.obra||'')+'</span></td>'+
          '<td class="mono">'+esc(c.fecha||'')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(c.total)+'</td>'+
          '<td>'+badgeEstado(c.estado)+'</td>'+
          '<td><div class="rowbtns"><button class="btn ghost sm" data-open="'+i+'">Abrir</button>'+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay cotizaciones.</div>')+
      '</div>';
    if(pCrear) el.querySelector('#bNueva').onclick=()=>abrirEditor(null);
    el.querySelectorAll('[data-open]').forEach(b=>{const i=+b.dataset.open; b.onclick=()=>abrirEditor(cs[i].id);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anular(cs[i]);});
  }

  async function anular(c){
    if(!(await ctx.confirm('Anular la cotizacion '+(c.numero||'')+'? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_cotizacion_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:c.id}));
      if(r==='OK'){ ctx.toast('Cotizacion anulada'); lista(); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===================== EDITOR =====================
  async function abrirEditor(cotId){
    const st={ id:null, numero:'', cliente_id:'', obra_id:'', obra:'', comuna_id:'', fecha:'', valida_hasta:'',
               observaciones:'', estado:'borrador', lineas:[], productos:[], tarifas:[], precioDisp:0, precioGen:0, clientes:[], obrasOpts:[] };
    try{ const r=await ctx.rpc('rcd_clientes_lista',{p_gestor_id:ctx.ses.gestor_id}); st.clientes=Array.isArray(r)?r:[]; }catch(e){}

    if(cotId){
      try{
        const cab=(await ctx.rpc('rcd_cotizacion_get',{p_id:cotId}))[0];
        st.id=cab.id; st.numero=cab.numero; st.cliente_id=cab.cliente_id||''; st.obra_id=cab.obra_id||''; st.obra=cab.obra||'';
        st.comuna_id=cab.comuna_id||''; st.fecha=cab.fecha||''; st.valida_hasta=cab.valida_hasta||'';
        st.observaciones=cab.observaciones||''; st.estado=cab.estado||'borrador';
        const lins=await ctx.rpc('rcd_cotizacion_lineas_get',{p_cotizacion_id:cotId});
        st.lineas=(Array.isArray(lins)?lins:[]).map(l=>({tipo:l.tipo,descripcion:l.descripcion,producto_id:l.producto_id||'',tamano_id:l.tamano_id||'',cantidad:l.cantidad,precio_unit:l.precio_unit,aplica_iva:l.aplica_iva}));
        if(st.cliente_id){ const r=await ctx.rpc('rcd_obras_lista',{p_cliente_id:st.cliente_id}); st.obrasOpts=Array.isArray(r)?r:[]; }
        await cargarContexto(st);
      }catch(e){ ctx.toast('No se pudo cargar la cotizacion.','error'); }
    }
    renderEditor(st);
  }

  async function cargarContexto(st){
    try{ const r=await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); st.productos=(Array.isArray(r)?r:[]).filter(p=>p.activo); }catch(e){ st.productos=[]; }
    try{ const r=await ctx.rpc('rcd_precio_disposicion',{p_gestor_id:ctx.ses.gestor_id}); st.precioDisp=parseNum(scalar(r)); }catch(e){ st.precioDisp=0; }
    try{ const r=await ctx.rpc('rcd_precio_generacion',{p_gestor_id:ctx.ses.gestor_id}); st.precioGen=parseNum(scalar(r)); }catch(e){ st.precioGen=0; }
    if(st.comuna_id){ try{ const r=await ctx.rpc('rcd_tarifas_comuna',{p_gestor_id:ctx.ses.gestor_id,p_comuna_id:st.comuna_id}); st.tarifas=Array.isArray(r)?r:[]; }catch(e){ st.tarifas=[]; } }
    else st.tarifas=[];
  }

  function editable(st){ return (st.estado==='borrador') && (pCrear||pEditar); }

  function renderEditor(st){
    const ed=editable(st);
    el.innerHTML=
      '<div class="mcard" style="max-width:1000px">'+
      '<button class="btn ghost sm" id="bBack">&larr; Cotizaciones</button>'+
      '<div style="display:flex;align-items:center;gap:10px;margin:12px 0 2px">'+
        '<h3 style="margin:0">'+(st.id?('Cotizacion '+esc(st.numero||'')):'Nueva cotizacion')+'</h3>'+badgeEstado(st.estado)+'</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Cliente</label>'+(ed?
          '<select id="e_cli"><option value="">Selecciona...</option>'+st.clientes.map(c=>'<option value="'+c.id+'"'+(st.cliente_id===c.id?' selected':'')+'>'+esc(c.razon_social)+'</option>').join('')+'</select>'
          :'<input value="'+esc((st.clientes.find(c=>c.id===st.cliente_id)||{}).razon_social||'')+'" readonly>')+'</div>'+
        '<div class="field"><label>Obra</label>'+(ed?
          '<select id="e_obra"><option value="">Selecciona...</option>'+st.obrasOpts.map(o=>'<option value="'+o.id+'"'+(st.obra_id===o.id?' selected':'')+'>'+esc(o.nombre)+'</option>').join('')+'</select>'
          :'<input value="'+esc(st.obra||'')+'" readonly>')+'</div>'+
      '</div>'+
      '<div class="row2">'+
        '<div class="field"><label>Fecha</label><input type="date" id="e_fecha" value="'+esc(st.fecha||'')+'" '+(ed?'':'readonly')+'></div>'+
        '<div class="field"><label>Valida hasta</label><input type="date" id="e_valida" value="'+esc(st.valida_hasta||'')+'" '+(ed?'':'readonly')+'></div>'+
      '</div>'+
      '<div id="lineasBox"></div>'+
      '<div class="field" style="margin-top:12px"><label>Observaciones</label><input id="e_obs" value="'+esc(st.observaciones||'')+'" '+(ed?'':'readonly')+'></div>'+
      '<div id="accionesBox" style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap"></div>'+
      '</div>';

    el.querySelector('#bBack').onclick=lista;

    if(ed){
      const selCli=el.querySelector('#e_cli'), selObra=el.querySelector('#e_obra');
      selCli.onchange=async ()=>{
        st.cliente_id=selCli.value; st.obra_id=''; st.obra=''; st.comuna_id=''; st.obrasOpts=[];
        if(st.cliente_id){ try{ const r=await ctx.rpc('rcd_obras_lista',{p_cliente_id:st.cliente_id}); st.obrasOpts=Array.isArray(r)?r:[]; }catch(e){} }
        await cargarContexto(st); renderEditor(st);
      };
      selObra.onchange=async ()=>{
        st.obra_id=selObra.value;
        const o=st.obrasOpts.find(x=>x.id===st.obra_id);
        st.obra=o?o.nombre:''; st.comuna_id=o?(o.comuna_id||''):'';
        await cargarContexto(st); renderLineas(st);
      };
      el.querySelector('#e_fecha').onchange=function(){ st.fecha=this.value; };
      el.querySelector('#e_valida').onchange=function(){ st.valida_hasta=this.value; };
      el.querySelector('#e_obs').oninput=function(){ st.observaciones=this.value; };
    }

    renderLineas(st);
    renderAcciones(st);
  }

  function renderAcciones(st){
    const box=el.querySelector('#accionesBox'); if(!box) return;
    let h='';
    if(editable(st)) h+='<button class="btn primary" id="bGuardar">Guardar</button>';
    if(st.id && st.estado==='borrador' && pEditar){
      h+='<button class="btn ghost" id="bAceptar">Aceptar (habilita la obra)</button>';
      h+='<button class="btn ghost" id="bRechazar">Rechazar</button>';
    }
    box.innerHTML=h;
    const g=box.querySelector('#bGuardar'); if(g) g.onclick=()=>guardar(st);
    const a=box.querySelector('#bAceptar'); if(a) a.onclick=()=>cambiarEstado(st,'aceptada');
    const r=box.querySelector('#bRechazar'); if(r) r.onclick=()=>cambiarEstado(st,'rechazada');
  }

  // ---- lineas ----
  function cambiarTipo(st,i,tipo){
    const l=st.lineas[i]; l.tipo=tipo; l.producto_id=''; l.tamano_id='';
    if(tipo==='disposicion'){ l.descripcion='Disposicion de escombros'; l.precio_unit=st.precioDisp; l.aplica_iva=true; }
    else if(tipo==='generacion'){ l.descripcion='Generacion de escombros'; l.precio_unit=st.precioGen; l.aplica_iva=true; }
    else if(tipo==='transporte'){ l.descripcion='Transporte'; l.precio_unit=0; l.aplica_iva=false; }
    else { l.descripcion=''; l.precio_unit=0; l.aplica_iva=true; }
  }
  function aplicarDetalle(st,i,val){
    const l=st.lineas[i];
    if(l.tipo==='transporte'){
      l.tamano_id=val; const t=st.tarifas.find(x=>x.volqueta_id===val);
      if(t){ l.precio_unit=parseNum(t.cobro); l.descripcion='Transporte '+t.volqueta_nombre; }
    } else if(l.tipo==='producto'){
      l.producto_id=val; const p=st.productos.find(x=>x.id===val);
      l.descripcion=p?p.nombre:'';
    }
  }

  function filaLinea(l,i,st,dis){
    let detalle='';
    if(l.tipo==='disposicion') detalle='Disposicion de escombros';
    else if(l.tipo==='generacion') detalle='Generacion de escombros';
    else if(l.tipo==='transporte'){
      detalle = dis ? esc(l.descripcion||'Transporte')
        : '<select data-det="'+i+'"><option value="">Tamano...</option>'+st.tarifas.map(t=>'<option value="'+t.volqueta_id+'"'+(l.tamano_id===t.volqueta_id?' selected':'')+'>'+esc(t.volqueta_nombre)+'</option>').join('')+'</select>';
    } else {
      detalle = dis ? esc(l.descripcion||'')
        : '<select data-det="'+i+'"><option value="">Producto...</option>'+st.productos.map(p=>'<option value="'+p.id+'"'+(l.producto_id===p.id?' selected':'')+'>'+esc(p.nombre)+'</option>').join('')+'</select>';
    }
    const tipoSel = dis ? ({disposicion:'Disposicion',generacion:'Generacion',transporte:'Transporte',producto:'Producto'}[l.tipo]||l.tipo)
      : '<select data-tipo="'+i+'">'+
        '<option value="disposicion"'+(l.tipo==='disposicion'?' selected':'')+'>Disposicion</option>'+
        '<option value="generacion"'+(l.tipo==='generacion'?' selected':'')+'>Generacion</option>'+
        '<option value="transporte"'+(l.tipo==='transporte'?' selected':'')+'>Transporte</option>'+
        '<option value="producto"'+(l.tipo==='producto'?' selected':'')+'>Producto</option></select>';
    const cant = dis ? numEs(l.cantidad) : '<input class="cellnum" data-cant="'+i+'" value="'+numEs(l.cantidad)+'" style="width:90px">';
    const prec = dis ? money(l.precio_unit) : '<input class="cellnum" data-prec="'+i+'" value="'+numEs(l.precio_unit)+'" style="width:110px">';
    const lt=(+l.cantidad||0)*(+l.precio_unit||0);
    return '<tr><td>'+tipoSel+'</td><td>'+detalle+'</td>'+
      '<td style="text-align:right">'+cant+'</td>'+
      '<td style="text-align:right">'+prec+'</td>'+
      '<td>'+(l.aplica_iva?'19%':'-')+'</td>'+
      '<td style="text-align:right" class="mono" data-tot="'+i+'">'+money(lt)+'</td>'+
      '<td>'+(dis?'':'<button class="btn ghost sm" data-rm="'+i+'">x</button>')+'</td></tr>';
  }

  function renderLineas(st){
    const box=el.querySelector('#lineasBox'); if(!box) return;
    const dis=!editable(st);
    const hayObra=!!st.obra_id;
    box.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px;margin-top:14px"><b>Lineas</b>'+
      (!dis&&hayObra?'<button class="btn ghost sm" id="bAddLinea" style="margin-left:auto">+ Agregar linea</button>':'')+'</div>'+
      (!hayObra?'<div class="note warn">Selecciona primero el cliente y la obra.</div>':
        (st.lineas.length?
          '<table class="mtable"><tr><th>Tipo</th><th>Detalle</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th><th>IVA</th><th style="text-align:right">Total</th><th></th></tr>'+
          st.lineas.map((l,i)=>filaLinea(l,i,st,dis)).join('')+'</table>'
          : '<div class="empty">Sin lineas. Agrega disposicion, transporte o producto.</div>'))+
      '<div style="margin-top:12px;text-align:right;line-height:1.9">'+
        '<div>Subtotal: <b id="totSub">'+money(0)+'</b></div>'+
        '<div>IVA (19%): <b id="totIva">'+money(0)+'</b></div>'+
        '<div style="font-size:16px">Total: <b id="totTot">'+money(0)+'</b></div>'+
      '</div>';
    if(!dis && hayObra){
      const add=box.querySelector('#bAddLinea');
      if(add) add.onclick=()=>{ st.lineas.push({tipo:'disposicion',descripcion:'Disposicion de escombros',producto_id:'',tamano_id:'',cantidad:0,precio_unit:st.precioDisp,aplica_iva:true}); renderLineas(st); };
      st.lineas.forEach((l,i)=>{
        const tSel=box.querySelector('[data-tipo="'+i+'"]'); if(tSel) tSel.onchange=()=>{ cambiarTipo(st,i,tSel.value); renderLineas(st); };
        const dSel=box.querySelector('[data-det="'+i+'"]'); if(dSel) dSel.onchange=()=>{ aplicarDetalle(st,i,dSel.value); renderLineas(st); };
        const c=box.querySelector('[data-cant="'+i+'"]'); if(c) c.oninput=()=>{ st.lineas[i].cantidad=parseNum(c.value); recalc(st); };
        const p=box.querySelector('[data-prec="'+i+'"]'); if(p) p.oninput=()=>{ st.lineas[i].precio_unit=parseNum(p.value); recalc(st); };
        const x=box.querySelector('[data-rm="'+i+'"]'); if(x) x.onclick=()=>{ st.lineas.splice(i,1); renderLineas(st); };
      });
    }
    recalc(st);
  }

  function recalc(st){
    let sub=0, iva=0;
    st.lineas.forEach((l,i)=>{
      const lt=(+l.cantidad||0)*(+l.precio_unit||0);
      sub+=lt; if(l.aplica_iva) iva+=lt*0.19;
      const tc=el.querySelector('[data-tot="'+i+'"]'); if(tc) tc.textContent=money(lt);
    });
    const eSub=el.querySelector('#totSub'), eIva=el.querySelector('#totIva'), eTot=el.querySelector('#totTot');
    if(eSub) eSub.textContent=money(sub);
    if(eIva) eIva.textContent=money(iva);
    if(eTot) eTot.textContent=money(sub+iva);
  }

  async function guardar(st){
    if(!st.obra_id){ ctx.toast('Selecciona el cliente y la obra.','error'); return; }
    for(const l of st.lineas){
      if(l.tipo==='transporte' && !l.tamano_id){ ctx.toast('En una linea de transporte falta elegir el tamano.','error'); return; }
      if(l.tipo==='producto' && !l.producto_id){ ctx.toast('En una linea de producto falta elegir el producto.','error'); return; }
    }
    const btn=el.querySelector('#bGuardar'); if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
    const lineas=st.lineas.map(l=>({tipo:l.tipo, descripcion:l.descripcion, producto_id:l.producto_id||'', tamano_id:l.tamano_id||'',
      cantidad:+l.cantidad||0, precio_unit:+l.precio_unit||0, aplica_iva:!!l.aplica_iva}));
    try{
      const res=scalar(await ctx.rpc('rcd_cotizacion_guardar',{
        p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:st.id,
        p_obra_id:st.obra_id, p_fecha:st.fecha||null, p_valida_hasta:st.valida_hasta||null,
        p_observaciones:st.observaciones, p_lineas:lineas}));
      if(res==='OBRA_VACIA'){ ctx.toast('Selecciona la obra.','error'); }
      else if(res==='SIN_PERMISO'){ ctx.toast('No tienes permiso.','error'); }
      else { ctx.toast('Cotizacion guardada'); abrirEditor(res); return; }
    }catch(e){ ctx.toast('Error de conexion al guardar.','error'); }
    if(btn){ btn.disabled=false; btn.textContent='Guardar'; }
  }

  async function cambiarEstado(st, estado){
    const msg = estado==='aceptada' ? 'Aceptar esta cotizacion? Se habilitara la obra para solicitudes.' : 'Marcar esta cotizacion como rechazada?';
    if(!(await ctx.confirm(msg))) return;
    try{ const r=scalar(await ctx.rpc('rcd_cotizacion_estado',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:st.id,p_estado:estado}));
      if(r==='OK'){ ctx.toast(estado==='aceptada'?'Cotizacion aceptada, obra habilitada':'Cotizacion rechazada'); abrirEditor(st.id); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo cambiar el estado.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  lista();
};
