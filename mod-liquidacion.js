// ============================================================
// RCD PRO · Modulo Liquidacion (clave 'liquidacion')
// Cobros a clientes (obra+periodo) + Pago a volqueteros. Automatica y fija.
// (usa helpers globales: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.liquidacion = function(el, ctx){
  const pCrear = ctx.can('liquidacion','escribir');
  function money(n){ return '$ '+Math.round(+n||0).toLocaleString('es-CO'); }
  let side='cob';

  // estado lados
  const cob={ clientes:[], obras:[], cliente_id:'', obra_id:'', obra:'', cliente_nombre:'', liquidado_hasta:null, desde:'', hasta:'', lineas:[], es_final:false, generado:false };
  const vol={ volqs:[], volquetero_id:'', volquetero:'', placa:'', pagado_hasta:null, desde:'', hasta:'', lineas:[], generado:false };

  function shell(){
    el.innerHTML=
      '<div style="max-width:920px">'+
      '<h2 style="font-size:20px;font-weight:800;margin:0 0 2px">Liquidacion</h2>'+
      '<p class="lead" style="margin:0 0 14px">Cobros a clientes, pagos a volqueteros y pagos a maquilas.</p>'+
      '<div style="display:flex;gap:8px;margin-bottom:14px">'+
        '<button class="btn '+(side==='cob'?'primary':'ghost')+'" id="sCob" style="flex:1">Cobros a clientes</button>'+
        '<button class="btn '+(side==='vol'?'primary':'ghost')+'" id="sVol" style="flex:1">Pago a volqueteros</button>'+
        '<button class="btn '+(side==='maq'?'primary':'ghost')+'" id="sMaq" style="flex:1">Pago a maquilas</button>'+
      '</div>'+
      '<div id="liqBody"></div></div>';
    el.querySelector('#sCob').onclick=()=>{ side='cob'; shell(); };
    el.querySelector('#sVol').onclick=()=>{ side='vol'; shell(); };
    el.querySelector('#sMaq').onclick=()=>{ side='maq'; shell(); };
    if(side==='cob') cobView('liq'); else if(side==='vol') volView('liq'); else maqView();
  }
  function body(){ return el.querySelector('#liqBody'); }
  function tabbar(tabs,activa,fn){
    const b=document.createElement('div'); b.className='tabbar';
    b.innerHTML=tabs.map(t=>'<button class="tab'+(t.k===activa?' active':'')+'" data-k="'+t.k+'">'+t.n+'</button>').join('');
    b.querySelectorAll('.tab').forEach(x=>x.onclick=()=>fn(x.dataset.k));
    return b;
  }

  let maqSub='porfac';
  async function maqView(){
    const bd=body(); bd.innerHTML='<div class="loading">Consultando TNS...</div>';
    let liqs=[]; try{ const r=await ctx.rpc('rcd_maquila_liquidaciones',{p_gestor_id:ctx.ses.gestor_id,p_aliado_id:null,p_facturado:null}); liqs=Array.isArray(r)?r:[]; }catch(e){}
    let aliados=[]; try{ const r=await ctx.rpc('rcd_aliados_lista',{p_gestor_id:ctx.ses.gestor_id}); aliados=(Array.isArray(r)?r:[]).filter(a=>a.es_maquila && a.activo!==false); }catch(e){}
    let cfg={}; try{ cfg=scalarRow(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id}))||{}; }catch(e){}
    const cById={}, conCod=aliados.filter(a=>a.cod_tercero);
    if(cfg.tiene_credenciales && conCod.length){
      try{ const r=await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({accion:'traer_cartera',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,codigosucursal:cfg.codigo_sucursal||'00',
          clientes:conCod.map(a=>({cliente_id:a.id,cod_tercero:a.cod_tercero}))})}).then(x=>x.json());
        if(r&&r.ok)(r.cartera||[]).forEach(x=>{cById[x.cliente_id]=x;});
      }catch(e){}
    }
    render();

    function render(){
      bd.innerHTML='<div class="tabbar" style="margin-bottom:12px">'+
        [['porfac','Por facturar'],['facturado','Facturado'],['resumen','Resumen']].map(t=>'<button class="tab'+(maqSub===t[0]?' active':'')+'" data-s="'+t[0]+'">'+t[1]+'</button>').join('')+
        '</div><div id="maqSubBody"></div>';
      bd.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{ maqSub=b.dataset.s; render(); });
      const sb=bd.querySelector('#maqSubBody');
      if(maqSub==='porfac') porFacturar(sb); else if(maqSub==='facturado') facturado(sb); else resumen(sb);
    }

    function porFacturar(sb){
      const pend=liqs.filter(l=>!l.factura_tns), byAli={};
      pend.forEach(l=>{ (byAli[l.aliado_id]=byAli[l.aliado_id]||{nombre:l.aliado,items:[]}).items.push(l); });
      const grupos=Object.keys(byAli);
      if(!grupos.length){ sb.innerHTML='<div class="empty">No hay liquidaciones por facturar.</div>'; return; }
      sb.innerHTML='<p class="lead" style="margin:0 0 12px">Selecciona las liquidaciones y asignales la factura de TNS que las cubre.</p>'+
        grupos.map(aid=>{
          const g=byAli[aid], tns=cById[aid]||{}, facturas=(tns.facturas||[]);
          return '<div class="mcard" style="margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">'+esc(g.nombre)+'</div>'+
            '<table class="mtable"><tr><th></th><th>Envio</th><th>Material</th><th style="text-align:right">Ton</th><th style="text-align:right">Costo</th><th>Fecha</th></tr>'+
            g.items.map(l=>'<tr><td><input type="checkbox" data-chk="'+l.id+'"></td><td class="mono">'+esc(l.produccion_numero||'')+'</td><td>'+esc(l.material)+'</td><td class="mono" style="text-align:right">'+numEs(l.toneladas)+'</td><td class="mono" style="text-align:right">'+money(l.costo)+'</td><td class="mono">'+esc(l.fecha||'')+'</td></tr>').join('')+'</table>'+
            '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:10px">'+
              '<div class="field" style="margin:0;flex:1;min-width:180px"><label>Factura de TNS</label><select>'+
                (facturas.length?('<option value="">Selecciona...</option>'+facturas.map(f=>'<option value="'+esc(f.numero||'')+'">'+esc(f.numero||'')+' · '+money(Math.abs(+f.valor||0))+'</option>').join('')):'<option value="">Sin facturas en TNS</option>')+
              '</select></div>'+
              '<button class="btn primary sm" data-asig="1">Asignar factura</button>'+
            '</div></div>';
        }).join('');
      sb.querySelectorAll('[data-asig]').forEach(b=>b.onclick=async function(){
        const card=b.closest('.mcard'), fac=card.querySelector('select').value;
        if(!fac){ ctx.toast('Elige la factura de TNS.','error'); return; }
        const ids=Array.from(card.querySelectorAll('[data-chk]:checked')).map(c=>c.dataset.chk);
        if(!ids.length){ ctx.toast('Selecciona al menos una liquidacion.','error'); return; }
        b.disabled=true;
        try{ const r=scalar(await ctx.rpc('rcd_maquila_facturar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_ids:ids,p_factura_tns:fac}));
          if(typeof r==='string' && r.indexOf('OK')===0){ ctx.toast('Factura asignada'); maqView(); return; }
          ctx.toast('No se pudo asignar.','error'); b.disabled=false;
        }catch(e){ ctx.toast('Error de conexion.','error'); b.disabled=false; }
      });
    }

    function facturado(sb){
      const fact=liqs.filter(l=>l.factura_tns);
      if(!fact.length){ sb.innerHTML='<div class="empty">Nada facturado todavia.</div>'; return; }
      const byKey={};
      fact.forEach(l=>{ const k=l.aliado_id+'|'+l.factura_tns; (byKey[k]=byKey[k]||{aliado:l.aliado,aliado_id:l.aliado_id,factura:l.factura_tns,items:[]}).items.push(l); });
      sb.innerHTML='<p class="lead" style="margin:0 0 12px">Liquidaciones ya asignadas a una factura de TNS. El saldo lo trae TNS (los abonos se registran alli).</p>'+
        Object.keys(byKey).map(k=>{
          const g=byKey[k], tns=cById[g.aliado_id]||{};
          const facTns=(tns.facturas||[]).filter(f=>String(f.numero||'')===String(g.factura))[0]||null;
          const tot=g.items.reduce((a,l)=>a+(+l.costo||0),0);
          return '<div class="mcard" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><div style="font-weight:700">'+esc(g.aliado)+' · Factura '+esc(g.factura)+'</div>'+
            (facTns?'<div style="font-size:12.5px">Saldo TNS: <b style="color:'+((Math.abs(+facTns.saldo||0)>0)?'#993C1D':'inherit')+'">'+money(Math.abs(+facTns.saldo||0))+'</b></div>':'<div style="font-size:12px;color:var(--muted)">Factura no hallada en TNS</div>')+'</div>'+
            '<table class="mtable" style="margin-top:8px"><tr><th>Envio</th><th>Material</th><th style="text-align:right">Ton</th><th style="text-align:right">Costo</th><th></th></tr>'+
            g.items.map(l=>'<tr><td class="mono">'+esc(l.produccion_numero||'')+'</td><td>'+esc(l.material)+'</td><td class="mono" style="text-align:right">'+numEs(l.toneladas)+'</td><td class="mono" style="text-align:right">'+money(l.costo)+'</td><td><button class="btn ghost sm" data-quitar="'+l.id+'">Quitar</button></td></tr>').join('')+
            '<tr style="font-weight:700"><td colspan="3">Total liquidado</td><td class="mono" style="text-align:right">'+money(tot)+'</td><td></td></tr></table></div>';
        }).join('');
      sb.querySelectorAll('[data-quitar]').forEach(b=>b.onclick=async function(){
        if(!(await ctx.confirm('Quitar esta liquidacion de la factura?'))) return;
        try{ const r=scalar(await ctx.rpc('rcd_maquila_desfacturar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:b.dataset.quitar}));
          if(r==='OK'){ ctx.toast('Quitada'); maqView(); return; } ctx.toast('No se pudo.','error');
        }catch(e){ ctx.toast('Error de conexion.','error'); }
      });
    }

    function resumen(sb){
      const rows=aliados.map(a=>{
        const mine=liqs.filter(l=>l.aliado_id===a.id);
        const liquidado=mine.reduce((s,l)=>s+(+l.costo||0),0);
        const facturado=mine.filter(l=>l.factura_tns).reduce((s,l)=>s+(+l.costo||0),0);
        const tns=cById[a.id]||{};
        return { aliado:a.razon_social, liquidado, facturado, porFacturar:liquidado-facturado, saldo:Math.abs(+tns.saldo||0), tieneCod:!!a.cod_tercero };
      }).filter(r=>r.liquidado>0 || r.saldo>0);
      if(!rows.length){ sb.innerHTML='<div class="empty">Sin liquidaciones todavia.</div>'; return; }
      const T=k=>rows.reduce((s,r)=>s+r[k],0);
      sb.innerHTML='<p class="lead" style="margin:0 0 12px">Cruce por maquila: liquidado (app) vs facturado y saldo (TNS).</p>'+
        '<table class="mtable"><tr><th>Maquila</th><th style="text-align:right">Liquidado</th><th style="text-align:right">Facturado</th><th style="text-align:right">Por facturar</th><th style="text-align:right">Saldo TNS</th></tr>'+
        rows.map(r=>'<tr><td><b>'+esc(r.aliado)+'</b></td><td class="mono" style="text-align:right">'+money(r.liquidado)+'</td><td class="mono" style="text-align:right">'+money(r.facturado)+'</td><td class="mono" style="text-align:right;color:'+(r.porFacturar>0?'#B45309':'inherit')+'">'+money(r.porFacturar)+'</td><td class="mono" style="text-align:right;color:'+(r.saldo>0?'#993C1D':'inherit')+'">'+(r.tieneCod?money(r.saldo):'-')+'</td></tr>').join('')+
        '<tr style="font-weight:700"><td>Total</td><td class="mono" style="text-align:right">'+money(T('liquidado'))+'</td><td class="mono" style="text-align:right">'+money(T('facturado'))+'</td><td class="mono" style="text-align:right">'+money(T('porFacturar'))+'</td><td class="mono" style="text-align:right">'+money(T('saldo'))+'</td></tr></table>';
    }
  }

  // ===================== COBROS =====================
  function cobView(tab){
    const bd=body(); bd.innerHTML='';
    bd.appendChild(tabbar([{k:'liq',n:'Liquidar'},{k:'seg',n:'En seguimiento'},{k:'his',n:'Historial'}],tab,cobView));
    const cont=document.createElement('div'); cont.id='cobCont'; bd.appendChild(cont);
    if(tab==='liq') cobLiquidar(); else if(tab==='seg') cobSeguimiento(); else cobHistorial();
  }

  async function cobLiquidar(){
    const cont=el.querySelector('#cobCont'); cont.innerHTML='<div class="loading">Cargando...</div>';
    if(!cob.clientes.length){ try{ const r=await ctx.rpc('rcd_clientes_lista',{p_gestor_id:ctx.ses.gestor_id}); cob.clientes=(Array.isArray(r)?r:[]).filter(c=>c.activo!==false); }catch(e){} }
    pintarCobForm(cont);
  }
  function pintarCobForm(cont){
    cont.innerHTML=
      '<div class="mcard">'+
      '<div class="row2"><div class="field"><label>Cliente</label><select id="c_cli"><option value="">Selecciona...</option>'+
        cob.clientes.map(c=>'<option value="'+c.id+'"'+(cob.cliente_id===c.id?' selected':'')+'>'+esc(c.razon_social)+'</option>').join('')+'</select></div>'+
        '<div class="field"><label>Obra</label><select id="c_obra"><option value="">Selecciona...</option>'+
        cob.obras.map(o=>'<option value="'+o.id+'"'+(cob.obra_id===o.id?' selected':'')+'>'+esc(o.nombre)+'</option>').join('')+'</select></div></div>'+
      '<div id="c_lock"></div>'+
      '<div class="row2"><div class="field"><label>Desde (bloqueado)</label><input id="c_desde" value="'+esc(cob.desde||'')+'" disabled></div>'+
        '<div class="field"><label>Hasta</label><input id="c_hasta" type="date" value="'+esc(cob.hasta||'')+'"></div></div>'+
      '<button class="btn primary" id="c_gen">Generar</button>'+
      '</div><div id="c_result"></div>';
    const selCli=cont.querySelector('#c_cli'), selObra=cont.querySelector('#c_obra');
    selCli.onchange=async()=>{ cob.cliente_id=selCli.value; cob.cliente_nombre=(cob.clientes.find(c=>c.id===cob.cliente_id)||{}).razon_social||'';
      cob.obras=[]; cob.obra_id=''; cob.desde=''; cob.liquidado_hasta=null; cob.generado=false;
      if(cob.cliente_id){ try{ const r=await ctx.rpc('rcd_obras_lista',{p_cliente_id:cob.cliente_id}); cob.obras=Array.isArray(r)?r:[]; }catch(e){} }
      pintarCobForm(cont); };
    selObra.onchange=async()=>{ cob.obra_id=selObra.value; const o=cob.obras.find(x=>x.id===cob.obra_id); cob.obra=o?o.nombre:''; cob.generado=false;
      if(cob.obra_id){ try{ const r=scalarRow(await ctx.rpc('rcd_liquidacion_obra_estado',{p_gestor_id:ctx.ses.gestor_id,p_obra_id:cob.obra_id}));
        cob.liquidado_hasta=r?r.liquidado_hasta:null; cob.desde=r&&r.desde_sugerido?r.desde_sugerido:''; }catch(e){} }
      pintarCobForm(cont); };
    const lock=cont.querySelector('#c_lock');
    if(cob.obra_id){ lock.innerHTML='<div class="note" style="background:#E7F1EF;border-color:#C4DED9;color:#0B4A45">'+
      (cob.liquidado_hasta?('Liquidado hasta <b>'+esc(cob.liquidado_hasta)+'</b>. '):'Sin liquidaciones previas. ')+
      (cob.desde?('Esta liquidacion arranca el <b>'+esc(cob.desde)+'</b> (bloqueado).'):'No hay operaciones para liquidar.')+'</div>'; }
    cont.querySelector('#c_gen').onclick=cobGenerar;
    if(cob.generado) pintarCobResult();
  }
  async function cobGenerar(){
    if(!cob.obra_id){ ctx.toast('Elige la obra.','error'); return; }
    cob.hasta=v(el,'c_hasta'); if(!cob.hasta){ ctx.toast('Elige la fecha Hasta.','error'); return; }
    if(!cob.desde){ ctx.toast('No hay fecha de inicio (sin operaciones).','error'); return; }
    const btn=el.querySelector('#c_gen'); btn.disabled=true; btn.textContent='Generando...';
    try{ const r=await ctx.rpc('rcd_liquidacion_preview',{p_gestor_id:ctx.ses.gestor_id,p_obra_id:cob.obra_id,p_desde:cob.desde,p_hasta:cob.hasta});
      cob.lineas=Array.isArray(r)?r:[]; cob.generado=true; pintarCobResult();
    }catch(e){ ctx.toast('Error al generar.','error'); }
    btn.disabled=false; btn.textContent='Generar';
  }
  function cobTotales(){ let sub=0,iva=0; cob.lineas.forEach(l=>{ sub+=(+l.total||0); if(l.aplica_iva) iva+=(+l.total||0)*0.19; }); return {sub,iva,total:sub+iva}; }
  function pintarCobResult(){
    const box=el.querySelector('#c_result'); if(!box) return;
    if(!cob.lineas.length){ box.innerHTML='<div class="mcard"><div class="empty">No hay operaciones para liquidar en ese periodo.</div></div>'; return; }
    const t=cobTotales();
    function sec(nombre,filtro){
      const ls=cob.lineas.filter(filtro); if(!ls.length) return '';
      return '<div class="sec-h" style="margin:16px 0 6px"><b style="font-size:12px;text-transform:uppercase;color:var(--esc-d)">'+nombre+'</b></div>'+
        '<table class="mtable"><tr><th>Detalle</th><th style="text-align:right">Cantidad</th><th style="text-align:right">Vr. unit</th><th style="text-align:right">Total</th></tr>'+
        ls.map(l=>'<tr><td>'+esc(l.descripcion)+'</td><td style="text-align:right" class="mono">'+numEs(l.cantidad)+' '+esc(l.unidad||'')+'</td><td style="text-align:right" class="mono">'+money(l.precio_unit)+'</td><td style="text-align:right" class="mono">'+money(l.total)+'</td></tr>').join('')+'</table>';
    }
    box.innerHTML='<div class="mcard">'+
      '<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">'+esc(cob.cliente_nombre)+' · '+esc(cob.obra)+'</h3><span class="badge off mono">'+esc(cob.desde)+' a '+esc(cob.hasta)+'</span></div>'+
      sec('Recepcion / Disposicion', l=>l.seccion==='recepcion')+
      sec('Despacho', l=>l.seccion==='despacho')+
      sec('Transporte', l=>l.seccion==='transporte')+
      '<div style="margin-top:14px;margin-left:auto;max-width:320px">'+
        '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#F4F8F7;border-radius:8px"><span>Subtotal</span><span class="mono">'+money(t.sub)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:6px 10px"><span>IVA (19%)</span><span class="mono">'+money(t.iva)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:9px 10px;background:var(--esc);color:#fff;border-radius:8px;font-weight:800;font-size:16px"><span>TOTAL A FACTURAR</span><span class="mono">'+money(t.total)+'</span></div>'+
      '</div>'+
      (pCrear?'<div class="chk" style="margin-top:14px"><input type="checkbox" id="c_final" style="width:auto"'+(cob.es_final?' checked':'')+'> <label for="c_final" style="margin:0;text-transform:none;letter-spacing:0;font-family:inherit;font-size:13px;color:var(--ink)">Liquidacion <b>final</b> (cierra la obra)</label></div>':'')+
      '<div class="note">Al guardar: el periodo queda bloqueado, la obra avanza su "liquidado hasta", y la liquidacion se envia a Facturacion.</div>'+
      '<div style="display:flex;gap:10px;margin-top:8px">'+
        (pCrear?'<button class="btn primary" id="c_save">Guardar liquidacion</button>':'')+
        '<button class="btn ghost" id="c_pdf">Ver PDF</button></div>'+
      '</div>';
    const fin=box.querySelector('#c_final'); if(fin) fin.onchange=()=>cob.es_final=fin.checked;
    const sv=box.querySelector('#c_save'); if(sv) sv.onclick=cobGuardar;
    box.querySelector('#c_pdf').onclick=()=>pdfCob({numero:'(borrador)',cliente:cob.cliente_nombre,obra:cob.obra,desde:cob.desde,hasta:cob.hasta,estado:'borrador',lineas:cob.lineas});
  }
  async function cobGuardar(){
    const btn=el.querySelector('#c_save'); btn.disabled=true; btn.textContent='Guardando...';
    const lineas=cob.lineas.map(l=>({seccion:l.seccion,descripcion:l.descripcion,cantidad:+l.cantidad||0,unidad:l.unidad,precio_unit:+l.precio_unit||0,total:+l.total||0,aplica_iva:!!l.aplica_iva,producto_id:l.producto_id||null,tipo_articulo:l.tipo_articulo||null}));
    try{ const r=scalar(await ctx.rpc('rcd_liquidacion_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_obra_id:cob.obra_id,p_desde:cob.desde,p_hasta:cob.hasta,p_es_final:cob.es_final,p_lineas:lineas}));
      if(r==='SIN_PERMISO'){ ctx.toast('No tienes permiso.','error'); }
      else if(r==='FALTAN_DATOS'){ ctx.toast('Faltan datos.','error'); }
      else { ctx.log('Liquidacion','Liquidacion de cobro guardada', 'Periodo '+(cob.desde||'')+' a '+(cob.hasta||'')+(cob.es_final?' (final)':'')); ctx.toast('Liquidacion guardada y enviada a Facturacion'); cob.generado=false; cob.es_final=false; cob.obra_id=''; cob.desde=''; cobView('his'); return; }
    }catch(e){ ctx.toast('Error al guardar.','error'); }
    btn.disabled=false; btn.textContent='Guardar liquidacion';
  }
  async function cobSeguimiento(){
    const cont=el.querySelector('#cobCont'); cont.innerHTML='<div class="loading">Cargando...</div>';
    let rs=[]; try{ const r=await ctx.rpc('rcd_liquidaciones_pendientes',{p_gestor_id:ctx.ses.gestor_id}); rs=Array.isArray(r)?r:[]; }catch(e){}
    cont.innerHTML='<div class="mcard"><h3 style="margin:0 0 4px">Obras activas · estado de liquidacion</h3>'+
      '<p class="lead">Hasta donde va liquidada cada obra y que falta.</p>'+
      (rs.length?'<table class="mtable"><tr><th>Cliente</th><th>Obra</th><th>Liquidado hasta</th><th style="text-align:right">Pend.</th><th></th></tr>'+
        rs.map((o,i)=>'<tr><td>'+esc(o.cliente||'')+'</td><td><b>'+esc(o.obra||'')+'</b></td><td class="mono">'+(o.liquidado_hasta?esc(o.liquidado_hasta):'—')+'</td>'+
          '<td style="text-align:right"><span class="badge '+(o.pendientes>0?'warn':'ok')+'">'+(o.pendientes>0?o.pendientes:'al dia')+'</span></td>'+
          '<td><button class="btn '+(o.pendientes>0?'primary':'ghost')+' sm" data-liq="'+i+'">Liquidar</button></td></tr>').join('')+'</table>'
        :'<div class="empty">No hay obras activas.</div>')+'</div>';
    rs.forEach((o,i)=>{ const b=cont.querySelector('[data-liq="'+i+'"]'); if(b) b.onclick=async()=>{
      cob.cliente_id=''; cob.cliente_nombre=o.cliente||''; cob.obra_id=o.obra_id; cob.obra=o.obra||''; cob.generado=false;
      try{ const r=scalarRow(await ctx.rpc('rcd_liquidacion_obra_estado',{p_gestor_id:ctx.ses.gestor_id,p_obra_id:o.obra_id})); cob.liquidado_hasta=r?r.liquidado_hasta:null; cob.desde=r&&r.desde_sugerido?r.desde_sugerido:''; }catch(e){}
      // cargar la obra en el select: traemos sus datos via cliente
      cob.obras=[{id:o.obra_id,nombre:o.obra}];
      cobView('liq'); }; });
  }
  async function cobHistorial(){
    const cont=el.querySelector('#cobCont'); cont.innerHTML='<div class="loading">Cargando...</div>';
    let rs=[]; try{ const r=await ctx.rpc('rcd_liquidaciones_lista',{p_gestor_id:ctx.ses.gestor_id}); rs=Array.isArray(r)?r:[]; }catch(e){}
    cont.innerHTML='<div class="mcard"><h3 style="margin:0 0 4px">Periodos liquidados</h3>'+
      '<p class="lead">Cada periodo que ya liquidaste. Al guardarse pasan a Facturacion.</p>'+
      (rs.length?'<table class="mtable"><tr><th>N.º</th><th>Cliente / Obra</th><th>Periodo</th><th style="text-align:right">Total</th><th></th></tr>'+
        rs.map((l,i)=>'<tr><td class="mono"><b>'+esc(l.numero||'')+'</b>'+(l.es_final?'<br><span class="badge off" style="font-size:9px">FINAL</span>':'')+'</td>'+
          '<td>'+esc(l.cliente||'')+'<br><span style="font-size:12px;color:var(--muted)">'+esc(l.obra||'')+'</span></td>'+
          '<td class="mono">'+esc(l.desde||'')+' a '+esc(l.hasta||'')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(l.total)+'</td>'+
          '<td><button class="btn ghost sm" data-pdf="'+i+'">Ver PDF</button></td></tr>').join('')+'</table>'
        :'<div class="empty">Aun no hay liquidaciones.</div>')+'</div>';
    rs.forEach((l,i)=>{ const b=cont.querySelector('[data-pdf="'+i+'"]'); if(b) b.onclick=()=>pdfCobId(l.id); });
  }

  // ===================== VOLQUETEROS =====================
  function volView(tab){
    const bd=body(); bd.innerHTML='';
    bd.appendChild(tabbar([{k:'liq',n:'Liquidar'},{k:'por',n:'Por pagar'},{k:'his',n:'Historial'}],tab,volView));
    const cont=document.createElement('div'); cont.id='volCont'; bd.appendChild(cont);
    if(tab==='liq') volLiquidar(); else if(tab==='por') volPorPagar(); else volHistorial();
  }
  async function volLiquidar(){
    const cont=el.querySelector('#volCont'); cont.innerHTML='<div class="loading">Cargando...</div>';
    if(!vol.volqs.length){ try{ const r=await ctx.rpc('rcd_volqueteros_lista',{p_gestor_id:ctx.ses.gestor_id}); vol.volqs=(Array.isArray(r)?r:[]).filter(x=>x.activo!==false); }catch(e){} }
    pintarVolForm(cont);
  }
  function pintarVolForm(cont){
    cont.innerHTML=
      '<div class="mcard">'+
      '<div class="row2"><div class="field"><label>Volquetero</label><select id="v_vq"><option value="">Selecciona...</option>'+
        vol.volqs.map(q=>'<option value="'+q.id+'"'+(vol.volquetero_id===q.id?' selected':'')+'>'+esc(q.nombre)+'</option>').join('')+'</select></div>'+
        '<div class="field"></div></div>'+
      '<div id="v_lock"></div>'+
      '<div class="row2"><div class="field"><label>Desde (bloqueado)</label><input id="v_desde" value="'+esc(vol.desde||'')+'" disabled></div>'+
        '<div class="field"><label>Hasta</label><input id="v_hasta" type="date" value="'+esc(vol.hasta||'')+'"></div></div>'+
      '<button class="btn primary" id="v_gen">Generar</button>'+
      '</div><div id="v_result"></div>';
    const selVq=cont.querySelector('#v_vq');
    selVq.onchange=async()=>{ vol.volquetero_id=selVq.value; vol.volquetero=(vol.volqs.find(q=>q.id===vol.volquetero_id)||{}).nombre||''; vol.desde=''; vol.pagado_hasta=null; vol.generado=false;
      if(vol.volquetero_id){ try{ const r=scalarRow(await ctx.rpc('rcd_liq_volq_estado',{p_gestor_id:ctx.ses.gestor_id,p_volquetero_id:vol.volquetero_id})); vol.pagado_hasta=r?r.pagado_hasta:null; vol.desde=r&&r.desde_sugerido?r.desde_sugerido:''; }catch(e){} }
      pintarVolForm(cont); };
    const lock=cont.querySelector('#v_lock');
    if(vol.volquetero_id){ lock.innerHTML='<div class="note" style="background:#E7F1EF;border-color:#C4DED9;color:#0B4A45">'+
      (vol.pagado_hasta?('Pagado hasta <b>'+esc(vol.pagado_hasta)+'</b>. '):'Sin pagos previos. ')+
      (vol.desde?('Arranca el <b>'+esc(vol.desde)+'</b> (bloqueado).'):'No hay viajes por pagar.')+'</div>'; }
    cont.querySelector('#v_gen').onclick=volGenerar;
    if(vol.generado) pintarVolResult();
  }
  async function volGenerar(){
    if(!vol.volquetero_id){ ctx.toast('Elige el volquetero.','error'); return; }
    vol.hasta=v(el,'v_hasta'); if(!vol.hasta){ ctx.toast('Elige la fecha Hasta.','error'); return; }
    if(!vol.desde){ ctx.toast('No hay viajes por pagar.','error'); return; }
    const btn=el.querySelector('#v_gen'); btn.disabled=true; btn.textContent='Generando...';
    try{ const r=await ctx.rpc('rcd_liq_volq_preview',{p_gestor_id:ctx.ses.gestor_id,p_volquetero_id:vol.volquetero_id,p_desde:vol.desde,p_hasta:vol.hasta});
      vol.lineas=Array.isArray(r)?r:[]; vol.generado=true; pintarVolResult();
    }catch(e){ ctx.toast('Error al generar.','error'); }
    btn.disabled=false; btn.textContent='Generar';
  }
  function pintarVolResult(){
    const box=el.querySelector('#v_result'); if(!box) return;
    if(!vol.lineas.length){ box.innerHTML='<div class="mcard"><div class="empty">No hay viajes por pagar en ese periodo.</div></div>'; return; }
    const tot=vol.lineas.reduce((a,l)=>a+(+l.pago||0),0);
    box.innerHTML='<div class="mcard">'+
      '<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">'+esc(vol.volquetero)+'</h3><span class="badge off mono">'+esc(vol.desde)+' a '+esc(vol.hasta)+'</span></div>'+
      '<table class="mtable" style="margin-top:10px"><tr><th>Fecha</th><th>Orden</th><th>Sentido</th><th>Obra</th><th style="text-align:right">Pago</th></tr>'+
      vol.lineas.map(l=>'<tr><td class="mono">'+esc(l.fecha||'')+'</td><td class="mono">'+esc(l.orden||'')+'</td><td><span class="badge '+(l.sentido==='entrega'?'off':'ok')+'">'+esc(l.sentido||'')+'</span></td><td>'+esc(l.obra||'')+'</td><td style="text-align:right" class="mono">'+money(l.pago)+'</td></tr>').join('')+'</table>'+
      '<div style="margin-top:12px;margin-left:auto;max-width:320px">'+
        '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#F4F8F7;border-radius:8px"><span>'+vol.lineas.length+' viajes</span><span></span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:9px 10px;background:var(--esc);color:#fff;border-radius:8px;font-weight:800;font-size:16px"><span>TOTAL A PAGAR</span><span class="mono">'+money(tot)+'</span></div>'+
      '</div>'+
      '<div class="note">Al guardar, el periodo se bloquea y avanza el "pagado hasta" del volquetero.</div>'+
      '<div style="display:flex;gap:10px;margin-top:8px">'+
        (pCrear?'<button class="btn primary" id="v_save">Guardar liquidacion</button>':'')+
        '<button class="btn ghost" id="v_pdf">Ver PDF</button></div>'+
      '</div>';
    const sv=box.querySelector('#v_save'); if(sv) sv.onclick=volGuardar;
    box.querySelector('#v_pdf').onclick=()=>pdfVol({numero:'(borrador)',volquetero:vol.volquetero,placa:vol.placa,desde:vol.desde,hasta:vol.hasta,lineas:vol.lineas});
  }
  async function volGuardar(){
    const btn=el.querySelector('#v_save'); btn.disabled=true; btn.textContent='Guardando...';
    const lineas=vol.lineas.map(l=>({orden_id:l.orden_id||'',fecha:l.fecha||'',sentido:l.sentido,obra:l.obra,pago:+l.pago||0}));
    try{ const r=scalar(await ctx.rpc('rcd_liq_volq_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_volquetero_id:vol.volquetero_id,p_desde:vol.desde,p_hasta:vol.hasta,p_lineas:lineas}));
      if(r==='SIN_PERMISO'){ ctx.toast('No tienes permiso.','error'); }
      else if(r==='FALTAN_DATOS'){ ctx.toast('Faltan datos.','error'); }
      else { ctx.log('Liquidacion','Pago de volquetero guardado', 'Periodo '+(vol.desde||'')+' a '+(vol.hasta||'')); ctx.toast('Pago de volquetero guardado'); vol.generado=false; vol.volquetero_id=''; vol.desde=''; volView('his'); return; }
    }catch(e){ ctx.toast('Error al guardar.','error'); }
    btn.disabled=false; btn.textContent='Guardar liquidacion';
  }
  async function volPorPagar(){
    const cont=el.querySelector('#volCont'); cont.innerHTML='<div class="loading">Cargando...</div>';
    let rs=[]; try{ const r=await ctx.rpc('rcd_liq_volq_pendientes',{p_gestor_id:ctx.ses.gestor_id}); rs=Array.isArray(r)?r:[]; }catch(e){}
    cont.innerHTML='<div class="mcard"><h3 style="margin:0 0 4px">Volqueteros con viajes por pagar</h3>'+
      (rs.length?'<table class="mtable"><tr><th>Volquetero</th><th>Placa</th><th>Pagado hasta</th><th style="text-align:right">Viajes</th><th style="text-align:right">Estimado</th><th></th></tr>'+
        rs.map((q,i)=>'<tr><td><b>'+esc(q.volquetero||'')+'</b></td><td class="mono">'+esc(q.placa||'')+'</td><td class="mono">'+(q.pagado_hasta?esc(q.pagado_hasta):'—')+'</td>'+
          '<td style="text-align:right">'+(q.pendientes||0)+'</td><td style="text-align:right" class="mono">'+money(q.estimado)+'</td>'+
          '<td><button class="btn '+(q.pendientes>0?'primary':'ghost')+' sm" data-liq="'+i+'">Liquidar</button></td></tr>').join('')+'</table>'
        :'<div class="empty">No hay volqueteros.</div>')+'</div>';
    rs.forEach((q,i)=>{ const b=cont.querySelector('[data-liq="'+i+'"]'); if(b) b.onclick=async()=>{
      if(!vol.volqs.length){ try{ const r=await ctx.rpc('rcd_volqueteros_lista',{p_gestor_id:ctx.ses.gestor_id}); vol.volqs=(Array.isArray(r)?r:[]).filter(x=>x.activo!==false); }catch(e){} }
      vol.volquetero_id=q.volquetero_id; vol.volquetero=q.volquetero||''; vol.placa=q.placa||''; vol.generado=false;
      try{ const r=scalarRow(await ctx.rpc('rcd_liq_volq_estado',{p_gestor_id:ctx.ses.gestor_id,p_volquetero_id:q.volquetero_id})); vol.pagado_hasta=r?r.pagado_hasta:null; vol.desde=r&&r.desde_sugerido?r.desde_sugerido:''; }catch(e){}
      volView('liq'); }; });
  }
  async function volHistorial(){
    const cont=el.querySelector('#volCont'); cont.innerHTML='<div class="loading">Cargando...</div>';
    let rs=[]; try{ const r=await ctx.rpc('rcd_liq_volq_lista',{p_gestor_id:ctx.ses.gestor_id}); rs=Array.isArray(r)?r:[]; }catch(e){}
    cont.innerHTML='<div class="mcard"><h3 style="margin:0 0 4px">Pagos liquidados</h3>'+
      (rs.length?'<table class="mtable"><tr><th>N.º</th><th>Volquetero</th><th>Periodo</th><th style="text-align:right">Total</th><th>Estado</th><th></th></tr>'+
        rs.map((l,i)=>'<tr><td class="mono"><b>'+esc(l.numero||'')+'</b></td><td>'+esc(l.volquetero||'')+'</td>'+
          '<td class="mono">'+esc(l.desde||'')+' a '+esc(l.hasta||'')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(l.total)+'</td>'+
          '<td><span class="badge '+(l.estado==='pagada'?'ok':'off')+'">'+esc(l.estado||'')+'</span></td>'+
          '<td><button class="btn ghost sm" data-pdf="'+i+'">Ver PDF</button></td></tr>').join('')+'</table>'
        :'<div class="empty">Aun no hay pagos.</div>')+'</div>';
    rs.forEach((l,i)=>{ const b=cont.querySelector('[data-pdf="'+i+'"]'); if(b) b.onclick=()=>pdfVolId(l.id); });
  }

  // ===================== PDF =====================
  async function gestor(){ try{ const r=await ctx.rpc('rcd_gestor',{p_gestor_id:ctx.ses.gestor_id}); return (Array.isArray(r)?r[0]:r)||{}; }catch(e){ return {}; } }
  function head(g,titulo,numero,meta){
    return '<div class="head"><div class="emp">'+
      (g.logo_url?'<img src="'+esc(g.logo_url)+'" style="max-height:50px"><br>':'')+
      '<div class="nm">'+esc(g.nombre||'Empresa')+'</div>'+(g.nit?'<div class="sb">NIT '+esc(g.nit)+'</div>':'')+
      '</div><div class="doc"><div class="h">'+titulo+'</div><div class="meta"><b>'+esc(numero||'')+'</b><br>'+meta+'</div></div></div>';
  }
  function shellPDF(inner){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">'+
      '<style>:root{--ink:#1A2B27;--muted:#6E7A77;--line:#D9E2DF;--esc:#0F766E;--esc-d:#0B4A45}'+
      '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      "body{margin:0;background:#E7E7E3;color:var(--ink);font-family:Barlow,sans-serif}"+
      '.wrap{max-width:780px;margin:0 auto;padding:18px}.bar{display:flex;justify-content:flex-end;margin-bottom:12px}'+
      '.bar button{border:none;border-radius:9px;padding:11px 18px;background:var(--esc);color:#fff;font-family:Barlow;font-weight:700;cursor:pointer}'+
      '.doc2{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px 30px}'+
      '.head{display:flex;justify-content:space-between;border-bottom:2px solid var(--esc);padding-bottom:12px}'+
      '.emp .nm{font-weight:900;font-size:18px}.emp .sb{font-family:JetBrains Mono,monospace;font-size:10px;color:var(--muted)}'+
      '.doc{text-align:right}.doc .h{font-size:20px;font-weight:900;color:var(--esc)}.doc .meta{font-family:JetBrains Mono,monospace;font-size:11px;color:var(--muted);margin-top:6px;line-height:1.6}'+
      '.parts{display:flex;gap:24px;flex-wrap:wrap;margin:14px 0;font-size:13px}.parts .k{font-family:JetBrains Mono,monospace;font-size:10px;text-transform:uppercase;color:var(--muted)}.parts .v{font-weight:600}'+
      '.st{font-family:JetBrains Mono,monospace;font-size:11px;text-transform:uppercase;color:var(--esc-d);margin:14px 0 4px;font-weight:700}'+
      'table{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px}'+
      'th{background:var(--esc);color:#fff;font-family:JetBrains Mono,monospace;font-size:10px;text-transform:uppercase;padding:9px 10px;text-align:left}th.r{text-align:right}'+
      'td{padding:9px 10px;border-bottom:1px solid #EEF3F1}td.r{text-align:right;font-family:JetBrains Mono,monospace}'+
      '.tot{margin-top:12px;margin-left:auto;width:300px}.tot div{display:flex;justify-content:space-between;padding:7px 10px}'+
      '.tot .g{background:var(--esc);color:#fff;border-radius:8px;font-weight:800;font-size:15px}.tot .s{background:#F4F8F7;border-radius:8px}'+
      '@page{size:A4;margin:12mm}@media print{body{background:#fff}.bar{display:none}.doc2{border:none}}'+
      '</style></head><body><div class="wrap"><div class="bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>'+
      '<div class="doc2">'+inner+'</div></div></body></html>';
  }
  async function abrir(buildFn){
    const w=window.open('','_blank'); if(!w){ ctx.toast('Permite las ventanas emergentes para ver el PDF.','error'); return; }
    w.document.write('<p style="font-family:Arial;padding:24px">Generando PDF...</p>');
    const g=await gestor(); w.document.open(); w.document.write(buildFn(g)); w.document.close();
  }
  function cobInner(g,d){
    let sub=0,iva=0; (d.lineas||[]).forEach(l=>{ sub+=(+l.total||0); if(l.aplica_iva) iva+=(+l.total||0)*0.19; }); const total=sub+iva;
    function sec(nombre,filtro){ const ls=(d.lineas||[]).filter(filtro); if(!ls.length) return '';
      return '<div class="st">'+nombre+'</div><table><thead><tr><th>Detalle</th><th class="r">Cant.</th><th class="r">Vr. unit</th><th class="r">Total</th></tr></thead><tbody>'+
      ls.map(l=>'<tr><td>'+esc(l.descripcion)+'</td><td class="r">'+numEs(l.cantidad)+' '+esc(l.unidad||'')+'</td><td class="r">'+money(l.precio_unit)+'</td><td class="r">'+money(l.total)+'</td></tr>').join('')+'</tbody></table>'; }
    return head(g,'LIQUIDACION',d.numero,esc(d.desde)+' a '+esc(d.hasta))+
      '<div class="parts"><div><div class="k">Cliente</div><div class="v">'+esc(d.cliente||'-')+'</div></div><div><div class="k">Obra</div><div class="v">'+esc(d.obra||'-')+'</div></div></div>'+
      sec('Recepcion / Disposicion',l=>l.seccion==='recepcion')+sec('Despacho',l=>l.seccion==='despacho')+sec('Transporte',l=>l.seccion==='transporte')+
      '<div class="tot"><div class="s"><span>Subtotal</span><span>'+money(sub)+'</span></div><div><span>IVA (19%)</span><span>'+money(iva)+'</span></div><div class="g"><span>TOTAL</span><span>'+money(total)+'</span></div></div>';
  }
  function pdfCob(d){ abrir(g=>shellPDF(cobInner(g,d))); }
  async function pdfCobId(id){
    const w=window.open('','_blank'); if(!w){ ctx.toast('Permite las ventanas emergentes.','error'); return; }
    w.document.write('<p style="font-family:Arial;padding:24px">Generando PDF...</p>');
    let cab={},ls=[]; try{ const r=await ctx.rpc('rcd_liquidacion_get',{p_id:id}); cab=(Array.isArray(r)?r[0]:r)||{}; }catch(e){}
    try{ const r=await ctx.rpc('rcd_liquidacion_lineas_get',{p_liquidacion_id:id}); ls=Array.isArray(r)?r:[]; }catch(e){}
    const g=await gestor();
    const d={numero:cab.numero,cliente:cab.cliente,obra:cab.obra,desde:cab.desde,hasta:cab.hasta,lineas:ls};
    w.document.open(); w.document.write(shellPDF(cobInner(g,d))); w.document.close();
  }
  function volInner(g,d){
    const tot=(d.lineas||[]).reduce((a,l)=>a+(+l.pago||0),0);
    return head(g,'PAGO VOLQUETERO',d.numero,esc(d.desde)+' a '+esc(d.hasta))+
      '<div class="parts"><div><div class="k">Volquetero</div><div class="v">'+esc(d.volquetero||'-')+'</div></div>'+(d.placa?'<div><div class="k">Placa</div><div class="v">'+esc(d.placa)+'</div></div>':'')+'</div>'+
      '<div class="st">Viajes del periodo</div><table><thead><tr><th>Fecha</th><th>Sentido</th><th>Obra</th><th class="r">Pago</th></tr></thead><tbody>'+
      (d.lineas||[]).map(l=>'<tr><td>'+esc(l.fecha||'')+'</td><td>'+esc(l.sentido||'')+'</td><td>'+esc(l.obra||'')+'</td><td class="r">'+money(l.pago)+'</td></tr>').join('')+'</tbody></table>'+
      '<div class="tot"><div class="s"><span>'+(d.lineas||[]).length+' viajes</span><span></span></div><div class="g"><span>TOTAL A PAGAR</span><span>'+money(tot)+'</span></div></div>';
  }
  function pdfVol(d){ abrir(g=>shellPDF(volInner(g,d))); }
  async function pdfVolId(id){
    const w=window.open('','_blank'); if(!w){ ctx.toast('Permite las ventanas emergentes.','error'); return; }
    w.document.write('<p style="font-family:Arial;padding:24px">Generando PDF...</p>');
    let cab={},ls=[]; try{ const r=await ctx.rpc('rcd_liq_volq_get',{p_id:id}); cab=(Array.isArray(r)?r[0]:r)||{}; }catch(e){}
    try{ const r=await ctx.rpc('rcd_liq_volq_lineas_get',{p_liquidacion_volq_id:id}); ls=Array.isArray(r)?r:[]; }catch(e){}
    const g=await gestor();
    const d={numero:cab.numero,volquetero:cab.volquetero,placa:cab.placa,desde:cab.desde,hasta:cab.hasta,lineas:ls};
    w.document.open(); w.document.write(shellPDF(volInner(g,d))); w.document.close();
  }

  // helper: primera fila de una funcion que devuelve table
  function scalarRow(r){ if(Array.isArray(r)) return r[0]||null; return r||null; }

  shell();
};
