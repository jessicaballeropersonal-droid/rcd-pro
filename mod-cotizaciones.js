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
      '<p class="lead">Cada linea es un item de la lista o transporte. Al aceptar una cotizacion se habilita la obra.</p>'+
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
    const st={ id:null, numero:'', cliente_id:'', cliente_nombre:'', obra_id:'', obra:'', comuna_id:'', municipio_id:'', fecha:'', valida_hasta:'',
               observaciones:'', estado:'borrador', lineas:[], productos:[], items:[], volqs:[], aliados:[], tarifasNew:[], clientes:[], obrasOpts:[] };
    try{ const r=await ctx.rpc('rcd_clientes_lista',{p_gestor_id:ctx.ses.gestor_id}); st.clientes=Array.isArray(r)?r:[]; }catch(e){}

    if(cotId){
      try{
        const cab=(await ctx.rpc('rcd_cotizacion_get',{p_id:cotId}))[0];
        st.id=cab.id; st.numero=cab.numero; st.cliente_id=cab.cliente_id||''; st.obra_id=cab.obra_id||''; st.obra=cab.obra||'';
        st.comuna_id=cab.comuna_id||''; st.fecha=cab.fecha||''; st.valida_hasta=cab.valida_hasta||'';
        st.observaciones=cab.observaciones||''; st.estado=cab.estado||'borrador'; st.cliente_nombre=cab.cliente||'';
        if(st.cliente_id){ const r=await ctx.rpc('rcd_obras_lista',{p_cliente_id:st.cliente_id}); st.obrasOpts=Array.isArray(r)?r:[]; }
        const _ob=st.obrasOpts.find(o=>o.id===st.obra_id); if(_ob){ st.municipio_id=_ob.municipio_id||''; if(!st.comuna_id) st.comuna_id=_ob.comuna_id||''; }
        await cargarContexto(st);
        const lins=await ctx.rpc('rcd_cotizacion_lineas_get',{p_cotizacion_id:cotId});
        st.lineas=(Array.isArray(lins)?lins:[]).map(l=>({tipo:l.tipo,descripcion:l.descripcion,item_id:l.item_id||'',producto_id:l.producto_id||'',tamano_id:l.tamano_id||'',destino_tipo:l.destino_tipo||'',destino_aliado_id:l.destino_aliado_id||'',cantidad:l.cantidad,precio_unit:l.precio_unit,aplica_iva:l.aplica_iva,toneladas:''}));
      }catch(e){ ctx.toast('No se pudo cargar la cotizacion.','error'); }
    }
    renderEditor(st);
  }

  async function cargarContexto(st){
    try{ const r=await ctx.rpc('rcd_items_lista',{p_gestor_id:ctx.ses.gestor_id}); st.items=(Array.isArray(r)?r:[]).filter(x=>x.activo!==false); }catch(e){ st.items=[]; }
    try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); st.volqs=(Array.isArray(r)?r:[]).filter(x=>x.activa!==false); }catch(e){ st.volqs=[]; }
    try{ const r=await ctx.rpc('rcd_aliados_lista',{p_gestor_id:ctx.ses.gestor_id}); st.aliados=(Array.isArray(r)?r:[]).filter(a=>a.activo!==false); }catch(e){ st.aliados=[]; }
    if(st.municipio_id){ try{ const r=await ctx.rpc('rcd_tarifas_lista',{p_gestor_id:ctx.ses.gestor_id,p_municipio_id:st.municipio_id,p_direccion:'recoleccion'}); st.tarifasNew=Array.isArray(r)?r:[]; }catch(e){ st.tarifasNew=[]; } }
    else st.tarifasNew=[];
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
        st.obra=o?o.nombre:''; st.comuna_id=o?(o.comuna_id||''):''; st.municipio_id=o?(o.municipio_id||''):'';
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
    if(st.id) h+='<button class="btn ghost" id="bPDF">Ver PDF</button>';
    if(st.id && st.estado==='borrador' && pEditar){
      h+='<button class="btn ghost" id="bAceptar">Aceptar (habilita la obra)</button>';
      h+='<button class="btn ghost" id="bRechazar">Rechazar</button>';
    }
    box.innerHTML=h;
    const g=box.querySelector('#bGuardar'); if(g) g.onclick=()=>guardar(st);
    const pdf=box.querySelector('#bPDF'); if(pdf) pdf.onclick=()=>verPDF(st);
    const a=box.querySelector('#bAceptar'); if(a) a.onclick=()=>cambiarEstado(st,'aceptada');
    const r=box.querySelector('#bRechazar'); if(r) r.onclick=()=>cambiarEstado(st,'rechazada');
  }

  async function verPDF(st){
    const w=window.open('','_blank');
    if(!w){ ctx.toast('Permite las ventanas emergentes para ver el PDF.','error'); return; }
    w.document.write('<p style="font-family:Arial;padding:24px">Generando PDF...</p>');
    let g={}; try{ const r=await ctx.rpc('rcd_gestor',{p_gestor_id:ctx.ses.gestor_id}); g=(Array.isArray(r)?r[0]:r)||{}; }catch(e){}
    let sub=0, iva=0;
    st.lineas.forEach(l=>{ const lt=(+l.cantidad||0)*(+l.precio_unit||0); sub+=lt; if(l.aplica_iva) iva+=lt*0.19; });
    const total=sub+iva;
    const cliente = st.cliente_nombre || ((st.clientes.find(c=>c.id===st.cliente_id)||{}).razon_social) || '';
    const filas = st.lineas.map(l=>{
      const lt=(+l.cantidad||0)*(+l.precio_unit||0);
      return '<tr><td>'+esc(l.descripcion||'')+'</td><td class="r">'+numEs(l.cantidad||0)+'</td><td class="r">'+money(l.precio_unit)+'</td><td class="r">'+money(lt)+'</td></tr>';
    }).join('');
    const estadoTxt = st.estado==='aceptada'?'ACEPTADA':(st.estado==='rechazada'?'RECHAZADA':'BORRADOR');
    const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'+
      '<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">'+
      '<title>Cotizacion '+esc(st.numero||'')+'</title><style>'+
      ':root{--ink:#1A2B27;--muted:#6E7A77;--line:#D9E2DF;--esc:#0F766E;--esc-d:#0B4A45;--orange:#E8620A}'+
      "*{box-sizing:border-box}body{margin:0;background:#E7E7E3;color:var(--ink);font-family:Barlow,system-ui,sans-serif;-webkit-font-smoothing:antialiased}"+
      '.wrap{max-width:780px;margin:0 auto;padding:18px}'+
      '.bar{display:flex;justify-content:flex-end;margin-bottom:14px}'+
      '.bar button{border:none;border-radius:9px;padding:11px 18px;background:var(--esc);color:#fff;font-family:Barlow;font-size:14px;font-weight:700;cursor:pointer}'+
      '.doc{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 4px 22px rgba(0,0,0,.08)}'+
      '.docpad{padding:30px 34px 26px}@media(max-width:560px){.docpad{padding:22px 18px}}'+
      '.top{display:flex;align-items:flex-start;gap:16px;justify-content:space-between}'+
      '.logo .nm{font-weight:900;font-size:22px;letter-spacing:.01em;line-height:1}'+
      ".logo .sb{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.06em;color:var(--muted);margin-top:5px}"+
      '.cotbig{text-align:right}.cotbig .h{font-size:26px;font-weight:900;color:var(--esc);line-height:1}'+
      ".cotbig .meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);margin-top:8px;line-height:1.7}"+
      '.para{margin-top:24px;display:flex;gap:30px;flex-wrap:wrap;font-size:13px}'+
      ".para .k{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}"+
      '.para .v{font-weight:600;margin-top:2px}'+
      'table{width:100%;border-collapse:collapse;font-size:13px;margin-top:22px}'+
      "thead th{background:var(--esc);color:#fff;font-weight:700;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.04em;text-transform:uppercase;padding:11px 12px;text-align:left}"+
      'thead th.r{text-align:right}tbody td{padding:12px;border-bottom:1px solid #EEF3F1}'+
      "tbody td.r{text-align:right;font-family:'JetBrains Mono',monospace}"+
      '.tots{margin-top:14px;margin-left:auto;width:300px;max-width:100%}'+
      '.tots .tr{display:flex;justify-content:space-between;padding:8px 12px;font-size:13.5px}'+
      ".tots .mono{font-family:'JetBrains Mono',monospace;font-weight:600}"+
      '.tots .sub{background:#F4F8F7;border-radius:8px}'+
      '.tots .grand{background:var(--esc);color:#fff;border-radius:8px;font-weight:800;font-size:16px;margin-top:4px}'+
      ".cond{margin-top:18px;border-top:1px dashed var(--line);padding-top:12px;font-size:11px;color:var(--muted);line-height:1.6;font-family:'JetBrains Mono',monospace}"+
      '.foot{margin-top:22px;border-top:2px solid var(--esc);padding-top:12px;display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--esc-d)}'+
      '@media print{body{background:#fff}.bar{display:none}.doc{box-shadow:none;border:none;border-radius:0}.wrap{padding:0;max-width:none}}'+
      '</style></head><body><div class="wrap">'+
      '<div class="bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>'+
      '<div class="doc"><div class="docpad">'+
        '<div class="top"><div class="logo">'+
          (g.logo_url?'<img src="'+esc(g.logo_url)+'" style="max-height:56px">':('<div class="nm">'+esc(g.nombre||'Empresa')+'</div>'+(g.nit?'<div class="sb">NIT '+esc(g.nit)+'</div>':'')))+
        '</div><div class="cotbig"><div class="h">COTIZACION</div><div class="meta">N.&ordm; '+esc(st.numero||'')+
          (st.fecha?'<br>'+esc(st.fecha):'')+
          (st.valida_hasta?'<br>Valida hasta '+esc(st.valida_hasta):'')+
          '<br>'+estadoTxt+'</div></div></div>'+
        '<div class="para">'+
          '<div><div class="k">Cliente</div><div class="v">'+esc(cliente||'-')+'</div></div>'+
          '<div><div class="k">Obra</div><div class="v">'+esc(st.obra||'-')+'</div></div>'+
        '</div>'+
        '<table><thead><tr><th>Descripcion</th><th class="r">Cantidad</th><th class="r">Vr. unit</th><th class="r">Total</th></tr></thead>'+
          '<tbody>'+(filas||'<tr><td colspan="4">Sin lineas</td></tr>')+'</tbody></table>'+
        '<div class="tots">'+
          '<div class="tr sub"><span>Subtotal</span><span class="mono">'+money(sub)+'</span></div>'+
          '<div class="tr"><span>IVA (19%)</span><span class="mono">'+money(iva)+'</span></div>'+
          '<div class="tr grand"><span>TOTAL</span><span class="mono">'+money(total)+'</span></div>'+
        '</div>'+
        (st.observaciones?'<div class="cond"><b>Observaciones:</b> '+esc(st.observaciones)+'</div>':'')+
        '<div class="cond">Gestion de RCD conforme a la Res. 0472/2017 y 1257/2021. El valor se ajusta a la cantidad realmente recibida en bascula.</div>'+
        '<div class="foot">'+
          (g.telefono?'<span>Tel: '+esc(g.telefono)+'</span>':'')+
          (g.correo?'<span>'+esc(g.correo)+'</span>':'')+
          (g.direccion?'<span>'+esc(g.direccion)+'</span>':'')+
        '</div>'+
      '</div></div></div>'+
      '<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>'+
      '</body></html>';
    w.document.open(); w.document.write(html); w.document.close();
  }

  // ---- lineas ----
  function destinosDe(st){
    const d=[{tipo:'nuestro',aliado:'',label:'Nuestro RCD'}];
    (st.aliados||[]).filter(a=>a.es_receptor).forEach(a=>d.push({tipo:'otro_rcd',aliado:a.id,label:'Otro RCD: '+a.razon_social}));
    (st.aliados||[]).filter(a=>a.es_maquila).forEach(a=>d.push({tipo:'maquila',aliado:a.id,label:'Maquila: '+a.razon_social}));
    return d;
  }
  function cambiarTipo(st,i,tipo){
    const l=st.lineas[i]; l.tipo=tipo;
    l.item_id=''; l.producto_id=''; l.tamano_id=''; l.destino_tipo=''; l.destino_aliado_id=''; l.toneladas=''; l.cantidad=0; l.precio_unit=0;
    if(tipo==='item'){ l.descripcion=''; l.aplica_iva=true; }
    else { l.descripcion='Transporte'; l.aplica_iva=false; }
  }
  function aplicarItem(st,i,item_id){
    const l=st.lineas[i], it=(st.items||[]).find(x=>x.id===item_id);
    l.item_id=item_id; l.descripcion=it?it.nombre:''; l.precio_unit=it?(+it.precio_t||0):0;
    l.producto_id=(it&&it.clase==='producto')?(it.producto_id||''):'';
  }
  function recalcTransporte(st,i){
    const l=st.lineas[i];
    const vq=(st.volqs||[]).find(x=>x.id===l.tamano_id), cap=vq?(+vq.capacidad_t||0):0;
    const ton=parseNum(l.toneladas)||0;
    l.cantidad=(cap>0 && ton>0)?Math.ceil(ton/cap):0;
    const t=(st.tarifasNew||[]).find(x=> x.tamano_id===l.tamano_id
        && ((x.comuna_id||'')===(st.comuna_id||''))
        && x.destino_tipo===(l.destino_tipo||'nuestro')
        && ((x.destino_aliado_id||'')===(l.destino_aliado_id||'')) );
    l.precio_unit=t?(+t.precio_cliente||0):0;
    const dl=destinosDe(st).find(d=>d.tipo===(l.destino_tipo||'nuestro') && (d.aliado||'')===(l.destino_aliado_id||''));
    l.descripcion='Transporte '+(vq?vq.nombre:'')+(dl?(' -> '+dl.label):'');
  }
  function updateRowTransport(st,i){
    recalcTransporte(st,i); const l=st.lineas[i];
    const cv=el.querySelector('[data-cantv="'+i+'"]'); if(cv) cv.textContent=numEs(l.cantidad||0);
    const pv=el.querySelector('[data-precv="'+i+'"]'); if(pv) pv.textContent=money(l.precio_unit);
    recalc(st);
  }

  function filaLinea(l,i,st,dis){
    const tipoSel = dis ? ({item:'Item',transporte:'Transporte'}[l.tipo]||l.tipo)
      : '<select data-tipo="'+i+'"><option value="item"'+(l.tipo==='item'?' selected':'')+'>Item</option>'+
        '<option value="transporte"'+(l.tipo==='transporte'?' selected':'')+'>Transporte</option></select>';
    let detalle, cant, prec;
    if(l.tipo==='transporte'){
      const dests=destinosDe(st), destVal=(l.destino_tipo||'nuestro')+'|'+(l.destino_aliado_id||'');
      detalle = dis ? esc(l.descripcion||'Transporte')
        : '<div style="display:flex;flex-direction:column;gap:4px">'+
          '<select data-tam="'+i+'"><option value="">Tamano...</option>'+(st.volqs||[]).map(t=>'<option value="'+t.id+'"'+(l.tamano_id===t.id?' selected':'')+'>'+esc(t.nombre)+'</option>').join('')+'</select>'+
          '<select data-dest="'+i+'">'+dests.map(d=>'<option value="'+d.tipo+'|'+(d.aliado||'')+'"'+(destVal===(d.tipo+'|'+(d.aliado||''))?' selected':'')+'>'+esc(d.label)+'</option>').join('')+'</select>'+
          '<input class="cellnum" data-ton="'+i+'" placeholder="Toneladas" value="'+(l.toneladas!==''&&l.toneladas!=null?numEs(l.toneladas):'')+'" style="width:120px">'+
          '</div>';
      cant = (dis?'':'<span style="font-size:11px;color:var(--muted)">viajes </span>')+'<span class="mono" data-cantv="'+i+'">'+numEs(l.cantidad||0)+'</span>';
      prec = '<span class="mono" data-precv="'+i+'">'+money(l.precio_unit)+'</span>';
    } else {
      detalle = dis ? esc(l.descripcion||'')
        : '<select data-item="'+i+'"><option value="">Item...</option>'+(st.items||[]).map(p=>'<option value="'+p.id+'"'+(l.item_id===p.id?' selected':'')+'>'+esc(p.nombre)+(p.clase==='producto'?' (producto)':'')+'</option>').join('')+'</select>';
      cant = dis ? numEs(l.cantidad) : '<input class="cellnum" data-cant="'+i+'" value="'+numEs(l.cantidad)+'" style="width:90px">';
      prec = '<span class="mono" data-precv="'+i+'">'+money(l.precio_unit)+'</span>';
    }
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
          : '<div class="empty">Sin lineas. Agrega item o transporte.</div>'))+
      '<div style="margin-top:12px;text-align:right;line-height:1.9">'+
        '<div>Subtotal: <b id="totSub">'+money(0)+'</b></div>'+
        '<div>IVA (19%): <b id="totIva">'+money(0)+'</b></div>'+
        '<div style="font-size:16px">Total: <b id="totTot">'+money(0)+'</b></div>'+
      '</div>';
    if(!dis && hayObra){
      const add=box.querySelector('#bAddLinea');
      if(add) add.onclick=()=>{ st.lineas.push({tipo:'item',descripcion:'',item_id:'',producto_id:'',tamano_id:'',destino_tipo:'',destino_aliado_id:'',toneladas:'',cantidad:0,precio_unit:0,aplica_iva:true}); renderLineas(st); };
      st.lineas.forEach((l,i)=>{
        const tSel=box.querySelector('[data-tipo="'+i+'"]'); if(tSel) tSel.onchange=()=>{ cambiarTipo(st,i,tSel.value); renderLineas(st); };
        const iSel=box.querySelector('[data-item="'+i+'"]'); if(iSel) iSel.onchange=()=>{ aplicarItem(st,i,iSel.value); renderLineas(st); };
        const tamSel=box.querySelector('[data-tam="'+i+'"]'); if(tamSel) tamSel.onchange=()=>{ st.lineas[i].tamano_id=tamSel.value; recalcTransporte(st,i); renderLineas(st); };
        const dSel=box.querySelector('[data-dest="'+i+'"]'); if(dSel) dSel.onchange=()=>{ const p=dSel.value.split('|'); st.lineas[i].destino_tipo=p[0]; st.lineas[i].destino_aliado_id=p[1]||''; recalcTransporte(st,i); renderLineas(st); };
        const ton=box.querySelector('[data-ton="'+i+'"]'); if(ton) ton.oninput=()=>{ st.lineas[i].toneladas=ton.value; updateRowTransport(st,i); };
        const c=box.querySelector('[data-cant="'+i+'"]'); if(c) c.oninput=()=>{ st.lineas[i].cantidad=parseNum(c.value); recalc(st); };
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
      if(l.tipo==='item' && !l.item_id){ ctx.toast('En una linea de item falta elegir el item.','error'); return; }
      if(l.tipo==='transporte' && !l.tamano_id){ ctx.toast('En una linea de transporte falta elegir el tamano.','error'); return; }
    }
    const btn=el.querySelector('#bGuardar'); if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
    const lineas=st.lineas.map(l=>({tipo:l.tipo, descripcion:l.descripcion, item_id:l.item_id||'', producto_id:l.producto_id||'', tamano_id:l.tamano_id||'',
      destino_tipo:l.destino_tipo||'', destino_aliado_id:l.destino_aliado_id||'',
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
