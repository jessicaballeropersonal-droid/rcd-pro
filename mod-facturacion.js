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
    const tabs=[['ant','Anticipos / Saldos'],['fact','Por facturar'],['emi','Emitidas'],['sync','Sincronizacion TNS'],['cfg','Configuracion']];
    const bar=el.querySelector('#fbar');
    bar.innerHTML=tabs.map(t=>'<button class="tab'+(t[0]===tab?' active':'')+'" data-k="'+t[0]+'">'+t[1]+'</button>').join('');
    bar.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{ tab=b.dataset.k; shell(); });
    if(tab==='ant') antView(); else if(tab==='fact') factView(); else if(tab==='emi') emiView(); else if(tab==='sync') syncView(); else cfgView();
  }
  function body(){ return el.querySelector('#fbody'); }

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
    let rs=[]; try{ const r=await ctx.rpc('rcd_liquidaciones_lista',{p_gestor_id:ctx.ses.gestor_id}); rs=Array.isArray(r)?r:[]; }catch(e){}
    const pend=rs.filter(l=>l.estado!=='facturada');
    bd.innerHTML='<div class="mcard"><h3 style="margin:0 0 4px">Liquidaciones listas para facturar</h3>'+
      '<p class="lead">Vienen del modulo Liquidacion. Al facturar (Fase 2) se envian a TNS.</p>'+
      (pend.length?'<table class="mtable"><tr><th>N.º Liq.</th><th>Cliente / Obra</th><th>Periodo</th><th style="text-align:right">Total</th><th></th></tr>'+
        pend.map(l=>'<tr><td class="mono"><b>'+esc(l.numero||'')+'</b></td>'+
          '<td>'+esc(l.cliente||'')+'<br><span style="font-size:12px;color:var(--muted)">'+esc(l.obra||'')+'</span></td>'+
          '<td class="mono">'+esc(l.desde||'')+' a '+esc(l.hasta||'')+'</td>'+
          '<td style="text-align:right" class="mono">'+money(l.total)+'</td>'+
          '<td><button class="btn primary sm" data-fac="'+l.id+'">Facturar</button></td></tr>').join('')+'</table>'
        :'<div class="empty">No hay liquidaciones pendientes de facturar.</div>')+'</div>';
    bd.querySelectorAll('[data-fac]').forEach(b=>b.onclick=()=>ctx.toast('La emision en TNS se activa en la Fase 2 (conector).','info'));
  }

  // ===================== EMITIDAS =====================
  function emiView(){
    body().innerHTML='<div class="mcard"><h3 style="margin:0 0 4px">Facturas emitidas en TNS</h3>'+
      '<div class="note">Aqui apareceran las facturas con su numero, total y estado DIAN (CUFE) cuando se conecte TNS en la Fase 2.</div>'+
      '<div class="empty">Sin facturas emitidas todavia.</div></div>';
  }

  // ===================== SINCRONIZACION TNS =====================
  async function syncView(){
    const bd=body(); bd.innerHTML='<div class="loading">Cargando...</div>';
    let cs=[]; try{ const r=await ctx.rpc('rcd_tns_conceptos_lista',{p_gestor_id:ctx.ses.gestor_id}); cs=Array.isArray(r)?r:[]; }catch(e){}
    bd.innerHTML=
      '<div class="note">Para que NO se dupliquen en TNS: empareja cada concepto con su material de TNS (su nombre exacto en TNS). En la Fase 2 se podran traer y crear automaticamente.</div>'+
      '<div class="mcard"><h3 style="margin:0 0 6px">Conceptos / productos → material en TNS</h3>'+
      '<table class="mtable"><tr><th>Concepto en RCD Pro</th><th>Nombre en TNS</th><th>Codigo TNS</th>'+(pCrear?'<th></th>':'')+'</tr>'+
      cs.map((c,i)=>'<tr><td>'+esc(c.etiqueta)+'</td>'+
        '<td><input class="cnom" data-i="'+i+'" value="'+esc(c.tns_nombre||'')+'" placeholder="nombre en TNS" style="width:100%;border:1px solid var(--line);border-radius:7px;padding:6px 8px;font-size:12.5px"></td>'+
        '<td><input class="ccod" data-i="'+i+'" value="'+esc(c.tns_codmat||'')+'" placeholder="cod." style="width:90px;border:1px solid var(--line);border-radius:7px;padding:6px 8px;font-size:12.5px" class="mono"></td>'+
        (pCrear?'<td><button class="btn ghost sm" data-save="'+i+'">Guardar</button></td>':'')+'</tr>').join('')+
      '</table></div>'+
      '<div class="mcard"><h3 style="margin:0 0 4px">Clientes → tercero en TNS (por NIT)</h3>'+
      '<div class="note">En la Fase 2: antes de facturar, RCD Pro busca el NIT en TNS; si existe lo usa, si no lo crea una vez (sin duplicar).</div></div>';
    cs.forEach((c,i)=>{ const b=bd.querySelector('[data-save="'+i+'"]'); if(b) b.onclick=async()=>{
      const nom=bd.querySelector('.cnom[data-i="'+i+'"]').value;
      const cod=bd.querySelector('.ccod[data-i="'+i+'"]').value;
      try{ const r=scalar(await ctx.rpc('rcd_tns_concepto_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_tipo:c.tipo,p_producto_id:c.producto_id,p_codmat:cod,p_nombre:nom}));
        if(r==='OK') ctx.toast('Guardado'); else ctx.toast('No se pudo.','error');
      }catch(e){ ctx.toast('Error.','error'); }
    }; });
  }

  // ===================== CONFIGURACION =====================
  async function cfgView(){
    const bd=body(); bd.innerHTML='<div class="loading">Cargando...</div>';
    let c={codsucursal:'01',prefijo:'FV',forma_pago:'CR',enviar_dian:true};
    try{ const r=row1(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id})); if(r) c=r; }catch(e){}
    bd.innerHTML='<div class="mcard"><h3 style="margin:0 0 4px">Conexion con TNS</h3>'+
      '<div class="note">Las claves de TNS se guardan seguras en el servidor (no en la app). Aqui defines como se arman las facturas.</div>'+
      '<div class="row2"><div class="field"><label>Sucursal (codsucursal)</label><input id="cf_suc" value="'+esc(c.codsucursal||'01')+'"></div>'+
      '<div class="field"><label>Prefijo de factura</label><input id="cf_pre" value="'+esc(c.prefijo||'FV')+'"></div></div>'+
      '<div class="row2"><div class="field"><label>Forma de pago por defecto</label><select id="cf_fp">'+
        '<option value="CR"'+(c.forma_pago==='CR'?' selected':'')+'>Credito (CR)</option>'+
        '<option value="CO"'+(c.forma_pago==='CO'?' selected':'')+'>Contado (CO)</option></select></div>'+
      '<div class="field"><label>Enviar a DIAN al facturar</label><select id="cf_dian">'+
        '<option value="si"'+(c.enviar_dian!==false?' selected':'')+'>Si, automatico</option>'+
        '<option value="no"'+(c.enviar_dian===false?' selected':'')+'>No, solo crear</option></select></div></div>'+
      (pCrear?'<button class="btn primary" id="cf_save">Guardar configuracion</button>':'')+
      '</div>';
    const sv=bd.querySelector('#cf_save'); if(sv) sv.onclick=async()=>{
      try{ const r=scalar(await ctx.rpc('rcd_tns_config_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_codsucursal:v(el,'cf_suc'),p_prefijo:v(el,'cf_pre'),p_forma_pago:v(el,'cf_fp'),p_enviar_dian:(v(el,'cf_dian')==='si')}));
        if(r==='OK') ctx.toast('Configuracion guardada'); else if(r==='SIN_PERMISO') ctx.toast('No tienes permiso.','error'); else ctx.toast('No se pudo.','error');
      }catch(e){ ctx.toast('Error.','error'); }
    };
  }

  shell();
};
