// ============================================================
// RCD PRO · Modulo Facturacion (clave 'facturacion') · FASE 1
// Anticipos/Saldos por obra (funcional) + estructura para TNS (Fase 2).
// (usa helpers globales: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.facturacion = function(el, ctx){
  const pCrear = ctx.can('facturacion','escribir');
  const esAdmin = (ctx.ses && ctx.ses.rol === 'Administrador');
  function money(n){ return '$ '+numEs(Math.round(+n||0)); }
  function row1(r){ return Array.isArray(r) ? (r[0]||null) : (r||null); }
  let tab='ant';
  let obraSel=null; // obra abierta en Anticipos

  function shell(){
    el.innerHTML=
      '<div style="max-width:920px">'+
      '<h2 style="font-size:20px;font-weight:800;margin:0 0 2px">Facturacion</h2>'+
      '<p class="lead" style="margin:0 0 14px">Anticipos y saldos por obra. La emision en TNS se activa en la siguiente fase.</p>'+
      '<div class="tabbar" id="fbar"></div><div id="fbody"></div></div>';
    const tabs=[['ant','Anticipos / Saldos'],['cartera','Cartera'],['fact','Por facturar'],['emi','Emitidas'],['sync','Sincronizacion TNS'],['cfg','Configuracion']];
    const bar=el.querySelector('#fbar');
    bar.innerHTML=tabs.map(t=>'<button class="tab'+(t[0]===tab?' active':'')+'" data-k="'+t[0]+'">'+t[1]+'</button>').join('');
    bar.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{ tab=b.dataset.k; shell(); });
    if(tab==='ant') antView(); else if(tab==='cartera') carteraView(); else if(tab==='fact') factView(); else if(tab==='emi') emiView(); else if(tab==='sync') syncView(); else cfgView();
  }
  function body(){ return el.querySelector('#fbody'); }

  // ===================== CARTERA (solo lectura desde TNS) =====================
  let carteraData=null, carteraFiltro='';
  async function carteraView(){
    const bd=body();
    bd.innerHTML=
      '<div class="mcard"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
      '<h3 style="margin:0">Cartera (desde TNS)</h3>'+
      '<span id="semaforo" class="badge warn">Sincronizando...</span></div>'+
      '<div class="note" style="margin-top:6px">Saldos reales de TNS. Se actualiza solo al abrir esta pestaña.</div>'+
      '<input id="cartBuscar" placeholder="Buscar cliente por nombre o NIT..." style="width:100%;margin-top:10px" value="'+esc(carteraFiltro)+'">'+
      '<div id="cartResumen" style="margin-top:10px"></div>'+
      '<div id="cartTabla" style="margin-top:6px"><div class="loading">Consultando TNS...</div></div></div>';

    const buscar=bd.querySelector('#cartBuscar');
    buscar.oninput=()=>{ carteraFiltro=buscar.value.trim().toLowerCase(); pintarCartera(); };

    // sincroniza sola al abrir
    let cfg={}; try{ cfg=row1(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id}))||{}; }catch(e){}
    if(!cfg.tiene_credenciales){ setSemaforo('off','TNS sin conectar'); bd.querySelector('#cartTabla').innerHTML='<div class="note warn">Conecta TNS en Configuracion para ver la cartera.</div>'; return; }

    let clientes=[]; try{ const r=await ctx.rpc('rcd_tns_clientes_con_tns',{p_gestor_id:ctx.ses.gestor_id}); clientes=Array.isArray(r)?r:[]; }catch(e){}
    if(!clientes.length){ setSemaforo('warn','Sin clientes TNS'); bd.querySelector('#cartTabla').innerHTML='<div class="empty">No hay clientes emparejados con TNS todavia. Traelos en Sincronizacion TNS.</div>'; return; }

    try{
      const r=await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({accion:'traer_cartera',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,codigosucursal:cfg.codigo_sucursal||'00',
          clientes:clientes.map(c=>({cliente_id:c.cliente_id,cod_tercero:c.cod_tercero}))})}).then(x=>x.json());
      if(!(r&&r.ok)){ setSemaforo('off','Error TNS'); bd.querySelector('#cartTabla').innerHTML='<div class="note warn">TNS no respondio: '+esc((r&&r.error)||'error')+'</div>'; return; }
      // unir nombres
      const byId={}; clientes.forEach(c=>byId[c.cliente_id]={razon_social:c.razon_social,nit:c.nit});
      carteraData=(r.cartera||[]).map(x=>({...x, razon_social:(byId[x.cliente_id]||{}).razon_social||'(cliente)', nit:(byId[x.cliente_id]||{}).nit||''}));
      const fallidos=carteraData.filter(x=>!x.ok).length;
      const hora=new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
      if(fallidos===0) setSemaforo('ok','Sincronizado · '+hora);
      else setSemaforo('warn', fallidos+' sin responder · '+hora);
      pintarCartera();
    }catch(e){ setSemaforo('off','Sin conexion'); bd.querySelector('#cartTabla').innerHTML='<div class="note warn">Error de conexion.</div>'; }
  }

  function setSemaforo(tipo,txt){ const s=el.querySelector('#semaforo'); if(!s) return; s.className='badge '+(tipo==='ok'?'ok':(tipo==='off'?'danger':'warn')); s.textContent=txt; }

  function pintarCartera(){
    const cont=el.querySelector('#cartTabla'), res=el.querySelector('#cartResumen'); if(!cont||!carteraData) return;
    let lista=carteraData.filter(x=>x.ok);
    if(carteraFiltro) lista=lista.filter(x=>((x.razon_social||'').toLowerCase().indexOf(carteraFiltro)>=0)||((x.nit||'').toLowerCase().indexOf(carteraFiltro)>=0));
    const totSaldo=lista.reduce((a,x)=>a+(+x.saldo||0),0);
    const totAnt=lista.reduce((a,x)=>a+(+x.anticipo||0),0);
    res.innerHTML='<div class="row2"><div class="field" style="margin:0"><label>Cartera total</label><div class="mono" style="font-size:18px;font-weight:800;color:#A02114">'+money(totSaldo)+'</div></div>'+
      '<div class="field" style="margin:0"><label>Anticipos</label><div class="mono" style="font-size:18px;font-weight:800;color:#0B6B4F">'+money(totAnt)+'</div></div></div>';
    if(!lista.length){ cont.innerHTML='<div class="empty">Sin resultados.</div>'; return; }
    cont.innerHTML='<table class="mtable"><tr><th>Cliente</th><th style="text-align:right">Saldo TNS</th><th style="text-align:right">Anticipos</th><th></th></tr>'+
      lista.map((x,i)=>'<tr class="cartrow" data-i="'+i+'" style="cursor:pointer"><td><b>'+esc(x.razon_social)+'</b><br><span style="font-size:11px;color:var(--muted)" class="mono">'+esc(x.nit||'')+'</span></td>'+
        '<td style="text-align:right" class="mono" style="color:'+((+x.saldo)>0?'#A02114':'#0B6B4F')+'">'+money(x.saldo)+'</td>'+
        '<td style="text-align:right" class="mono">'+money(x.anticipo)+'</td>'+
        '<td><i class="ti ti-chevron-down" style="color:#aaa"></i></td></tr>'+
        '<tr class="cartdet" data-d="'+i+'" style="display:none"><td colspan="4" style="background:#F7FAF9;padding:0"></td></tr>').join('')+'</table>';
    lista.forEach((x,i)=>{ const row=cont.querySelector('.cartrow[data-i="'+i+'"]'); if(row) row.onclick=()=>toggleDet(i,x); });
  }

  function toggleDet(i,x){
    const det=el.querySelector('.cartdet[data-d="'+i+'"]'); if(!det) return;
    if(det.style.display!=='none'){ det.style.display='none'; return; }
    el.querySelectorAll('.cartdet').forEach(d=>d.style.display='none');
    const fs=x.facturas||[];
    det.querySelector('td').innerHTML = fs.length?
      '<table class="mtable" style="margin:0"><tr><th>Factura</th><th>Vence</th><th style="text-align:right">Dias</th><th style="text-align:right">Valor</th><th style="text-align:right">Saldo</th></tr>'+
      fs.map(f=>'<tr><td class="mono">'+esc(f.numero||'')+'</td><td class="mono">'+esc(f.fechaVence||'')+'</td>'+
        '<td style="text-align:right" class="mono">'+esc(String(f.diasVencimiento||''))+'</td>'+
        '<td style="text-align:right" class="mono">'+money(f.valor)+'</td>'+
        '<td style="text-align:right" class="mono" style="color:'+((+f.saldo)>0?'#A02114':'#0B6B4F')+'">'+money(f.saldo)+'</td></tr>').join('')+'</table>'
      : '<div class="empty" style="margin:0">Sin facturas pendientes.</div>';
    det.style.display='';
  }

  // ===================== ANTICIPOS / SALDOS =====================
  async function antView(){
    const bd=body(); bd.innerHTML='<div class="loading">Cargando...</div>';
    let rs=[]; try{ const r=await ctx.rpc('rcd_obras_saldos',{p_gestor_id:ctx.ses.gestor_id}); rs=Array.isArray(r)?r:[]; }catch(e){}
    bd.innerHTML=
      '<div class="note">La orden descuenta del anticipo (precio de cotizacion). Si el saldo llega a 0 se bloquean las ordenes; solo el administrador desbloquea.</div>'+
      '<div class="mcard"><h3 style="margin:0 0 4px">Saldos por obra</h3>'+
      (rs.length?'<table class="mtable"><tr><th>Obra / Cliente</th><th>Cotizacion</th><th style="text-align:right">Abonado</th><th style="text-align:right">Consumido</th><th style="text-align:right">Saldo</th><th>Estado</th><th></th></tr>'+
        rs.map((o,i)=>'<tr><td><b>'+esc(o.obra||'')+'</b><br><span style="font-size:12px;color:var(--muted)">'+esc(o.cliente||'')+'</span></td>'+
          '<td>'+(o.cot_numero?('<b class="mono">'+esc(o.cot_numero)+'</b><br><span style="font-size:11.5px;color:var(--muted)">'+esc(o.cot_fecha||'')+' · '+money(o.cot_total)+'</span>'):'<span class="badge danger">sin cotizacion</span>')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(o.abonado)+'</td>'+
          '<td style="text-align:right" class="mono">'+money(o.consumido)+'</td>'+
          '<td style="text-align:right" class="mono" style="font-weight:700;color:'+((+o.saldo)<0?'#A02114':'#0B6B4F')+'">'+money(o.saldo)+'</td>'+
          '<td><span class="badge '+(o.bloqueada?'danger':'ok')+'">'+(o.bloqueada?'bloqueada':'activa')+'</span></td>'+
          '<td><button class="btn ghost sm" data-ver="'+i+'">Ver</button></td></tr>').join('')+'</table>'
        :'<div class="empty">No hay obras con anticipos ni cotizacion aceptada.</div>')+'</div>'+
      '<div id="antDet"></div>';
    rs.forEach((o,i)=>{ const b=bd.querySelector('[data-ver="'+i+'"]'); if(b) b.onclick=()=>{ obraSel=o; antDetalle(); }; });
    if(obraSel){ const cur=rs.find(x=>x.obra_id===obraSel.obra_id); if(cur){ obraSel=cur; antDetalle(); } }
  }

  async function antDetalle(){
    const box=el.querySelector('#antDet'); if(!box||!obraSel) return;
    box.innerHTML='<div class="mcard"><div class="loading">Cargando...</div></div>';
    let abonos=[]; try{ const r=await ctx.rpc('rcd_anticipos_lista',{p_obra_id:obraSel.obra_id}); abonos=Array.isArray(r)?r:[]; }catch(e){}
    let vig=null; try{ vig=row1(await ctx.rpc('rcd_obra_cotizacion_vigente',{p_gestor_id:ctx.ses.gestor_id,p_obra_id:obraSel.obra_id})); }catch(e){}
    const blq=obraSel.bloqueada;
    const modalidad=obraSel.modalidad||'anticipo';
    const cupo=+obraSel.cupo_credito||0;
    const disponible=(+obraSel.saldo||0)+(modalidad==='credito'?cupo:0);
    box.innerHTML='<div class="mcard">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<h3 style="margin:0">'+esc(obraSel.obra)+' · '+esc(obraSel.cliente||'')+'</h3>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
          (pCrear?'<button class="btn primary sm" id="aAdd">Registrar dinero</button>':'')+
          (esAdmin?'<button class="btn ghost sm" id="aCred">Configurar credito</button>':'')+
          (blq&&esAdmin?'<button class="btn sm" id="aUnlock" style="background:var(--orange);color:#fff;border:none">Desbloquear (admin)</button>':'')+
        '</div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 2px">'+
        '<span class="badge '+(modalidad==='credito'?'warn':'off')+'">'+(modalidad==='credito'?('Credito · cupo '+money(cupo)):'Anticipo')+'</span>'+
        (vig?'<span class="badge off">Cotizacion vigente: '+esc(vig.numero||'')+' ('+esc(vig.fecha||'')+')</span>':'<span class="badge danger">Sin cotizacion aceptada</span>')+
      '</div>'+
      (blq?'<div class="note warn" style="background:#FBE6E3;border-color:#F1C9C4;color:#A02114"><b>Obra bloqueada.</b> '+(modalidad==='credito'?'Se alcanzo el cupo de credito.':'El consumo alcanzo o supero el anticipo.')+' No se pueden crear ordenes nuevas hasta un nuevo abono'+(esAdmin?', ampliar cupo o desbloqueo.':' o que el administrador autorice.')+'</div>':'')+
      '<div class="row2" style="margin:10px 0">'+
        '<div style="background:#F4F8F7;border-radius:10px;padding:10px"><span style="font-size:12px;color:var(--muted)">Abonado</span><br><span class="mono" style="font-size:17px;font-weight:800">'+money(obraSel.abonado)+'</span></div>'+
        '<div style="background:'+(disponible<=0?'#FBE6E3':'var(--esc)')+';color:'+(disponible<=0?'#A02114':'#fff')+';border-radius:10px;padding:10px"><span style="font-size:12px;opacity:.85">'+(modalidad==='credito'?'Disponible (saldo+cupo)':'Saldo disponible')+'</span><br><span class="mono" style="font-size:17px;font-weight:800">'+money(disponible)+'</span></div>'+
      '</div>'+
      '<div id="aForm"></div><div id="cForm"></div>'+
      '<h3 style="margin:6px 0 0">Anticipos y abonos</h3>'+
      (abonos.length?'<table class="mtable"><tr><th>Fecha</th><th>Tipo</th><th style="text-align:right">Monto</th><th>Factura</th>'+(pCrear?'<th></th>':'')+'</tr>'+
        abonos.map(a=>'<tr><td class="mono">'+esc(a.fecha||'')+'</td>'+
          '<td>'+(a.tipo==='abono'?'<span class="badge esc">Abono</span>':'<span class="badge off">Anticipo</span>')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(a.monto)+'</td>'+
          '<td>'+(a.con_factura?'<span class="badge ok">'+esc(a.factura_ref||'con factura')+'</span>':'<span style="color:var(--muted);font-size:12px">—</span>')+'</td>'+
          (pCrear?'<td><button class="btn ghost sm" data-anu="'+a.id+'">Anular</button></td>':'')+'</tr>').join('')+'</table>'
        :'<div class="empty">Sin abonos registrados.</div>')+
      '<div class="note">Saldo: '+money(obraSel.saldo)+' · Consumido a la fecha: <b>'+money(obraSel.consumido)+'</b> (ordenes a precio de cotizacion, con IVA).</div>'+
      '</div>';
    const add=box.querySelector('#aAdd'); if(add) add.onclick=abonoForm;
    const cr=box.querySelector('#aCred'); if(cr) cr.onclick=()=>creditoForm(modalidad,cupo);
    const unl=box.querySelector('#aUnlock'); if(unl) unl.onclick=desbloquear;
    box.querySelectorAll('[data-anu]').forEach(b=>b.onclick=()=>anularAbono(b.dataset.anu));
  }

  function creditoForm(modActual,cupoActual){
    const fa=el.querySelector('#aForm'); if(fa) fa.innerHTML='';
    const f=el.querySelector('#cForm'); if(!f) return;
    f.innerHTML='<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin:8px 0">'+
      '<div style="font-weight:700;margin-bottom:8px">Modalidad de la obra</div>'+
      '<div class="row2"><div class="field"><label>Modalidad</label><select id="cr_mod">'+
        '<option value="anticipo"'+(modActual!=='credito'?' selected':'')+'>Anticipo (bloquea en 0)</option>'+
        '<option value="credito"'+(modActual==='credito'?' selected':'')+'>Credito (opera hasta el cupo)</option></select></div>'+
      '<div class="field"><label>Cupo de credito</label><input id="cr_cupo" inputmode="decimal" value="'+(cupoActual||0)+'"></div></div>'+
      '<div class="note">En Credito la obra puede operar sin anticipo hasta deber el cupo. Al llegar al cupo se bloquea (el admin puede ampliarlo o desbloquear).</div>'+
      '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn primary sm" id="cr_save">Guardar</button><button class="btn ghost sm" id="cr_cancel">Cancelar</button></div>'+
      '</div>';
    f.querySelector('#cr_cancel').onclick=()=>{ f.innerHTML=''; };
    f.querySelector('#cr_save').onclick=async()=>{
      const mod=v(el,'cr_mod'); const cupo=parseNum(v(el,'cr_cupo'))||0;
      const btn=f.querySelector('#cr_save'); btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_obra_credito_set',{p_usuario_id:ctx.ses.id,p_obra_id:obraSel.obra_id,p_modalidad:mod,p_cupo:cupo}));
        if(r==='OK'){ ctx.log('Facturacion','Modalidad de obra', (obraSel.obra||'')+': '+mod+(mod==='credito'?' (cupo '+numEs(cupo)+')':'')); ctx.toast('Modalidad actualizada'); antView(); return; }
        else if(r==='SOLO_ADMIN'){ ctx.toast('Solo el administrador puede configurar credito.','error'); }
        else ctx.toast('No se pudo.','error');
      }catch(e){ ctx.toast('Error.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  function abonoForm(){
    const fc=el.querySelector('#cForm'); if(fc) fc.innerHTML='';
    const f=el.querySelector('#aForm'); if(!f) return;
    const hoy=new Date().toISOString().slice(0,10);
    f.innerHTML='<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin:8px 0">'+
      '<div class="row2"><div class="field"><label>Fecha</label><input type="date" id="ab_fecha" value="'+hoy+'"></div>'+
      '<div class="field"><label>Monto</label><input id="ab_monto" inputmode="decimal" placeholder="0"></div></div>'+
      '<div class="field"><label>Tipo</label><select id="ab_tipo">'+
        '<option value="anticipo">Anticipo (por adelantado, sin factura)</option>'+
        '<option value="abono">Abono / pago (contra factura)</option></select></div>'+
      '<div class="field" id="ab_refwrap" style="display:none"><label>N.º factura</label><input id="ab_ref" placeholder="FV-...."></div>'+
      '<div class="note">El anticipo se factura despues, al facturar el periodo. El abono entra contra una factura ya emitida.</div>'+
      '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn primary sm" id="ab_save">Guardar</button><button class="btn ghost sm" id="ab_cancel">Cancelar</button></div>'+
      '</div>';
    const tp=f.querySelector('#ab_tipo'); tp.onchange=()=>{ f.querySelector('#ab_refwrap').style.display=(tp.value==='abono')?'block':'none'; };
    f.querySelector('#ab_cancel').onclick=()=>{ f.innerHTML=''; };
    f.querySelector('#ab_save').onclick=async()=>{
      const monto=parseNum(v(el,'ab_monto'));
      if(!monto||monto<=0){ ctx.toast('Pon un monto valido.','error'); return; }
      const tipo=tp.value;
      if(tipo==='abono' && !(v(el,'ab_ref')||'').trim()){ ctx.toast('El abono necesita el N.º de factura.','error'); return; }
      const btn=f.querySelector('#ab_save'); btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_anticipo_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_obra_id:obraSel.obra_id,p_fecha:v(el,'ab_fecha'),p_monto:monto,p_tipo:tipo,p_factura_ref:(tipo==='abono'?v(el,'ab_ref'):''),p_observacion:''}));
        if(r==='SIN_PERMISO'){ ctx.toast('No tienes permiso.','error'); }
        else if(r==='FALTAN_DATOS'){ ctx.toast('Faltan datos.','error'); }
        else if(r==='FALTA_FACTURA'){ ctx.toast('El abono necesita el N.º de factura.','error'); }
        else { ctx.log('Facturacion', tipo==='abono'?'Abono registrado':'Anticipo registrado', (obraSel.obra||'')+': '+numEs(monto)+(tipo==='abono'?' (fact. '+(v(el,'ab_ref')||'')+')':'')); ctx.toast(tipo==='abono'?'Abono registrado':'Anticipo registrado'); antView(); return; }
      }catch(e){ ctx.toast('Error al guardar.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }

  async function anularAbono(id){
    const ok=await ctx.confirm('¿Anular este abono?'); if(!ok) return;
    try{ const r=scalar(await ctx.rpc('rcd_anticipo_anular',{p_usuario_id:ctx.ses.id,p_id:id}));
      if(r==='OK'){ ctx.log('Facturacion','Abono anulado', (obraSel.obra||'')); ctx.toast('Abono anulado'); antView(); } else ctx.toast('No se pudo.','error');
    }catch(e){ ctx.toast('Error.','error'); }
  }

  async function desbloquear(){
    const ok=await ctx.confirm('¿Desbloquear esta obra para permitir ordenes con saldo en cero o negativo?'); if(!ok) return;
    try{ const r=scalar(await ctx.rpc('rcd_obra_desbloquear',{p_usuario_id:ctx.ses.id,p_obra_id:obraSel.obra_id}));
      if(r==='OK'){ ctx.log('Facturacion','Obra desbloqueada', (obraSel.obra||'')); ctx.toast('Obra desbloqueada'); antView(); }
      else if(r==='SOLO_ADMIN'){ ctx.toast('Solo el administrador puede desbloquear.','error'); }
      else ctx.toast('No se pudo.','error');
    }catch(e){ ctx.toast('Error.','error'); }
  }

  // ===================== POR FACTURAR =====================
  async function factView(){
    const bd=body(); bd.innerHTML='<div class="loading">Cargando...</div>';
    let rs=[]; try{ const r=await ctx.rpc('rcd_tns_porfacturar_lista',{p_gestor_id:ctx.ses.gestor_id}); rs=Array.isArray(r)?r:[]; }catch(e){}
    if(!rs.length){ bd.innerHTML='<div class="mcard"><h3 style="margin:0 0 4px">Por facturar</h3><div class="empty">No hay liquidaciones pendientes de facturar.</div></div>'; return; }
    // agrupar por cliente
    const grupos={};
    rs.forEach(l=>{ const k=l.cliente_id||'sin'; if(!grupos[k]) grupos[k]={cliente_id:l.cliente_id,cliente:l.cliente,cod_tercero:l.cod_tercero,liqs:[]}; grupos[k].liqs.push(l); });
    let html='<div class="mcard"><h3 style="margin:0 0 4px">Por facturar</h3>'+
      '<p class="lead">Marca una o varias liquidaciones de un mismo cliente y prepara la factura. Cada liquidacion ira como bloque.</p></div>';
    Object.values(grupos).forEach((g,gi)=>{
      const tieneTns=!!g.cod_tercero;
      html+='<div class="mcard"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'+
        '<h3 style="margin:0">'+esc(g.cliente||'(sin cliente)')+' '+(tieneTns?'<span class="badge ok mono">TNS '+esc(g.cod_tercero)+'</span>':'<span class="badge danger">Sin TNS</span>')+'</h3></div>'+
        (tieneTns?'':'<div class="note warn" style="margin-top:6px">Este cliente no esta emparejado con TNS. Traelo en Sincronizacion TNS antes de facturar.</div>')+
        '<table class="mtable" style="margin-top:8px"><tr><th></th><th>N.º Liq.</th><th>Obra</th><th>Periodo</th><th style="text-align:right">Total</th></tr>'+
        g.liqs.map(l=>'<tr><td><input type="checkbox" class="cliq" data-g="'+gi+'" value="'+l.liquidacion_id+'" style="width:auto"'+(tieneTns?'':' disabled')+'></td>'+
          '<td class="mono"><b>'+esc(l.numero||'')+'</b></td><td>'+esc(l.obra||'')+'</td>'+
          '<td class="mono">'+esc(l.desde||'')+' a '+esc(l.hasta||'')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(l.total)+'</td></tr>').join('')+'</table>'+
        (tieneTns&&pCrear?'<div style="margin-top:8px"><button class="btn primary sm" data-prep="'+gi+'">Preparar factura</button></div>':'')+
        '</div>';
    });
    bd.innerHTML=html;
    const gruposArr=Object.values(grupos);
    bd.querySelectorAll('[data-prep]').forEach(b=>{ const gi=+b.dataset.prep; b.onclick=()=>{
      const ids=Array.from(bd.querySelectorAll('.cliq[data-g="'+gi+'"]:checked')).map(x=>x.value);
      if(!ids.length){ ctx.toast('Marca al menos una liquidacion.','error'); return; }
      prepararFactura(gruposArr[gi], ids);
    }; });
  }

  async function prepararFactura(grupo, liqIds){
    const bd=body(); bd.innerHTML='<div class="loading">Cargando lineas...</div>';
    let ls=[]; try{ const r=await ctx.rpc('rcd_tns_factura_lineas',{p_gestor_id:ctx.ses.gestor_id,p_liq_ids:liqIds}); ls=Array.isArray(r)?r:[]; }catch(e){}
    if(!ls.length){ bd.innerHTML='<div class="mcard"><div class="empty">No se encontraron lineas.</div><button class="btn ghost" id="bVolver">Volver</button></div>'; const bv=bd.querySelector('#bVolver'); if(bv) bv.onclick=factView; return; }
    // agrupar por liquidacion (bloques)
    const bloques={};
    ls.forEach(l=>{ if(!bloques[l.liquidacion_id]) bloques[l.liquidacion_id]={num:l.liq_numero,lineas:[]}; bloques[l.liquidacion_id].lineas.push(l); });
    const faltan=ls.filter(l=>!l.vinculada);
    let sub=0,iva=0; ls.forEach(l=>{ sub+=(+l.total||0); if(l.aplica_iva) iva+=(+l.total||0)*0.19; });
    const total=sub+iva;

    let html='<div class="mcard"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'+
      '<h3 style="margin:0">Factura · '+esc(grupo.cliente||'')+'</h3><span class="badge ok mono">TNS '+esc(grupo.cod_tercero||'')+'</span></div>';
    if(faltan.length) html+='<div class="note warn" style="margin-top:8px">Hay '+faltan.length+' linea(s) sin codigo TNS. Empareja el producto en Parametros, o pon el codigo de Disposicion/Transporte en Configuracion, antes de facturar.</div>';
    Object.values(bloques).forEach(b=>{
      html+='<div style="margin-top:14px"><b style="font-size:12px;text-transform:uppercase;color:var(--esc-d)">Liquidacion '+esc(b.num||'')+'</b>'+
        '<table class="mtable" style="margin-top:4px"><tr><th>Detalle</th><th>Cod TNS</th><th style="text-align:right">Cant.</th><th style="text-align:right">Vr. unit</th><th style="text-align:right">IVA</th><th style="text-align:right">Total</th></tr>'+
        b.lineas.map(l=>'<tr><td>'+esc(l.descripcion||'')+'</td>'+
          '<td>'+(l.vinculada?'<span class="badge ok mono">'+esc(l.cod_tns)+'</span>':'<span class="badge danger">Sin cod</span>')+'</td>'+
          '<td style="text-align:right" class="mono">'+numEs(l.cantidad)+' '+esc(l.unidad||'')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(l.precio_unit)+'</td>'+
          '<td style="text-align:right" class="mono">'+(l.aplica_iva?'19%':'0%')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(l.total)+'</td></tr>').join('')+'</table></div>';
    });
    html+='<div style="margin-top:14px;margin-left:auto;max-width:320px">'+
      '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#F4F8F7;border-radius:8px"><span>Subtotal</span><span class="mono">'+money(sub)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:6px 10px"><span>IVA (19%)</span><span class="mono">'+money(iva)+'</span></div>'+
      '<div style="display:flex;justify-content:space-between;padding:9px 10px;background:var(--esc);color:#fff;border-radius:8px;font-weight:800;font-size:16px"><span>TOTAL</span><span class="mono">'+money(total)+'</span></div></div>'+
      '<div class="note" style="margin-top:12px">Al confirmar se <b>emite la factura a la DIAN</b> (con su CUFE). Esto es legal y no se puede deshacer. Revisa bien antes.</div>'+
      '<div style="display:flex;gap:10px;margin-top:10px"><button class="btn ghost" id="bVolver">Volver</button>'+
      '<button class="btn primary" id="bCrear"'+(faltan.length?' disabled':'')+'>Emitir a la DIAN</button></div></div>';
    bd.innerHTML=html;
    bd.querySelector('#bVolver').onclick=factView;
    const bc=bd.querySelector('#bCrear'); if(bc) bc.onclick=()=>crearBorrador(grupo, liqIds, ls, {sub,iva,total}, bc);
  }

  async function crearBorrador(grupo, liqIds, lineas, tot, btn){
    const ok=await ctx.confirm('Vas a EMITIR esta factura a la DIAN por '+money(tot.total)+'. Es legal y no se puede deshacer. ¿Continuar?');
    if(!ok) return;
    btn.disabled=true; btn.textContent='Emitiendo...';
    try{
      const cfg=row1(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id}))||{};
      const hoy=new Date(); const dd=String(hoy.getDate()).padStart(2,'0'), mm=String(hoy.getMonth()+1).padStart(2,'0'), yy=hoy.getFullYear();
      const fecha=dd+'/'+mm+'/'+yy;
      const detalle=lineas.map(l=>({
        codMat: l.cod_tns,
        codBodega: cfg.cod_bodega_def||'00',
        cantidad: +l.cantidad||0,
        tipoUnidad: 'M',
        descuento: 0,
        porcIva: l.aplica_iva?19:0,
        valor: +l.precio_unit||0,
        impConsumo: 0
      }));
      const nums=[...new Set(lineas.map(l=>l.liq_numero))].join(', ');
      const factura={
        codigoPrefijo: cfg.codigo_prefijo||'',
        fecha: fecha,
        codTercero: grupo.cod_tercero,
        nombreCliente: grupo.cliente||'',
        codFormaPago: cfg.cod_forma_pago_def||'CO',
        fechaVence: fecha,
        observacion: 'Liquidaciones: '+nums,
        detallePedido: detalle,
        detalleFormaPago: [],
        asentar: 1,
        detalleDescuentos: []
      };
      const r=await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({accion:'crear_factura',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,codigosucursal:cfg.codigo_sucursal||'00',factura})}).then(x=>x.json());
      if(!(r&&r.ok&&r.success!==false)){
        ctx.toast('TNS no acepto: '+((r&&(r.mensaje||r.error))||'error'),'error');
        btn.disabled=false; btn.textContent='Emitir a la DIAN'; return;
      }
      try{ await ctx.rpc('rcd_tns_factura_registrar',{p_gestor_id:ctx.ses.gestor_id,p_cliente_id:grupo.cliente_id,p_liq_ids:liqIds,
        p_cod_tercero:grupo.cod_tercero,p_nombre_cliente:grupo.cliente||'',p_consecutivo:r.consecutivo||'',
        p_subtotal:tot.sub,p_iva:tot.iva,p_total:tot.total,p_estado:'emitida',p_mensaje:r.mensaje||'',p_kardexid:r.kardexid||''}); }catch(e){}
      ctx.log('Facturacion TNS','Factura emitida', (grupo.cliente||'')+' · '+(r.consecutivo||'')+' · '+money(tot.total));
      ctx.toast('Factura emitida'+(r.consecutivo?(' (N.º '+r.consecutivo+')'):''));
      emiView();
    }catch(e){ ctx.toast('Error de conexion.','error'); btn.disabled=false; btn.textContent='Emitir a la DIAN'; }
  }

  // ===================== EMITIDAS =====================
  async function emiView(){
    const bd=body(); bd.innerHTML='<div class="loading">Cargando...</div>';
    let fs=[]; try{ const r=await ctx.rpc('rcd_tns_facturas_lista',{p_gestor_id:ctx.ses.gestor_id}); fs=Array.isArray(r)?r:[]; }catch(e){}
    bd.innerHTML='<div class="mcard" style="max-width:none"><h3 style="margin:0 0 4px">Facturas en TNS</h3>'+
      '<p class="lead">Facturas emitidas a la DIAN. Usa "Actualizar estado" para traer el CUFE cuando la DIAN lo valide.</p>'+
      (fs.length?'<div style="overflow-x:auto"><table class="mtable" style="min-width:680px"><tr><th>N.º</th><th>Cliente</th><th>Estado DIAN</th><th style="text-align:right">Total</th><th>Fecha</th><th></th></tr>'+
        fs.map((f,i)=>{ const ed=(f.estado_dian||'').toLowerCase();
          const est=f.cufe?('<span class="badge ok">'+(esc(f.estado_dian||'Aceptada'))+'</span>')
            :(ed.indexOf('rechaz')>=0?'<span class="badge danger">Rechazada</span>':'<span class="badge warn">Sin CUFE aun</span>');
          const fch=f.creada_en?String(f.creada_en).slice(0,10):'';
          return '<tr><td class="mono"><b>'+esc(f.consecutivo||'—')+'</b></td>'+
            '<td>'+esc(f.nombre_cliente||'')+'</td><td>'+est+(f.cufe?'<br><span style="font-size:9px;color:var(--muted)">CUFE '+esc(String(f.cufe).slice(0,10))+'...</span>':'')+'</td>'+
            '<td style="text-align:right" class="mono">'+money(f.total)+'</td>'+
            '<td class="mono">'+esc(fch)+'</td>'+
            '<td>'+(f.kardexid&&!f.cufe?'<button class="btn ghost sm" data-est="'+i+'">Actualizar estado</button>':'')+'</td></tr>'; }).join('')+'</table></div>'
        :'<div class="empty">Sin facturas todavia.</div>')+'</div>';
    bd.querySelectorAll('[data-est]').forEach(b=>{ const i=+b.dataset.est; b.onclick=()=>actualizarEstado(fs[i], b); });
  }

  async function actualizarEstado(f, btn){
    btn.disabled=true; btn.textContent='Consultando...';
    try{
      const cfg=row1(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id}))||{};
      const r=await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({accion:'detallar_factura',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,kardexid:f.kardexid,codigosucursal:cfg.codigo_sucursal||'00'})}).then(x=>x.json());
      if(!(r&&r.ok)){ ctx.toast('TNS: '+((r&&r.error)||'error'),'error'); btn.disabled=false; btn.textContent='Actualizar estado'; return; }
      await ctx.rpc('rcd_tns_factura_estado_set',{p_gestor_id:ctx.ses.gestor_id,p_factura_id:f.id,p_kardexid:f.kardexid,p_cufe:r.cufe||'',p_estado_dian:r.estadoDian||''});
      if(r.cufe){ ctx.log('Facturacion TNS','Estado DIAN actualizado', (f.consecutivo||'')+' · '+(r.estadoDian||'con CUFE')); ctx.toast('Estado actualizado'+(r.estadoDian?(': '+r.estadoDian):'')); }
      else ctx.toast('Aun sin CUFE. La DIAN puede tardar unos minutos.','info');
      emiView();
    }catch(e){ ctx.toast('Error de conexion.','error'); btn.disabled=false; btn.textContent='Actualizar estado'; }
  }

  // ===================== SINCRONIZACION TNS =====================
  async function syncView(){
    const bd=body();
    bd.innerHTML=
      '<div class="mcard"><h3 style="margin:0 0 4px">Materiales y servicios → TNS</h3>'+
      '<div class="note">Los materiales/productos ahora se sincronizan en <b>Parametros → Productos terminados</b>, donde cada uno muestra su estado TNS (verde si esta vinculado). Aqui ya no se gestionan.</div></div>'+
      '<div class="mcard"><h3 style="margin:0 0 4px">Clientes → tercero en TNS</h3>'+
      '<div class="note">Trae tus clientes de TNS (con su codigo, NIT y ciudad). Se emparejan por NIT con los de RCD Pro: si existe se actualiza, si no se crea.</div>'+
      (pCrear?'<div style="margin-top:8px"><button class="btn ghost sm" id="bTraerCli">Traer clientes de TNS</button></div>':'')+
      '<div id="cliRes" class="note" style="display:none;margin-top:10px"></div></div>';

    const tc=bd.querySelector('#bTraerCli'); if(tc) tc.onclick=async function(){
      const btn=this, box=bd.querySelector('#cliRes'); btn.disabled=true; btn.textContent='Trayendo...';
      try{
        const r=await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({accion:'traer_clientes',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,filtro:''})}).then(x=>x.json());
        if(!(r&&r.ok)){ ctx.toast(r&&r.error==='SIN_CREDENCIALES'?'Primero conecta TNS en Configuracion.':('TNS: '+((r&&r.error)||'error')),'error'); btn.disabled=false; btn.textContent='Traer clientes de TNS'; return; }
        const cli=r.clientes||[];
        if(r.sin_campo_cliente){ if(box){box.style.display='block'; box.className='note warn'; box.textContent='TNS no marca cuales son clientes en el listado (trajo '+(r.total_tns||0)+' terceros). Avisame para ajustar el filtro.';} btn.disabled=false; btn.textContent='Traer clientes de TNS'; return; }
        if(!cli.length){ if(box){box.style.display='block'; box.className='note warn'; box.textContent='TNS devolvio '+(r.total_tns||0)+' terceros pero ninguno marcado como cliente.';} btn.disabled=false; btn.textContent='Traer clientes de TNS'; return; }
        btn.textContent='Importando '+cli.length+'...';
        const imp=scalar(await ctx.rpc('rcd_tns_clientes_importar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_clientes:cli}));
        if(typeof imp==='string' && imp.indexOf('OK:')===0){
          const p=imp.split(':'); const creados=p[1]||'0', actualizados=p[2]||'0';
          ctx.log('Facturacion TNS','Clientes importados', cli.length+' (nuevos '+creados+', actualizados '+actualizados+')');
          if(box){ box.style.display='block'; box.className='note'; box.textContent='Importados: '+cli.length+' clientes ('+creados+' nuevos, '+actualizados+' actualizados).'; }
          ctx.toast('Clientes importados de TNS');
        } else if(imp==='SOLO_ADMIN'){ ctx.toast('Solo el administrador.','error'); }
        else ctx.toast('No se pudieron importar.','error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Traer clientes de TNS';
    };
  }

  // ===================== CONFIGURACION =====================
  async function cfgView(){
    const bd=body(); bd.innerHTML='<div class="loading">Cargando...</div>';
    let c={}; try{ const r=row1(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id})); if(r) c=r; }catch(e){}
    const tieneCred=!!c.tiene_credenciales;
    const estado = tieneCred
      ? (c.ultima_conexion_ok===true ? '<span class="badge ok">Conexion correcta</span>'
        : c.ultima_conexion_ok===false ? '<span class="badge danger">Ultima prueba fallo</span>'
        : '<span class="badge warn">Credenciales guardadas, sin probar</span>')
      : '<span class="badge off">Sin credenciales</span>';
    bd.innerHTML=
      '<div class="mcard"><h3 style="margin:0 0 4px">Configuracion · Facturacion electronica</h3>'+
      '<div class="note">Conecta RCD Pro con tu proveedor para emitir facturas a la DIAN. La clave se guarda cifrada; el navegador nunca la vuelve a mostrar.</div>'+
      '<div class="field"><label>Proveedor</label><select id="cf_prov"><option value="TNS" selected>TNS</option><option value="" disabled>Alegra (proximamente)</option><option value="" disabled>Siigo (proximamente)</option></select></div>'+
      '<div style="margin:6px 0">Estado: '+estado+'</div>'+
      '<h3 style="margin:14px 0 4px;font-size:14px">Credenciales TNS</h3>'+
      (tieneCred?'<div class="note">Ya hay credenciales guardadas. Escribelas de nuevo solo si quieres cambiarlas.</div>':'')+
      '<div class="field"><label>Codigo de empresa</label><input id="cf_emp" placeholder="Ej. 001"></div>'+
      '<div class="field"><label>Usuario</label><input id="cf_usr" placeholder="Usuario TNS"></div>'+
      '<div class="field"><label>Contrasena</label><input id="cf_pwd" type="password" placeholder="'+(tieneCred?'(guardada) escribe para cambiar':'clave TNS')+'"></div>'+
      '<div class="field"><label>URL de la API</label><input id="cf_url" value="'+esc(c.url_base||'https://api.tns.co')+'"></div>'+
      (pCrear?'<button class="btn primary sm" id="cf_credsave">Guardar credenciales</button>':'')+
      '<h3 style="margin:16px 0 4px;font-size:14px">Datos de facturacion</h3>'+
      '<div class="row2"><div class="field"><label>Codigo sucursal</label><input id="cf_suc" value="'+esc(c.codigo_sucursal||'')+'" placeholder="Ej. 01"></div>'+
      '<div class="field"><label>Prefijo factura</label><input id="cf_pre" value="'+esc(c.codigo_prefijo||'')+'" placeholder="Ej. FE"></div></div>'+
      '<div class="row2"><div class="field"><label>Bodega por defecto</label><input id="cf_bod" value="'+esc(c.cod_bodega_def||'')+'" placeholder="Ej. 00"></div>'+
      '<div class="field"><label>Forma de pago por defecto</label><select id="cf_fp">'+
        '<option value="CO"'+((c.cod_forma_pago_def||'CO')==='CO'?' selected':'')+'>Contado (CO)</option>'+
        '<option value="CR"'+(c.cod_forma_pago_def==='CR'?' selected':'')+'>Credito (CR)</option></select></div></div>'+
      '<div class="note" style="margin-top:6px">Codigos de articulo TNS para los servicios que no son producto (los configuras en TNS y aqui pones su codigo):</div>'+
      '<div class="row2"><div class="field"><label>Cod. articulo Disposicion</label><input id="cf_disp" class="mono" value="'+esc(c.cod_disposicion||'')+'" placeholder="cod. TNS"></div>'+
      '<div class="field"><label>Cod. articulo Transporte</label><input id="cf_tra" class="mono" value="'+esc(c.cod_transporte||'')+'" placeholder="cod. TNS"></div></div>'+
      (pCrear?'<div style="display:flex;gap:8px;margin-top:8px"><button class="btn ghost sm" id="cf_datossave">Guardar datos</button><button class="btn primary sm" id="cf_test">Probar conexion</button></div>':'')+
      '</div>';

    async function srv(accion, extra){
      const r=await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(Object.assign({accion:accion,usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id},extra||{}))});
      return await r.json();
    }
    function errMsg(e){
      if(e && typeof e==='object'){ e = e.message ? (e.message+(e.code?' ['+e.code+']':'')) : JSON.stringify(e); }
      return ({SOLO_ADMIN:'Solo el administrador puede configurar.',SIN_CREDENCIALES:'Primero guarda las credenciales.',
        LLAVE_INVALIDA:'Falta configurar la llave de cifrado en el servidor.',NO_DESCIFRA:'No se pudieron leer las credenciales.',
        NO_CONECTA_TNS:'No se pudo conectar con TNS (revisa la URL o tu internet).',FALTA_GESTOR:'Error de sesion.'})[e] || ('TNS: '+(e||'error'));
    }

    const cs=bd.querySelector('#cf_credsave'); if(cs) cs.onclick=async function(){
      const emp=v(el,'cf_emp'),usr=v(el,'cf_usr'),pwd=v(el,'cf_pwd');
      if(!emp||!usr||!pwd){ ctx.toast('Escribe empresa, usuario y contrasena.','error'); return; }
      const btn=this; btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=await srv('guardar_credenciales',{cod_empresa:emp,usuario:usr,clave:pwd,url_base:v(el,'cf_url')});
        if(r&&r.ok){ ctx.log('Facturacion TNS','Credenciales guardadas',''); ctx.toast('Credenciales guardadas'); cfgView(); return; }
        ctx.toast(errMsg(r&&r.error),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar credenciales';
    };

    const ds=bd.querySelector('#cf_datossave'); if(ds) ds.onclick=async function(){
      try{ const r=scalar(await ctx.rpc('rcd_tns_config_datos_set',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,
        p_codigo_sucursal:v(el,'cf_suc'),p_codigo_prefijo:v(el,'cf_pre'),p_cod_bodega_def:v(el,'cf_bod'),
        p_cod_forma_pago_def:v(el,'cf_fp'),p_cod_vendedor_def:'',
        p_cod_disposicion:v(el,'cf_disp'),p_cod_transporte:v(el,'cf_tra')}));
        if(r==='OK'){ ctx.log('Facturacion TNS','Datos de facturacion guardados',''); ctx.toast('Datos guardados'); }
        else if(r==='SOLO_ADMIN') ctx.toast('Solo el administrador puede configurar.','error');
        else ctx.toast('No se pudo.','error');
      }catch(e){ ctx.toast('Error.','error'); }
    };

    const tt=bd.querySelector('#cf_test'); if(tt) tt.onclick=async function(){
      const btn=this; btn.disabled=true; btn.textContent='Probando...';
      try{ const r=await srv('probar_conexion',{});
        if(r&&r.ok){ ctx.log('Facturacion TNS','Probar conexion','OK'); ctx.toast('Conexion correcta con TNS'); cfgView(); return; }
        ctx.toast(errMsg(r&&r.error),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Probar conexion';
    };
  }

  shell();
};
