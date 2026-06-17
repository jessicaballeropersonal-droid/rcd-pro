// ============================================================
// RCD PRO · Modulo Lista de Precios (clave 'precios')
// Items con precio global + tarifas de transporte (matriz por destino/tamano).
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.precios = function(el, ctx){
  const pCrear=ctx.can('parametros','escribir'), pEliminar=ctx.can('parametros','eliminar');
  let MUNIS=[], VOLQS=[], ALIADOS=[], PRODUCTOS=[];

  function money(n){ return numEs(n)+''; }
  function tabbar(activa){
    return '<div class="tabbar">'+
      '<button class="tab'+(activa==='it'?' active':'')+'" data-t="it">Items (precio global)</button>'+
      '<button class="tab'+(activa==='mu'?' active':'')+'" data-t="mu">Municipios (transporte)</button>'+
      '</div>';
  }
  function wireTabs(){ el.querySelectorAll('.tab[data-t]').forEach(function(b){ b.onclick=function(){ b.dataset.t==='it'?itemsView():muniList(); }; }); }

  async function cargarCat(){
    if(!MUNIS.length){ try{ const r=await ctx.rpc('rcd_municipios_lista',{p_gestor_id:ctx.ses.gestor_id}); MUNIS=Array.isArray(r)?r:[]; }catch(e){} }
    if(!VOLQS.length){ try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); VOLQS=(Array.isArray(r)?r:[]).filter(x=>x.activa!==false); }catch(e){} }
    if(!ALIADOS.length){ try{ const r=await ctx.rpc('rcd_aliados_lista',{p_gestor_id:ctx.ses.gestor_id}); ALIADOS=(Array.isArray(r)?r:[]).filter(a=>a.activo!==false); }catch(e){} }
  }
  function destinos(){
    const d=[{tipo:'nuestro',aliado:null,label:'Nuestro RCD'}];
    ALIADOS.filter(a=>a.es_receptor).forEach(a=>d.push({tipo:'otro_rcd',aliado:a.id,label:'Otro RCD: '+a.razon_social}));
    ALIADOS.filter(a=>a.es_maquila).forEach(a=>d.push({tipo:'maquila',aliado:a.id,label:'Maquila: '+a.razon_social}));
    return d;
  }

  // ===================== ITEMS =====================
  async function itemsView(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    if(!PRODUCTOS.length){ try{ const r=await ctx.rpc('rcd_productos_lista',{p_gestor_id:ctx.ses.gestor_id}); PRODUCTOS=(Array.isArray(r)?r:[]).filter(p=>p.activo); }catch(e){} }
    let items=[]; try{ const r=await ctx.rpc('rcd_items_lista',{p_gestor_id:ctx.ses.gestor_id}); items=Array.isArray(r)?r:[]; }catch(e){}
    el.innerHTML=
      '<div class="mcard" style="max-width:820px">'+
      tabbar('it')+
      '<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Items · precio por tonelada</h3>'+
        (pCrear?'<button class="btn primary sm" id="bNew">+ Nuevo item</button>':'')+'</div>'+
      '<p class="lead" style="margin:6px 0 12px">El precio es el mismo en todos los municipios. Marca si lleva transporte.</p>'+
      (items.length?
        '<table class="mtable"><tr><th>Item</th><th>Clase</th><th>Transporte</th><th style="text-align:right">Precio (t)</th><th></th></tr>'+
        items.map((it,i)=>'<tr><td><b>'+esc(it.nombre)+'</b>'+(it.producto_nombre?'<br><span style="font-size:11px;color:var(--muted)">'+esc(it.producto_nombre)+'</span>':'')+'</td>'+
          '<td><span class="badge off">'+(it.clase==='producto'?'Producto':'Servicio')+'</span></td>'+
          '<td>'+(it.lleva_transporte?'<span class="badge ok">Si</span>':'<span class="badge off">No</span>')+'</td>'+
          '<td class="mono" style="text-align:right">'+money(it.precio_t)+'</td>'+
          '<td><div class="rowbtns">'+(pCrear?'<button class="btn ghost sm" data-ed="'+i+'">Editar</button>':'')+(pEliminar?'<button class="btn ghost sm" data-an="'+i+'">Eliminar</button>':'')+'</div></td></tr>').join('')+'</table>'
        : '<div class="empty">Aun no hay items.</div>')+
      '</div>';
    wireTabs();
    const b=el.querySelector('#bNew'); if(b) b.onclick=()=>itemForm(null);
    items.forEach((it,i)=>{ const e=el.querySelector('[data-ed="'+i+'"]'); if(e) e.onclick=()=>itemForm(it);
      const a=el.querySelector('[data-an="'+i+'"]'); if(a) a.onclick=()=>itemAnular(it); });
  }
  function itemForm(it){
    const nuevo=!it;
    el.innerHTML=
      '<div class="mcard" style="max-width:560px">'+
      '<button class="btn ghost sm" id="bBack">&larr; Items</button>'+
      '<h3 style="margin:12px 0 8px">'+(nuevo?'Nuevo item':'Editar item')+'</h3>'+
      '<div class="field"><label>Nombre</label><input id="i_nom" value="'+(nuevo?'':esc(it.nombre))+'"></div>'+
      '<div class="row2"><div class="field"><label>Clase</label><select id="i_clase"><option value="servicio">Servicio</option><option value="producto">Producto</option></select></div>'+
        '<div class="field"><label>Precio (t)</label><input id="i_precio" class="cellnum" value="'+(nuevo?'':numEs(it.precio_t))+'"></div></div>'+
      '<div class="field" id="i_prodwrap" style="display:none"><label>Producto</label><select id="i_prod"><option value="">Selecciona...</option>'+
        PRODUCTOS.map(p=>'<option value="'+p.id+'">'+esc(p.nombre)+'</option>').join('')+'</select></div>'+
      '<div class="chk"><input type="checkbox" id="i_transp" style="width:auto"> <label for="i_transp" style="margin:0;text-transform:none;letter-spacing:0;font-family:inherit;font-size:13px;color:var(--ink)">Lleva transporte (define tarifas de transporte por municipio)</label></div>'+
      '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>'+
      '</div>';
    const selClase=el.querySelector('#i_clase'), prodWrap=el.querySelector('#i_prodwrap');
    function tog(){ prodWrap.style.display=selClase.value==='producto'?'':'none'; }
    selClase.onchange=tog;
    if(!nuevo){ selClase.value=it.clase; if(it.producto_id){ el.querySelector('#i_prod').value=it.producto_id; } el.querySelector('#i_transp').checked=!!it.lleva_transporte; }
    tog();
    el.querySelector('#bBack').onclick=itemsView; el.querySelector('#bCancel').onclick=itemsView;
    el.querySelector('#bSave').onclick=async function(){
      const btn=this, nom=v(el,'i_nom').trim();
      if(!nom){ ctx.toast('Escribe el nombre.','error'); return; }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_item_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:nuevo?null:it.id,
          p_nombre:nom, p_clase:selClase.value, p_producto_id:selClase.value==='producto'?(v(el,'i_prod')||null):null,
          p_lleva_transporte:el.querySelector('#i_transp').checked, p_precio_t:parseNum(v(el,'i_precio'))}));
        if(r==='OK'){ ctx.toast('Item guardado'); itemsView(); return; }
        ctx.toast(r==='SIN_NOMBRE'?'Escribe el nombre.':(r==='CLASE_INVALIDA'?'Clase invalida.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.')),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar';
    };
  }
  async function itemAnular(it){
    if(!(await ctx.confirm('Eliminar el item "'+(it.nombre||'')+'"?'))) return;
    try{ const r=scalar(await ctx.rpc('rcd_item_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:it.id}));
      if(r==='OK'){ ctx.toast('Item eliminado'); itemsView(); return; } ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo.','error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  // ===================== MUNICIPIOS =====================
  async function muniList(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    await cargarCat();
    el.innerHTML=
      '<div class="mcard" style="max-width:820px">'+
      tabbar('mu')+
      '<h3 style="margin:0 0 4px">Municipios · transporte</h3>'+
      '<p class="lead">Entra a un municipio para configurar sus tarifas de transporte. (Los municipios y comunas se crean en Parametros.)</p>'+
      (MUNIS.length?
        MUNIS.map((m,i)=>'<div class="mcard" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;margin:0 0 8px;cursor:pointer" data-mu="'+i+'">'+
          '<div><b>'+esc(m.nombre)+'</b></div><button class="btn ghost sm">Configurar &rarr;</button></div>').join('')
        : '<div class="empty">No hay municipios. Crealos en Parametros.</div>')+
      '</div>';
    wireTabs();
    MUNIS.forEach((m,i)=>{ const c=el.querySelector('[data-mu="'+i+'"]'); if(c) c.onclick=()=>muniDetalle(m); });
  }

  async function muniDetalle(muni){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let comunas=[]; try{ const r=await ctx.rpc('rcd_comunas_lista',{p_municipio_id:muni.id}); comunas=(Array.isArray(r)?r:[]).filter(c=>c.activa!==false); }catch(e){}
    if(!comunas.length) comunas=[{id:null,nombre:'(sin comuna/zona)'}];
    let direccion='recoleccion', valor='cliente';

    async function pintar(){
      let tarifas=[]; try{ const r=await ctx.rpc('rcd_tarifas_lista',{p_gestor_id:ctx.ses.gestor_id,p_municipio_id:muni.id,p_direccion:direccion}); tarifas=Array.isArray(r)?r:[]; }catch(e){}
      const tmap={};
      tarifas.forEach(t=>{ tmap[(t.comuna_id||'')+'|'+t.destino_tipo+'|'+(t.destino_aliado_id||'')+'|'+t.tamano_id]=t; });
      const dests=destinos(), tams=VOLQS;
      const ncol=tams.length;
      let h='<div class="mcard" style="max-width:1040px">'+
        '<button class="btn ghost sm" id="bBackM">&larr; Municipios</button>'+
        '<h3 style="margin:12px 0 8px">'+esc(muni.nombre)+' · Transporte</h3>'+
        '<div class="tabbar" style="margin-bottom:10px">'+
          '<button class="tab'+(direccion==='recoleccion'?' active':'')+'" data-dir="recoleccion">Recoleccion (obra &rarr; RCD/maquila)</button>'+
          '<button class="tab'+(direccion==='entrega'?' active':'')+'" data-dir="entrega">Entrega (RCD/maquila &rarr; obra)</button>'+
        '</div>'+
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">'+
          '<span style="font-size:12px;color:var(--muted)">Mostrar:</span>'+
          '<div class="tabbar" style="margin:0">'+
            '<button class="tab'+(valor==='cliente'?' active':'')+'" data-val="cliente">Cobro al cliente</button>'+
            '<button class="tab'+(valor==='volquetero'?' active':'')+'" data-val="volquetero">Pago al volquetero</button>'+
          '</div>'+
          (pCrear?'<button class="btn primary sm" id="bAddT" style="margin-left:auto">+ Agregar tarifa</button>':'')+
        '</div>';
      if(!tams.length){ h+='<div class="note warn">No hay tamanos de volqueta. Crealos en Parametros.</div></div>'; el.innerHTML=h; wireDet(); return; }
      h+='<div style="overflow-x:auto"><table class="mtable" style="font-size:12px;min-width:600px"><tr><th rowspan="2" style="vertical-align:bottom">Comuna / Zona</th>'+
        dests.map(d=>'<th colspan="'+ncol+'" style="text-align:center;border-left:2px solid var(--line)">'+esc(d.label)+'</th>').join('')+'</tr><tr>'+
        dests.map(d=>tams.map((t,j)=>'<th style="text-align:right'+(j===0?';border-left:2px solid var(--line)':'')+'">'+esc(t.nombre)+'</th>').join('')).join('')+'</tr>'+
        comunas.map(c=>'<tr><td><b>'+esc(c.nombre)+'</b></td>'+
          dests.map(d=>tams.map((t,j)=>{
            const key=(c.id||'')+'|'+d.tipo+'|'+(d.aliado||'')+'|'+t.id; const tr=tmap[key];
            const val = tr ? (valor==='cliente'?tr.precio_cliente:tr.pago_volquetero) : null;
            return '<td class="mono" style="text-align:right;cursor:pointer'+(j===0?';border-left:2px solid var(--line)':'')+'" '+
              'data-cell="'+esc(c.id||'')+'~'+d.tipo+'~'+esc(d.aliado||'')+'~'+t.id+'">'+(val!=null?money(val):'<span style="color:#C9C9C1">+</span>')+'</td>';
          }).join('')).join('')+'</tr>').join('')+
        '</table></div>'+
        '<div class="note">Toca una celda para poner o editar su tarifa (cobro al cliente y pago al volquetero juntos).</div>'+
        '</div>';
      el.innerHTML=h; wireDet();

      function wireDet(){
        const bk=el.querySelector('#bBackM'); if(bk) bk.onclick=muniList;
        el.querySelectorAll('[data-dir]').forEach(b=>b.onclick=function(){ direccion=b.dataset.dir; pintar(); });
        el.querySelectorAll('[data-val]').forEach(b=>b.onclick=function(){ valor=b.dataset.val; pintar(); });
        const add=el.querySelector('#bAddT'); if(add) add.onclick=()=>tarifaForm(muni,comunas,null,null);
        el.querySelectorAll('[data-cell]').forEach(td=>{ if(!pCrear) return; td.onclick=function(){
          const p=td.dataset.cell.split('~'); const key=(p[0]||'')+'|'+p[1]+'|'+(p[2]||'')+'|'+p[3];
          tarifaForm(muni, comunas, {comuna_id:p[0]||null,destino_tipo:p[1],destino_aliado_id:p[2]||null,tamano_id:p[3]}, tmap[key]||null);
        }; });
      }
    }
    pintar();

    async function tarifaForm(muni, comunas, preset, existing){
      const dests=destinos(), tams=VOLQS;
      const pre = preset || {};
      const ex = existing || {};
      el.innerHTML=
        '<div class="mcard" style="max-width:560px">'+
        '<button class="btn ghost sm" id="bBackT">&larr; '+esc(muni.nombre)+'</button>'+
        '<h3 style="margin:12px 0 8px">Tarifa de transporte</h3>'+
        '<p class="lead">'+esc(muni.nombre)+' · '+(direccion==='recoleccion'?'Recoleccion':'Entrega')+'</p>'+
        '<div class="row2"><div class="field"><label>Comuna / Zona</label><select id="t_com">'+
          (comunas[0]&&comunas[0].id===null?'<option value="">(sin comuna/zona)</option>':'')+
          comunas.filter(c=>c.id).map(c=>'<option value="'+c.id+'">'+esc(c.nombre)+'</option>').join('')+'</select></div>'+
          '<div class="field"><label>Tamano</label><select id="t_tam">'+tams.map(t=>'<option value="'+t.id+'">'+esc(t.nombre)+'</option>').join('')+'</select></div></div>'+
        '<div class="field"><label>Destino</label><select id="t_dest">'+
          dests.map((d,i)=>'<option value="'+i+'">'+esc(d.label)+'</option>').join('')+'</select></div>'+
        '<div class="row2"><div class="field"><label>Cobro al cliente (viaje)</label><input id="t_cli" class="cellnum" value="'+(ex.precio_cliente!=null?numEs(ex.precio_cliente):'')+'"></div>'+
          '<div class="field"><label>Pago al volquetero (viaje)</label><input id="t_vol" class="cellnum" value="'+(ex.pago_volquetero!=null?numEs(ex.pago_volquetero):'')+'"></div></div>'+
        '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancelT">Cancelar</button>'+
          (existing&&existing.id&&pEliminar?'<button class="btn ghost" id="bDelT">Eliminar</button>':'')+
          '<button class="btn primary" id="bSaveT">Guardar</button></div>'+
        '</div>';
      const selCom=el.querySelector('#t_com'), selTam=el.querySelector('#t_tam'), selDest=el.querySelector('#t_dest');
      if(pre.comuna_id!=null) selCom.value=pre.comuna_id; 
      if(pre.tamano_id) selTam.value=pre.tamano_id;
      if(pre.destino_tipo){ const di=dests.findIndex(d=>d.tipo===pre.destino_tipo && (d.aliado||'')===(pre.destino_aliado_id||'')); if(di>=0) selDest.value=di; }
      el.querySelector('#bBackT').onclick=pintar; el.querySelector('#bCancelT').onclick=pintar;
      const del=el.querySelector('#bDelT'); if(del) del.onclick=async function(){
        if(!(await ctx.confirm('Eliminar esta tarifa?'))) return;
        try{ const r=scalar(await ctx.rpc('rcd_tarifa_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:existing.id}));
          if(r==='OK'){ ctx.toast('Tarifa eliminada'); pintar(); return; } ctx.toast('No se pudo.','error'); }catch(e){ ctx.toast('Error de conexion.','error'); }
      };
      el.querySelector('#bSaveT').onclick=async function(){
        const btn=this, d=dests[+selDest.value]||dests[0];
        btn.disabled=true; btn.textContent='Guardando...';
        try{ const r=scalar(await ctx.rpc('rcd_tarifa_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,
            p_id:(existing&&existing.id)||null, p_municipio_id:muni.id, p_comuna_id:selCom.value||null, p_tamano_id:selTam.value,
            p_direccion:direccion, p_destino_tipo:d.tipo, p_destino_aliado_id:d.aliado,
            p_precio_cliente:parseNum(v(el,'t_cli')), p_pago_volquetero:parseNum(v(el,'t_vol'))}));
          if(r==='OK'){ ctx.toast('Tarifa guardada'); pintar(); return; }
          ctx.toast(r==='FALTA_ALIADO'?'Falta el aliado del destino.':(r==='FALTAN_DATOS'?'Faltan datos.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.')),'error');
        }catch(e){ ctx.toast('Error de conexion.','error'); }
        btn.disabled=false; btn.textContent='Guardar';
      };
    }
  }

  itemsView();
};
