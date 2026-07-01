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
        '<table class="mtable"><tr><th>N.º</th><th>Cliente / obra</th><th>Fecha</th><th style="text-align:right">Total</th><th></th></tr>'+
        cs.map((c,i)=>'<tr><td class="mono"><b>'+esc(c.numero||'')+'</b></td>'+
          '<td>'+esc(c.cliente||'')+'<br><span style="font-size:12px;color:var(--muted)">'+esc(c.obra||'')+'</span></td>'+
          '<td class="mono">'+esc(c.fecha||'')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(c.total)+'</td>'+
          '<td><div class="rowbtns" style="align-items:center">'+badgeEstado(c.estado)+
          '<button class="btn ghost sm" data-open="'+i+'">Abrir</button>'+
          '<button class="btn ghost sm" data-pdf="'+i+'" title="Ver PDF">PDF</button>'+
          (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
          '</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay cotizaciones.</div>')+
      '</div>';
    if(pCrear) el.querySelector('#bNueva').onclick=()=>abrirEditor(null);
    el.querySelectorAll('[data-open]').forEach(b=>{const i=+b.dataset.open; b.onclick=()=>abrirEditor(cs[i].id);});
    el.querySelectorAll('[data-pdf]').forEach(b=>{const i=+b.dataset.pdf; b.onclick=()=>pdfDeId(cs[i].id);});
    el.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anular(cs[i]);});
  }

  async function anular(c){
    if(!(await ctx.confirm('Anular la cotizacion '+(c.numero||'')+'? Se ocultara, pero el historico queda.'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_cotizacion_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:c.id}));
      if(r==='OK'){ ctx.log('Cotizaciones','Cotizacion anulada', (c.numero||'')+' '+(c.cliente||'')); ctx.toast('Cotizacion anulada'); lista(); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===================== EDITOR =====================
  async function abrirEditor(cotId){
    const st={ id:null, numero:'', cliente_id:'', cliente_nombre:'', obra_id:'', obra:'', comuna_id:'', municipio_id:'', fecha:'', valida_hasta:'',
               observaciones:'', estado:'borrador', lineas:[], productos:[], items:[], volqs:[], aliados:[], tarifasRec:[], tarifasEnt:[], clientes:[], obrasOpts:[],
               tnsMap:{}, muniSigla:'', zonaSigla:'', ppSigla:'pp' };
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
        st.lineas=agruparLineas(Array.isArray(lins)?lins:[]);
      }catch(e){ ctx.toast('No se pudo cargar la cotizacion.','error'); }
    }
    renderEditor(st);
  }

  async function cargarContexto(st){
    try{ const r=await ctx.rpc('rcd_items_lista',{p_gestor_id:ctx.ses.gestor_id}); st.items=(Array.isArray(r)?r:[]).filter(x=>x.activo!==false); }catch(e){ st.items=[]; }
    try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); st.volqs=(Array.isArray(r)?r:[]).filter(x=>x.activa!==false); }catch(e){ st.volqs=[]; }
    try{ const r=await ctx.rpc('rcd_aliados_lista',{p_gestor_id:ctx.ses.gestor_id}); st.aliados=(Array.isArray(r)?r:[]).filter(a=>a.activo!==false); }catch(e){ st.aliados=[]; }
    // --- Sub-paso 4: precios y siglas desde TNS ---
    st.tnsMap={}; st.muniSigla=''; st.zonaSigla=''; st.ppSigla='pp';
    try{ const r=await ctx.rpc('rcd_gestor',{p_gestor_id:ctx.ses.gestor_id}); const g=(Array.isArray(r)?r[0]:r)||{}; if(g.sigla_patio_propio) st.ppSigla=(''+g.sigla_patio_propio).trim().toLowerCase(); }catch(e){}
    try{
      const cfg=scalar(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id}))||{};
      if(cfg.tiene_credenciales){
        const tns=await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({accion:'traer_materiales',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,codigosucursal:cfg.codigo_sucursal||'00'})}).then(x=>x.json());
        if(tns&&tns.ok){ (tns.materiales||[]).forEach(m=>{ if(m.codigo) st.tnsMap[(''+m.codigo).trim().toLowerCase()]={precio:+m.precio||0,desc:m.descripcion||''}; }); }
      }
    }catch(e){}
    // Articulos vendibles clasificados (producto/servicio/aprovechado) con precio de TNS
    st.articulos=[];
    try{
      const cl=await ctx.rpc('rcd_articulos_clasif_lista',{p_gestor_id:ctx.ses.gestor_id});
      (Array.isArray(cl)?cl:[]).filter(c=>['producto','servicio','aprovechado'].indexOf(c.clase)>=0).forEach(c=>{
        const code=(''+(c.cod_articulo||'')).trim().toLowerCase();
        const hit=st.tnsMap[code];
        st.articulos.push({ codigo:c.cod_articulo, clase:c.clase, nombre:(hit&&hit.desc)||c.cod_articulo, precio:hit?hit.precio:0, sinPrecio:!hit });
      });
    }catch(e){ st.articulos=[]; }
    if(st.municipio_id){
      try{ const r=await ctx.rpc('rcd_municipios_lista',{p_gestor_id:ctx.ses.gestor_id}); const m=(Array.isArray(r)?r:[]).find(x=>x.id===st.municipio_id); if(m) st.muniSigla=(''+(m.sigla||'')).trim().toLowerCase(); }catch(e){}
      try{ const r=await ctx.rpc('rcd_comunas_lista',{p_municipio_id:st.municipio_id}); const z=(Array.isArray(r)?r:[]).find(x=>x.id===st.comuna_id); if(z) st.zonaSigla=(''+(z.sigla||'')).trim().toLowerCase(); }catch(e){}
    }
    if(st.municipio_id){
      try{ const r=await ctx.rpc('rcd_tarifas_lista',{p_gestor_id:ctx.ses.gestor_id,p_municipio_id:st.municipio_id,p_direccion:'recoleccion'}); st.tarifasRec=Array.isArray(r)?r:[]; }catch(e){ st.tarifasRec=[]; }
      try{ const r=await ctx.rpc('rcd_tarifas_lista',{p_gestor_id:ctx.ses.gestor_id,p_municipio_id:st.municipio_id,p_direccion:'entrega'}); st.tarifasEnt=Array.isArray(r)?r:[]; }catch(e){ st.tarifasEnt=[]; }
    } else { st.tarifasRec=[]; st.tarifasEnt=[]; }
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

  function buildCotHTML(d, g){
    let sub=0, iva=0;
    (d.lineas||[]).forEach(l=>{ const lt=(+l.cantidad||0)*(+l.precio_unit||0); sub+=lt; if(l.aplica_iva) iva+=lt*0.19; });
    const total=sub+iva;
    const filas=(d.lineas||[]).map(l=>{ const lt=(+l.cantidad||0)*(+l.precio_unit||0);
      return '<tr><td>'+esc(l.descripcion||'')+'</td><td class="r">'+numEs(l.cantidad||0)+'</td><td class="r">'+money(l.precio_unit)+'</td><td class="r">'+money(lt)+'</td></tr>'; }).join('');
    const estadoTxt = d.estado==='aceptada'?'ACEPTADA':(d.estado==='rechazada'?'RECHAZADA':'BORRADOR');
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'+
      '<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">'+
      '<title>Cotizacion '+esc(d.numero||'')+'</title><style>'+
      ':root{--ink:#1A2B27;--muted:#6E7A77;--line:#D9E2DF;--esc:#0F766E;--esc-d:#0B4A45;--orange:#E8620A}'+
      '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      "body{margin:0;background:#E7E7E3;color:var(--ink);font-family:Barlow,system-ui,sans-serif;-webkit-font-smoothing:antialiased}"+
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
      '@page{size:A4;margin:12mm}'+
      '@media print{body{background:#fff}.bar{display:none}.doc{box-shadow:none;border:none;border-radius:0}.wrap{padding:0;max-width:none}}'+
      '</style></head><body><div class="wrap">'+
      '<div class="bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>'+
      '<div class="doc"><div class="docpad">'+
        '<div class="top"><div class="logo">'+
          (g.logo_url?'<img src="'+esc(g.logo_url)+'" style="max-height:56px">':('<div class="nm">'+esc(g.nombre||'Empresa')+'</div>'+(g.nit?'<div class="sb">NIT '+esc(g.nit)+'</div>':'')))+
        '</div><div class="cotbig"><div class="h">COTIZACION</div><div class="meta">N.&ordm; '+esc(d.numero||'')+
          (d.fecha?'<br>'+esc(d.fecha):'')+
          (d.valida_hasta?'<br>Valida hasta '+esc(d.valida_hasta):'')+
          '<br>'+estadoTxt+'</div></div></div>'+
        '<div class="para">'+
          '<div><div class="k">Cliente</div><div class="v">'+esc(d.cliente||'-')+'</div></div>'+
          '<div><div class="k">Obra</div><div class="v">'+esc(d.obra||'-')+'</div></div>'+
        '</div>'+
        '<table><thead><tr><th>Descripcion</th><th class="r">Cantidad</th><th class="r">Vr. unit</th><th class="r">Total</th></tr></thead>'+
          '<tbody>'+(filas||'<tr><td colspan="4">Sin lineas</td></tr>')+'</tbody></table>'+
        '<div class="tots">'+
          '<div class="tr sub"><span>Subtotal</span><span class="mono">'+money(sub)+'</span></div>'+
          '<div class="tr"><span>IVA (19%)</span><span class="mono">'+money(iva)+'</span></div>'+
          '<div class="tr grand"><span>TOTAL</span><span class="mono">'+money(total)+'</span></div>'+
        '</div>'+
        (d.observaciones?'<div class="cond"><b>Observaciones:</b> '+esc(d.observaciones)+'</div>':'')+
        '<div class="foot">'+
          (g.telefono?'<span>Tel: '+esc(g.telefono)+'</span>':'')+
          (g.correo?'<span>'+esc(g.correo)+'</span>':'')+
          (g.direccion?'<span>'+esc(g.direccion)+'</span>':'')+
        '</div>'+
      '</div></div></div>'+
      '</body></html>';
  }

  async function abrirPDF(d){
    const w=window.open('','_blank');
    if(!w){ ctx.toast('Permite las ventanas emergentes para ver el PDF.','error'); return; }
    w.document.write('<p style="font-family:Arial;padding:24px">Generando PDF...</p>');
    let g={}; try{ const r=await ctx.rpc('rcd_gestor',{p_gestor_id:ctx.ses.gestor_id}); g=(Array.isArray(r)?r[0]:r)||{}; }catch(e){}
    w.document.open(); w.document.write(buildCotHTML(d,g)); w.document.close();
  }

  function verPDF(st){
    abrirPDF({ numero:st.numero, fecha:st.fecha, valida_hasta:st.valida_hasta, estado:st.estado,
      cliente: st.cliente_nombre || ((st.clientes.find(c=>c.id===st.cliente_id)||{}).razon_social) || '',
      obra:st.obra, observaciones:st.observaciones, lineas:flattenCards(st.lineas) });
  }

  async function pdfDeId(cotId){
    const w=window.open('','_blank');
    if(!w){ ctx.toast('Permite las ventanas emergentes para ver el PDF.','error'); return; }
    w.document.write('<p style="font-family:Arial;padding:24px">Generando PDF...</p>');
    let cab={}, lineas=[], g={};
    try{ const r=await ctx.rpc('rcd_cotizacion_get',{p_id:cotId}); cab=(Array.isArray(r)?r[0]:r)||{}; }catch(e){}
    try{ const r=await ctx.rpc('rcd_cotizacion_lineas_get',{p_cotizacion_id:cotId}); lineas=Array.isArray(r)?r:[]; }catch(e){}
    try{ const r=await ctx.rpc('rcd_gestor',{p_gestor_id:ctx.ses.gestor_id}); g=(Array.isArray(r)?r[0]:r)||{}; }catch(e){}
    const d={ numero:cab.numero, fecha:cab.fecha, valida_hasta:cab.valida_hasta, estado:cab.estado,
      cliente:cab.cliente, obra:cab.obra, observaciones:cab.observaciones, lineas:lineas };
    w.document.open(); w.document.write(buildCotHTML(d,g)); w.document.close();
  }

  // ---- lineas (modelo tarjeta: producto/servicio + su transporte) ----
  function destinosDe(st){
    const d=[{tipo:'nuestro',aliado:'',label:'Patio propio'}];
    (st.aliados||[]).filter(a=>a.es_receptor).forEach(a=>d.push({tipo:'otro_rcd',aliado:a.id,label:a.razon_social}));
    (st.aliados||[]).filter(a=>a.es_maquila).forEach(a=>d.push({tipo:'maquila',aliado:a.id,label:'Maquila: '+a.razon_social}));
    return d;
  }
  function siglaAliado(n){ return (n||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').slice(0,3); }
  function patioSiglaDe(st,l){
    if((l.destino_tipo||'nuestro')==='nuestro') return st.ppSigla||'pp';
    const a=(st.aliados||[]).find(x=>x.id===l.destino_aliado_id);
    return a?siglaAliado(a.razon_social):'';
  }
  function nuevaLinea(){ return {cod_articulo:'',descripcion:'',cantidad:'',precio_unit:0,aplica_iva:true,p_falta:false,t_modo:'cliente',tamano_id:'',destino_tipo:'',destino_aliado_id:'',t_viajes:0,t_code:'',t_precio:0,t_falta:false}; }
  function aplicarArticulo(st,i,codigo){
    const l=st.lineas[i], a=(st.articulos||[]).find(x=>x.codigo===codigo);
    l.cod_articulo=codigo; l.descripcion=a?a.nombre:''; l.precio_unit=a?(+a.precio||0):0; l.p_falta=a?!!a.sinPrecio:false;
  }
  function recalcCard(st,i){
    const l=st.lineas[i];
    if((l.t_modo||'cliente')==='cliente'){ l.t_viajes=0; l.t_code=''; l.t_precio=0; l.t_falta=false; return; }
    const vq=(st.volqs||[]).find(x=>x.id===l.tamano_id), cap=vq?(+vq.capacidad_t||0):0;
    const ton=parseNum(l.cantidad)||0;
    l.t_viajes=(cap>0 && ton>0)?Math.ceil(ton/cap):0;
    const code=(st.muniSigla||'')+'-'+(st.zonaSigla||'')+'-t'+Math.round(cap||0)+'-'+patioSiglaDe(st,l);
    l.t_code=code;
    const hit=(st.tnsMap&&cap>0)?st.tnsMap[code]:null;
    l.t_precio=hit?(+hit.precio||0):0;
    l.t_falta=(cap>0 && !hit);
  }
  function agruparLineas(rows){
    const groups={}, order=[];
    (rows||[]).forEach((r,idx)=>{
      const g=(r.grupo!=null)?('g'+r.grupo):('x'+idx);
      if(!groups[g]){ groups[g]={}; order.push(g); }
      if(r.tipo==='transporte') groups[g].t=r; else groups[g].p=r;
    });
    return order.map(g=>{
      const p=groups[g].p, t=groups[g].t, card=nuevaLinea();
      if(p){ card.cod_articulo=p.cod_articulo||''; card.descripcion=p.descripcion||''; card.cantidad=(p.cantidad!=null?p.cantidad:''); card.precio_unit=+p.precio_unit||0; card.aplica_iva=!!p.aplica_iva; }
      if(t){ card.t_modo=(t.direccion==='entrega'?'despacho':'recoleccion'); card.tamano_id=t.tamano_id||''; card.destino_tipo=t.destino_tipo||''; card.destino_aliado_id=t.destino_aliado_id||''; card.t_viajes=+t.cantidad||0; card.t_precio=+t.precio_unit||0; card.t_code=t.cod_articulo||''; if(!p) card.descripcion=t.descripcion||''; }
      return card;
    });
  }
  function flattenCards(cards){
    const rows=[];
    (cards||[]).forEach(l=>{
      rows.push({tipo:'producto',descripcion:l.descripcion,cantidad:+l.cantidad||0,precio_unit:+l.precio_unit||0,aplica_iva:!!l.aplica_iva});
      if((l.t_modo||'cliente')!=='cliente') rows.push({tipo:'transporte',descripcion:(l.t_modo==='despacho'?'Despacho':'Recoleccion'),cantidad:+l.t_viajes||0,precio_unit:+l.t_precio||0,aplica_iva:false});
    });
    return rows;
  }
  function optT(val,sel,label){ return '<option value="'+esc(val)+'"'+(sel?' selected':'')+'>'+esc(label)+'</option>'; }
  function renderCard(l,i,st,dis){
    const modo=l.t_modo||'cliente';
    const prodSub=(+l.cantidad||0)*(+l.precio_unit||0);
    const dests=destinosDe(st), destVal=(l.destino_tipo||'nuestro')+'|'+(l.destino_aliado_id||'');
    let h='<div class="cot-card">';
    h+='<div class="cot-head"><span class="cot-tag">Producto / servicio</span>'+(dis?'':'<span class="cot-x" data-rm="'+i+'">quitar</span>')+'</div>';
    h+= dis ? '<div class="cot-ro"><b>'+esc(l.descripcion||'')+'</b></div>'
      : '<select class="cot-sel" data-art="'+i+'"><option value="">Producto/servicio...</option>'+(st.articulos||[]).map(p=>optT(p.codigo,l.cod_articulo===p.codigo,p.nombre+' ('+p.clase+')'+(p.sinPrecio?' - sin precio':''))).join('')+'</select>';
    h+='<div class="cot-grid3">'+
      '<div><div class="cot-lbl">Cantidad (t)</div>'+(dis?('<div class="cot-ro">'+numEs(l.cantidad||0)+'</div>'):('<input class="cot-in" data-cant="'+i+'" value="'+(l.cantidad!==''&&l.cantidad!=null?numEs(l.cantidad):'')+'">'))+'</div>'+
      '<div><div class="cot-lbl">Precio TNS</div><div class="cot-ro">'+money(l.precio_unit)+(l.cod_articulo?' /t':'')+'</div></div>'+
      '<div><div class="cot-lbl">Subtotal</div><div class="cot-ro" style="font-weight:600" data-prodsub="'+i+'">'+money(prodSub)+'</div></div>'+
      '</div>';
    if(l.p_falta) h+='<div class="cot-warn">Este articulo no tiene precio en TNS.</div>';
    h+='<div class="cot-div"></div><div class="cot-lbl">Transporte</div>';
    h+= dis ? '<div class="cot-ro">'+(modo==='cliente'?'Cliente recoge (sin transporte)':(modo==='despacho'?'Despacho':'Recoleccion'))+'</div>'
      : '<select class="cot-sel" data-modo="'+i+'">'+optT('cliente',modo==='cliente','Cliente recoge - sin transporte')+optT('recoleccion',modo==='recoleccion','Recoleccion - nosotros recogemos')+optT('despacho',modo==='despacho','Despacho - nosotros llevamos')+'</select>';
    if(modo!=='cliente'){
      if(!dis){
        h+='<div class="cot-grid2">'+
          '<div><div class="cot-lbl">Tamano</div><select class="cot-sel sm" data-tam="'+i+'"><option value="">Tamano...</option>'+(st.volqs||[]).map(t=>optT(t.id,l.tamano_id===t.id,t.nombre)).join('')+'</select></div>'+
          '<div><div class="cot-lbl">Patio</div><select class="cot-sel sm" data-dest="'+i+'">'+dests.map(d=>optT(d.tipo+'|'+(d.aliado||''),destVal===(d.tipo+'|'+(d.aliado||'')),d.label)).join('')+'</select></div>'+
          '</div>';
      }
      const tt=(+l.t_viajes||0)*(+l.t_precio||0);
      h+='<div class="cot-pills">'+
        '<span class="cot-pill" data-viajes="'+i+'">'+numEs(l.t_viajes||0)+' viajes</span>'+
        (l.t_code?'<span class="cot-pill mono">'+esc(l.t_code)+'</span>':'')+
        '<span class="cot-pill" data-tpill="'+i+'" style="'+(l.t_falta?'background:#FAECE7;color:#993C1D':'background:#E1F5EE;color:#0F6E56')+'">'+(l.t_falta?'sin precio en TNS':(money(l.t_precio)+'/viaje &rarr; '+money(tt)))+'</span>'+
        '</div>';
    }
    const cardTot=prodSub+((modo!=='cliente')?(+l.t_viajes||0)*(+l.t_precio||0):0);
    h+='<div class="cot-tot">Total linea: <b data-cardtot="'+i+'">'+money(cardTot)+'</b></div>';
    h+='</div>';
    return h;
  }
  function cotCSS(){ return '<style>'+
    '.cot-card{background:#F6F7F2;border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px}'+
    '.cot-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}'+
    '.cot-tag{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--esc)}'+
    '.cot-x{font-size:12px;color:var(--muted);cursor:pointer}'+
    '.cot-sel,.cot-in{width:100%;border:1px solid var(--line);border-radius:10px;padding:11px 13px;font-family:Barlow;font-size:14px;background:#fff;-webkit-appearance:none;appearance:none}'+
    ".cot-sel{background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236E7A77' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>\");background-repeat:no-repeat;background-position:right 13px center;padding-right:34px}"+
    '.cot-sel.sm{padding:9px 11px;font-size:13px}'+
    '.cot-grid3,.cot-grid2{display:flex;gap:8px;margin-top:8px}.cot-grid3>div,.cot-grid2>div{flex:1}'+
    '.cot-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);margin-bottom:3px}'+
    '.cot-ro{padding:10px 2px;font-size:14px;color:var(--ink)}'+
    '.cot-div{border-top:1px dashed var(--line);margin:12px 0 10px}'+
    '.cot-pills{margin-top:9px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}'+
    '.cot-pill{font-size:11.5px;padding:3px 9px;border-radius:6px;background:#fff;border:1px solid var(--line)}'+
    '.cot-tot{text-align:right;margin-top:12px;font-size:14px;border-top:1px solid var(--line);padding-top:8px}'+
    '.cot-warn{font-size:11px;color:#993C1D;margin-top:6px}'+
    '</style>'; }
  function renderLineas(st){
    const box=el.querySelector('#lineasBox'); if(!box) return;
    const dis=!editable(st);
    const hayObra=!!st.obra_id;
    box.innerHTML= cotCSS()+
      '<div style="display:flex;align-items:center;gap:10px;margin-top:14px"><b>Lineas</b>'+
      (!dis&&hayObra?'<button class="btn ghost sm" id="bAddLinea" style="margin-left:auto">+ Agregar linea</button>':'')+'</div>'+
      (!hayObra?'<div class="note warn">Selecciona primero el cliente y la obra.</div>':
        (st.lineas.length? st.lineas.map((l,i)=>renderCard(l,i,st,dis)).join('')
          : '<div class="empty">Sin lineas. Agrega un producto o servicio.</div>'))+
      '<div style="margin-top:12px;text-align:right;line-height:1.9">'+
        '<div>Subtotal: <b id="totSub">'+money(0)+'</b></div>'+
        '<div>IVA (19%): <b id="totIva">'+money(0)+'</b></div>'+
        '<div style="font-size:16px">Total: <b id="totTot">'+money(0)+'</b></div>'+
      '</div>';
    if(!dis && hayObra){
      const add=box.querySelector('#bAddLinea');
      if(add) add.onclick=()=>{ st.lineas.push(nuevaLinea()); renderLineas(st); };
      st.lineas.forEach((l,i)=>{
        const aSel=box.querySelector('[data-art="'+i+'"]'); if(aSel) aSel.onchange=()=>{ aplicarArticulo(st,i,aSel.value); recalcCard(st,i); renderLineas(st); };
        const cant=box.querySelector('[data-cant="'+i+'"]'); if(cant) cant.oninput=()=>{ st.lineas[i].cantidad=parseNum(cant.value); refreshCard(st,i); };
        const modo=box.querySelector('[data-modo="'+i+'"]'); if(modo) modo.onchange=()=>{ st.lineas[i].t_modo=modo.value; if(modo.value!=='cliente' && !st.lineas[i].destino_tipo) st.lineas[i].destino_tipo='nuestro'; recalcCard(st,i); renderLineas(st); };
        const tam=box.querySelector('[data-tam="'+i+'"]'); if(tam) tam.onchange=()=>{ st.lineas[i].tamano_id=tam.value; recalcCard(st,i); renderLineas(st); };
        const dest=box.querySelector('[data-dest="'+i+'"]'); if(dest) dest.onchange=()=>{ const p=dest.value.split('|'); st.lineas[i].destino_tipo=p[0]; st.lineas[i].destino_aliado_id=p[1]||''; recalcCard(st,i); renderLineas(st); };
        const rm=box.querySelector('[data-rm="'+i+'"]'); if(rm) rm.onclick=()=>{ st.lineas.splice(i,1); renderLineas(st); };
      });
    }
    recalc(st);
  }
  function refreshCard(st,i){
    recalcCard(st,i); const l=st.lineas[i];
    const prodSub=(+l.cantidad||0)*(+l.precio_unit||0);
    const ps=el.querySelector('[data-prodsub="'+i+'"]'); if(ps) ps.textContent=money(prodSub);
    if((l.t_modo||'cliente')!=='cliente'){
      const vv=el.querySelector('[data-viajes="'+i+'"]'); if(vv) vv.textContent=numEs(l.t_viajes||0)+' viajes';
      const tt=(+l.t_viajes||0)*(+l.t_precio||0);
      const tp=el.querySelector('[data-tpill="'+i+'"]'); if(tp) tp.innerHTML=l.t_falta?'sin precio en TNS':(money(l.t_precio)+'/viaje &rarr; '+money(tt));
    }
    const ct=prodSub+(((l.t_modo||'cliente')!=='cliente')?(+l.t_viajes||0)*(+l.t_precio||0):0);
    const cc=el.querySelector('[data-cardtot="'+i+'"]'); if(cc) cc.textContent=money(ct);
    recalc(st);
  }
  function recalc(st){
    let sub=0, iva=0;
    (st.lineas||[]).forEach(l=>{
      const pt=(+l.cantidad||0)*(+l.precio_unit||0);
      sub+=pt; if(l.aplica_iva) iva+=pt*0.19;
      if((l.t_modo||'cliente')!=='cliente'){ sub+=(+l.t_viajes||0)*(+l.t_precio||0); }
    });
    const eSub=el.querySelector('#totSub'), eIva=el.querySelector('#totIva'), eTot=el.querySelector('#totTot');
    if(eSub) eSub.textContent=money(sub);
    if(eIva) eIva.textContent=money(iva);
    if(eTot) eTot.textContent=money(sub+iva);
  }

  async function guardar(st){
    if(!st.obra_id){ ctx.toast('Selecciona el cliente y la obra.','error'); return; }
    for(const l of st.lineas){
      if(!l.cod_articulo){ ctx.toast('En una linea falta elegir el producto o servicio.','error'); return; }
      if((l.t_modo||'cliente')!=='cliente' && !l.tamano_id){ ctx.toast('En una linea con transporte falta elegir el tamano.','error'); return; }
    }
    const btn=el.querySelector('#bGuardar'); if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
    const lineas=[];
    st.lineas.forEach((l,gi)=>{
      lineas.push({tipo:'producto', descripcion:l.descripcion, item_id:'', producto_id:'', tamano_id:'', cod_articulo:l.cod_articulo||'',
        destino_tipo:'', destino_aliado_id:'', direccion:'', grupo:gi,
        cantidad:+l.cantidad||0, precio_unit:+l.precio_unit||0, aplica_iva:!!l.aplica_iva});
      if((l.t_modo||'cliente')!=='cliente'){
        lineas.push({tipo:'transporte', descripcion:(l.t_modo==='despacho'?'Despacho':'Recoleccion'), item_id:'', producto_id:'', tamano_id:l.tamano_id||'', cod_articulo:l.t_code||'',
          destino_tipo:l.destino_tipo||'', destino_aliado_id:l.destino_aliado_id||'', direccion:(l.t_modo==='despacho'?'entrega':'recoleccion'), grupo:gi,
          cantidad:+l.t_viajes||0, precio_unit:+l.t_precio||0, aplica_iva:false});
      }
    });
    try{
      const res=scalar(await ctx.rpc('rcd_cotizacion_guardar',{
        p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_id:st.id,
        p_obra_id:st.obra_id, p_fecha:st.fecha||null, p_valida_hasta:st.valida_hasta||null,
        p_observaciones:st.observaciones, p_lineas:lineas}));
      if(res==='OBRA_VACIA'){ ctx.toast('Selecciona la obra.','error'); }
      else if(res==='SIN_PERMISO'){ ctx.toast('No tienes permiso.','error'); }
      else { ctx.log('Cotizaciones','Cotizacion guardada', ''); ctx.toast('Cotizacion guardada'); abrirEditor(res); return; }
    }catch(e){ ctx.toast('Error de conexion al guardar.','error'); }
    if(btn){ btn.disabled=false; btn.textContent='Guardar'; }
  }

  async function cambiarEstado(st, estado){
    const msg = estado==='aceptada' ? 'Aceptar esta cotizacion? Se habilitara la obra para solicitudes.' : 'Marcar esta cotizacion como rechazada?';
    if(!(await ctx.confirm(msg))) return;
    try{ const r=scalar(await ctx.rpc('rcd_cotizacion_estado',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:st.id,p_estado:estado}));
      if(r==='OK'){ ctx.log('Cotizaciones', estado==='aceptada'?'Cotizacion aceptada':'Cotizacion rechazada', (st.numero||'')+' '+(st.cliente||'')); ctx.toast(estado==='aceptada'?'Cotizacion aceptada, obra habilitada':'Cotizacion rechazada'); abrirEditor(st.id); return; }
      ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo cambiar el estado.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  lista();
};
