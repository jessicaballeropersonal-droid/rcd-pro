// ============================================================
// RCD PRO · Modulo Inventario
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.inventario = function(el, ctx){
  const pCrear=ctx.can('inventario','escribir'), pEliminar=ctx.can('inventario','eliminar');
  let ubic = '';            // '' = todas (consolidado)
  let UBICS = [];           // catalogo de ubicaciones
  const kf = { desde:'', hasta:'', clase:'', ubic:'', origen:'' };

  function msg(r){
    return ({SIN_PERMISO:'No tienes permiso.', CLASE_INVALIDA:'Clase invalida.', SIN_ITEM:'Selecciona el item.',
      CANTIDAD_INVALIDA:'La cantidad debe ser mayor a cero.', SIGNO_INVALIDO:'Movimiento invalido.'})[r] || 'No se pudo completar la accion.';
  }
  function origenBadge(o){
    if(o==='recepcion') return '<span class="badge ok">Recepcion</span>';
    if(o==='produccion') return '<span class="badge ok">Produccion</span>';
    if(o==='despacho') return '<span class="badge danger">Despacho</span>';
    if(o==='ajuste') return '<span class="badge warn">Ajuste</span>';
    return '<span class="badge off">'+esc(o||'')+'</span>';
  }

  async function cargarUbics(){
    try{ const r=await ctx.rpc('rcd_ubicaciones_lista',{p_gestor_id:ctx.ses.gestor_id}); UBICS=Array.isArray(r)?r:[]; }catch(e){ UBICS=[]; }
  }
  function optsUbic(sel, incluirTodas){
    let h = incluirTodas ? '<option value="">Todas (consolidado)</option>' : '';
    UBICS.forEach(u=>{ h+='<option value="'+esc(u.id)+'"'+(sel===u.id?' selected':'')+'>'+esc(u.nombre)+'</option>'; });
    return h;
  }

  // ===================== EXISTENCIAS =====================
  async function existencias(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    if(!UBICS.length) await cargarUbics();
    let mat=[], pro=[], dis=[];
    try{ const r=await ctx.rpc('rcd_inv_materia',{p_gestor_id:ctx.ses.gestor_id,p_ubicacion:ubic||null}); mat=Array.isArray(r)?r:[]; }catch(e){}
    try{ const r=await ctx.rpc('rcd_inv_producto',{p_gestor_id:ctx.ses.gestor_id,p_ubicacion:ubic||null}); pro=Array.isArray(r)?r:[]; }catch(e){}
    try{ const r=await ctx.rpc('rcd_inv_disposicion',{p_gestor_id:ctx.ses.gestor_id,p_ubicacion:ubic||null}); dis=Array.isArray(r)?r:[]; }catch(e){}

    function bloque(titulo, tag, filas, colItem){
      const total = filas.reduce((s,f)=>s+Number(f.stock_t||0),0);
      return '<div style="margin-bottom:18px">'+
        '<h4 style="margin:0 0 8px;font-size:13px;color:var(--esc-d)">'+titulo+' <span class="badge off">'+tag+'</span></h4>'+
        (filas.length?
          '<table class="mtable"><tr><th>'+colItem+'</th><th style="text-align:right">Stock (t)</th></tr>'+
          filas.map(f=>'<tr><td>'+esc(f.codigo?(f.codigo+' · '):'')+esc(f.nombre||'')+'</td><td class="mono" style="text-align:right">'+numEs(f.stock_t)+'</td></tr>').join('')+
          '<tr><td style="font-weight:700;border-top:2px solid var(--line)">Total</td><td class="mono" style="text-align:right;font-weight:700;border-top:2px solid var(--line)">'+numEs(total)+'</td></tr>'+
          '</table>'
          : '<div class="empty">Sin existencias.</div>')+
      '</div>';
    }

    el.innerHTML=
      '<div class="mcard" style="max-width:860px">'+
      tabbar('ex')+
      '<div class="field" style="max-width:340px"><label>Ubicacion</label><select id="selUbic">'+optsUbic(ubic,true)+'</select></div>'+
      bloque('Materia prima','RCD aprovechable', mat, 'Tipo de RCD')+
      bloque('Producto terminado','para despacho', pro, 'Producto')+
      bloque('Disposicion final','no aprovechable · solo acumula', dis, 'Tipo de RCD')+
      '</div>';
    wireTabs();
    el.querySelector('#selUbic').onchange=function(){ ubic=this.value; existencias(); };
  }

  // ===================== AJUSTES =====================
  async function ajustes(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    if(!UBICS.length) await cargarUbics();
    let tipos=[], productos=[], recientes=[];
    try{ const r=await ctx.rpc('rcd_tipos_residuo_lista',{}); tipos=Array.isArray(r)?r:[]; }catch(e){}
    try{ const r=await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); productos=(Array.isArray(r)?r:[]).filter(p=>p.activo); }catch(e){}
    try{ const r=await ctx.rpc('rcd_inv_ajustes_lista',{p_gestor_id:ctx.ses.gestor_id}); recientes=Array.isArray(r)?r:[]; }catch(e){}

    const aprov = tipos.filter(t=>t.aprovechable), noaprov = tipos.filter(t=>!t.aprovechable);
    el.innerHTML=
      '<div class="mcard" style="max-width:760px">'+
      tabbar('aj')+
      (pCrear?
      '<h3 style="margin:4px 0 2px">Ajuste manual</h3>'+
      '<p class="lead">Para merma, conteo fisico o correcciones. Queda registrado.</p>'+
      '<div class="field"><label>Clase</label><select id="a_clase">'+
        '<option value="materia">Materia prima</option><option value="producto">Producto terminado</option><option value="disposicion">Disposicion final</option></select></div>'+
      '<div class="row2"><div class="field"><label>Item</label><select id="a_item"></select></div>'+
        '<div class="field"><label>Ubicacion</label><select id="a_ubic">'+optsUbic('planta',false)+'</select></div></div>'+
      '<div class="row2"><div class="field"><label>Movimiento</label><select id="a_signo"><option value="entrada">Entrada (+)</option><option value="salida">Salida (-)</option></select></div>'+
        '<div class="field"><label>Cantidad (t)</label><input id="a_cant" class="cellnum"></div></div>'+
      '<div class="field"><label>Motivo</label><select id="a_motivo"><option>Conteo fisico</option><option>Merma</option><option>Correccion</option><option>Otro</option></select></div>'+
      '<div class="field"><label>Observaciones</label><input id="a_obs"></div>'+
      '<button class="btn primary" id="bAj">Guardar ajuste</button>'
      : '<div class="note">No tienes permiso para crear ajustes.</div>')+
      '<h3 style="margin:20px 0 2px;font-size:14px">Ajustes recientes</h3>'+
      (recientes.length?
        '<table class="mtable"><tr><th>Fecha</th><th>Clase</th><th>Item</th><th>Ubicacion</th><th style="text-align:right">Cant.</th><th>Motivo</th><th></th></tr>'+
        recientes.map(function(a,i){ return '<tr><td class="mono">'+esc(a.fecha||'')+'</td><td>'+claseTxt(a.clase)+'</td><td>'+esc(a.item||'')+'</td>'+
          '<td>'+esc(a.ubicacion||'')+'</td><td class="mono" style="text-align:right">'+(Number(a.cantidad_t)>0?'+':'')+numEs(a.cantidad_t)+'</td><td>'+esc(a.motivo||'')+'</td>'+
          '<td><div class="rowbtns">'+(pEliminar?'<button class="btn ghost sm" data-anaj="'+i+'">Anular</button>':'')+'</div></td></tr>'; }).join('')+'</table>'
        : '<div class="empty">Sin ajustes.</div>')+
      '</div>';
    wireTabs();

    if(pCrear){
      const selClase=el.querySelector('#a_clase'), selItem=el.querySelector('#a_item');
      function pintarItems(){
        const c=selClase.value; let h='<option value="">Selecciona...</option>';
        if(c==='producto') productos.forEach(p=>h+='<option value="p:'+p.id+'">'+esc(p.nombre)+'</option>');
        else if(c==='materia') aprov.forEach(t=>h+='<option value="t:'+t.id+'">'+esc(t.codigo)+' · '+esc(t.nombre)+'</option>');
        else noaprov.forEach(t=>h+='<option value="t:'+t.id+'">'+esc(t.codigo)+' · '+esc(t.nombre)+'</option>');
        selItem.innerHTML=h;
      }
      selClase.onchange=pintarItems; pintarItems();
      el.querySelector('#bAj').onclick=async function(){
        const btn=this, clase=selClase.value, itm=selItem.value;
        if(!itm){ ctx.toast('Selecciona el item.','error'); return; }
        const cant=parseNum(v(el,'a_cant')); if(!(cant>0)){ ctx.toast('Escribe la cantidad.','error'); return; }
        const esProd = itm.indexOf('p:')===0; const id=itm.slice(2);
        btn.disabled=true; btn.textContent='Guardando...';
        try{ const r=scalar(await ctx.rpc('rcd_inv_ajuste_crear',{
            p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_clase:clase,
            p_tipo_residuo_id: esProd?null:id, p_producto_id: esProd?id:null,
            p_ubicacion: v(el,'a_ubic'), p_signo: v(el,'a_signo'), p_cantidad:cant,
            p_motivo: v(el,'a_motivo'), p_observaciones: v(el,'a_obs') }));
          if(r==='OK'){ ctx.toast('Ajuste guardado'); ajustes(); return; }
          ctx.toast(msg(r),'error');
        }catch(e){ ctx.toast('Error de conexion.','error'); }
        btn.disabled=false; btn.textContent='Guardar ajuste';
      };
      recientes.forEach(function(a,i){ const b=el.querySelector('[data-anaj="'+i+'"]'); if(b) b.onclick=()=>anularAjuste(a); });
    } else {
      recientes.forEach(function(a,i){ const b=el.querySelector('[data-anaj="'+i+'"]'); if(b) b.onclick=()=>anularAjuste(a); });
    }
  }

  async function anularAjuste(a){
    if(!(await ctx.confirm('Anular este ajuste?'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_inv_ajuste_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:a.id}));
      if(r==='OK'){ ctx.toast('Ajuste anulado'); ajustes(); return; }
      ctx.toast(msg(r),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===================== KARDEX =====================
  async function kardex(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    if(!UBICS.length) await cargarUbics();
    let rows=[];
    try{ const r=await ctx.rpc('rcd_inv_kardex',{p_gestor_id:ctx.ses.gestor_id,p_desde:kf.desde||null,p_hasta:kf.hasta||null,
        p_clase:kf.clase||null,p_ubicacion:kf.ubic||null,p_origen:kf.origen||null}); rows=Array.isArray(r)?r:[]; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:920px">'+
      tabbar('mov')+
      '<h3 style="margin:4px 0 2px">Movimientos (Kardex)</h3>'+
      '<p class="lead">Todo lo que entra y sale. Solo lectura.</p>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">'+
        '<div class="field" style="margin:0"><label>Desde</label><input type="date" id="k_desde" value="'+esc(kf.desde)+'"></div>'+
        '<div class="field" style="margin:0"><label>Hasta</label><input type="date" id="k_hasta" value="'+esc(kf.hasta)+'"></div>'+
        '<div class="field" style="margin:0"><label>Clase</label><select id="k_clase"><option value="">Todas</option>'+
          '<option value="materia"'+(kf.clase==='materia'?' selected':'')+'>Materia</option>'+
          '<option value="producto"'+(kf.clase==='producto'?' selected':'')+'>Producto</option>'+
          '<option value="disposicion"'+(kf.clase==='disposicion'?' selected':'')+'>Disposicion</option></select></div>'+
        '<div class="field" style="margin:0"><label>Ubicacion</label><select id="k_ubic">'+optsUbic(kf.ubic,true)+'</select></div>'+
        '<div class="field" style="margin:0"><label>Origen</label><select id="k_origen"><option value="">Todos</option>'+
          '<option value="recepcion"'+(kf.origen==='recepcion'?' selected':'')+'>Recepcion</option>'+
          '<option value="ajuste"'+(kf.origen==='ajuste'?' selected':'')+'>Ajuste</option></select></div>'+
        '<button class="btn ghost sm" id="kFiltrar">Filtrar</button>'+
        '<button class="btn ghost sm" id="kLimpiar">Limpiar</button>'+
      '</div>'+
      (rows.length?
        '<table class="mtable" style="margin-top:12px"><tr><th>Fecha</th><th>Origen</th><th>Clase / Item</th><th>Ubicacion</th><th style="text-align:right">Cant.</th><th>Ref.</th></tr>'+
        rows.map(r=>'<tr><td class="mono">'+esc(r.fecha||'')+'</td><td>'+origenBadge(r.origen)+'</td>'+
          '<td>'+claseTxt(r.clase)+' · '+esc(r.item||'')+'</td><td>'+esc(r.ubicacion||'')+'</td>'+
          '<td class="mono" style="text-align:right">'+(Number(r.cantidad_t)>0?'+':'')+numEs(r.cantidad_t)+'</td><td class="mono">'+esc(r.ref||'')+'</td></tr>').join('')+'</table>'
        : '<div class="empty" style="margin-top:12px">Sin movimientos con esos filtros.</div>')+
      '</div>';
    wireTabs();
    el.querySelector('#kFiltrar').onclick=function(){
      kf.desde=v(el,'k_desde'); kf.hasta=v(el,'k_hasta'); kf.clase=v(el,'k_clase'); kf.ubic=v(el,'k_ubic'); kf.origen=v(el,'k_origen'); kardex();
    };
    el.querySelector('#kLimpiar').onclick=function(){ kf.desde=kf.hasta=kf.clase=kf.ubic=kf.origen=''; kardex(); };
  }

  // ===================== UI comun =====================
  function claseTxt(c){ return c==='materia'?'Materia':(c==='producto'?'Producto':(c==='disposicion'?'Disposicion':esc(c||''))); }
  let vista='ex';
  function tabbar(activa){
    vista=activa;
    return '<div class="tabbar">'+
      '<button class="tab'+(activa==='ex'?' active':'')+'" data-t="ex">Existencias</button>'+
      '<button class="tab'+(activa==='aj'?' active':'')+'" data-t="aj">Ajustes</button>'+
      '<button class="tab'+(activa==='mov'?' active':'')+'" data-t="mov">Movimientos</button>'+
      '</div>';
  }
  function wireTabs(){
    el.querySelectorAll('.tab[data-t]').forEach(function(b){
      b.onclick=function(){ const t=b.dataset.t; if(t==='ex') existencias(); else if(t==='aj') ajustes(); else kardex(); };
    });
  }

  existencias();
};
