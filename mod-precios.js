// ============================================================
// RCD PRO · Modulo Lista de Precios (clave 'precios')
// Items con precio global + tarifas de transporte (matriz por destino/tamano).
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.precios = function(el, ctx){
  const pCrear=ctx.can('parametros','escribir'), pEliminar=ctx.can('parametros','eliminar');
  let MUNIS=[], VOLQS=[], ALIADOS=[], PRODUCTOS=[];

  function money(n){ return Math.round(+n||0).toLocaleString('es-CO'); }
  function tabbar(activa){
    return '<div class="tabbar">'+
      '<button class="tab'+(activa==='ar'?' active':'')+'" data-t="ar">Artículos</button>'+
      '<button class="tab'+(activa==='it'?' active':'')+'" data-t="it">Productos y servicios</button>'+
      '<button class="tab'+(activa==='mu'?' active':'')+'" data-t="mu">Municipios (transporte)</button>'+
      '</div>';
  }
  function wireTabs(){ el.querySelectorAll('.tab[data-t]').forEach(function(b){ b.onclick=function(){ var t=b.dataset.t; if(t==='ar') articulosView(); else if(t==='it') itemsView(); else muniList(); }; }); }

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

  // ===================== ARTICULOS (clasificacion TNS) =====================
  async function articulosView(){
    el.innerHTML='<div class="loading">Trayendo articulos de TNS...</div>';
    const cfg = scalar(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id})) || {};
    if(!cfg.tiene_credenciales){
      el.innerHTML='<div class="mcard" style="max-width:820px">'+tabbar('ar')+'<div class="note warn">Conecta TNS en Facturacion -> Configuracion para traer los articulos.</div></div>';
      wireTabs(); return;
    }
    let tns=null;
    try{
      tns = await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({accion:'traer_materiales',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,codigosucursal:cfg.codigo_sucursal||'00'})}).then(x=>x.json());
    }catch(e){ tns={ok:false,error:'NO_CONECTA'}; }
    if(!(tns&&tns.ok)){
      el.innerHTML='<div class="mcard" style="max-width:820px">'+tabbar('ar')+'<div class="note warn">No se pudo traer de TNS: '+esc((tns&&tns.error)||'sin conexion')+'.</div></div>';
      wireTabs(); return;
    }
    const arts = tns.materiales||[];
    const tnsCampos=(tns.campos||[]).join(', ');
    let saved=[];
    try{ const ss=await ctx.rpc('rcd_articulos_clasif_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(ss)) saved=ss; }catch(e){}
    const map={}; saved.forEach(function(x){ if(x.cod_articulo) map[x.cod_articulo]=x; });

    const DATA = arts.map(function(a){
      const c=map[a.codigo]||{};
      return { cod:a.codigo, desc:a.descripcion||'(sin descripcion)', precio:(a.precio!=null?a.precio:0), clase:c.clase||'', sub:c.servicio_subtipo||'' };
    }).filter(function(d){ return d.cod; });
    let fSearch='', fFiltro='todos';
    const syncTxt='TNS sincronizado \u00b7 '+new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
    const puedeEditar = ctx.can('parametros','editar');

    render();

    function render(){
      el.innerHTML=
        '<div class="mcard" style="max-width:820px">'+
        tabbar('ar')+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">'+
          '<div><h3 style="margin:0">Clasificacion de articulos</h3>'+
          '<p class="lead" style="margin:4px 0 0">Los articulos se crean en TNS. Marca que es cada uno (una sola clase). Los precios son de TNS.</p></div>'+
          '<span style="display:inline-flex;align-items:center;gap:7px;background:#E6F4EA;color:#15803D;font-size:12px;padding:6px 11px;border-radius:8px"><span style="width:8px;height:8px;border-radius:50%;background:#15803D"></span>'+esc(syncTxt)+'</span>'+
        '</div>'+
        '<div style="display:flex;gap:8px;align-items:center;margin:10px 0 8px;flex-wrap:wrap">'+
          '<input id="arSearch" placeholder="Buscar por descripcion o codigo..." style="flex:1;min-width:180px">'+
          '<select id="arFiltro" style="width:auto">'+
            '<option value="todos">Todos</option><option value="sin">Sin clasificar</option>'+
            '<option value="producto">Producto</option><option value="servicio">Servicio</option>'+
            '<option value="aprovechado">Aprovechado</option><option value="transporte">Transporte</option>'+
          '</select>'+
          '<span id="arCount" style="font-size:12px;color:#6E7A77;white-space:nowrap"></span>'+
        '</div>'+
        '<div id="arRows"></div>'+
        '<div class="note" style="margin-top:10px">Clase unica por articulo. Se guarda solo. Desmarcar oculta pero conserva el historial.</div>'+
        '</div>';
      wireTabs();
      el.querySelector('#arSearch').oninput=function(){ fSearch=this.value; renderRows(); };
      el.querySelector('#arFiltro').onchange=function(){ fFiltro=this.value; renderRows(); };
      renderRows();
    }

    function pasa(d){
      if(fFiltro==='sin' && d.clase) return false;
      if(['producto','servicio','aprovechado','transporte'].indexOf(fFiltro)>=0 && d.clase!==fFiltro) return false;
      if(fSearch){ var q=fSearch.toLowerCase(); if(((d.desc||'')+' '+(d.cod||'')).toLowerCase().indexOf(q)<0) return false; }
      return true;
    }
    function chip(label,k,cod,on){
      var st = on ? 'background:#15803D;border:1px solid #15803D;color:#fff' : 'background:#fff;border:1px solid var(--line,#E0E0DA);color:var(--muted,#6E7A77)';
      return '<button data-cls="'+k+'" data-cod="'+esc(cod)+'" style="font-size:12px;padding:5px 11px;border-radius:999px;cursor:'+(puedeEditar?'pointer':'default')+';'+st+'">'+label+'</button>';
    }
    function subchip(label,k,cod,on){
      var st = on ? 'background:#15803D;border:1px solid #15803D;color:#fff' : 'background:#fff;border:1px solid var(--line,#E0E0DA);color:var(--muted,#6E7A77)';
      return '<button data-sub="'+k+'" data-cod="'+esc(cod)+'" style="font-size:11.5px;padding:4px 10px;border-radius:999px;cursor:pointer;'+st+'">'+label+'</button>';
    }
    function fila(d){
      var clases=[['producto','Producto'],['servicio','Servicio'],['aprovechado','Aprovechado'],['transporte','Transporte']];
      var sub='';
      if(d.clase==='servicio'){
        sub='<div style="margin-top:9px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span style="font-size:11.5px;color:#6E7A77">Tipo:</span>'+
          subchip('Disposicion RCD','disposicion',d.cod,d.sub==='disposicion')+
          subchip('Generacion RCD','generacion',d.cod,d.sub==='generacion')+'</div>';
      }
      return '<div style="background:#fff;border:1px solid var(--line,#E0E0DA);border-radius:8px;padding:11px 13px;margin-bottom:8px">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">'+
            '<div style="min-width:0"><b>'+esc(d.desc)+'</b><br><span class="mono" style="font-size:12px;color:#6E7A77">'+esc(d.cod)+'</span>'+
            (d.precio>0?'<br><span style="font-size:11.5px;color:#0F766E">Precio cliente (TNS): $'+Number(d.precio).toLocaleString('es-CO')+'</span>':'<br><span style="font-size:11px;color:#9aa3a0">Sin precio en TNS</span>')+
          '</div>'+
            '<div style="display:flex;gap:6px;flex-wrap:wrap">'+clases.map(function(c){return chip(c[1],c[0],d.cod,d.clase===c[0]);}).join('')+'</div>'+
          '</div>'+ sub +
        '</div>';
    }
    function renderRows(){
      var cont=el.querySelector('#arRows');
      var done=DATA.filter(function(d){return d.clase;}).length;
      var cEl=el.querySelector('#arCount'); if(cEl) cEl.textContent=DATA.length+' articulos \u00b7 '+done+' clasificados';
      var vis=DATA.filter(pasa);
      if(!vis.length){ cont.innerHTML='<div class="empty">Sin resultados.</div>'; return; }
      cont.innerHTML=vis.map(fila).join('');
      cont.querySelectorAll('[data-cls]').forEach(function(b){ b.onclick=function(){ setClase(b.dataset.cod,b.dataset.cls); }; });
      cont.querySelectorAll('[data-sub]').forEach(function(b){ b.onclick=function(){ setSub(b.dataset.cod,b.dataset.sub); }; });
    }
    async function guardar(d){
      try{
        var res=scalar(await ctx.rpc('rcd_articulo_clasif_guardar',{
          p_gestor_id:ctx.ses.gestor_id, p_usuario_id:ctx.ses.id,
          p_cod_articulo:d.cod, p_descripcion:d.desc, p_clase:d.clase||'', p_servicio_subtipo:d.sub||''
        }));
        if(res!=='OK'){ ctx.toast('No se pudo guardar.','error'); return false; }
        return true;
      }catch(e){ ctx.toast('Error de conexion al guardar.','error'); return false; }
    }
    async function setClase(cod,k){
      if(!puedeEditar){ ctx.toast('No tienes permiso para clasificar.','error'); return; }
      var d=DATA.find(function(x){return x.cod===cod;}); if(!d) return;
      var pc=d.clase, ps=d.sub;
      d.clase=(d.clase===k)?'':k;
      if(d.clase!=='servicio') d.sub='';
      if(!(await guardar(d))){ d.clase=pc; d.sub=ps; }
      renderRows();
    }
    async function setSub(cod,k){
      var d=DATA.find(function(x){return x.cod===cod;}); if(!d||d.clase!=='servicio') return;
      var ps=d.sub; d.sub=(d.sub===k)?'':k;
      if(!(await guardar(d))){ d.sub=ps; }
      renderRows();
    }
  }

  // ===================== ITEMS =====================
  async function itemsView(){
    el.innerHTML='<div class="loading">Trayendo de TNS...</div>';
    const cfg = scalar(await ctx.rpc('rcd_tns_config_get',{p_gestor_id:ctx.ses.gestor_id})) || {};
    if(!cfg.tiene_credenciales){
      el.innerHTML='<div class="mcard" style="max-width:820px">'+tabbar('it')+'<div class="note warn">Conecta TNS en Facturacion -> Configuracion.</div></div>';
      wireTabs(); return;
    }
    let tns=null;
    try{
      tns = await fetch('/api/tns',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({accion:'traer_materiales',usuario_id:ctx.ses.id,gestor_id:ctx.ses.gestor_id,codigosucursal:cfg.codigo_sucursal||'00'})}).then(x=>x.json());
    }catch(e){ tns={ok:false}; }
    if(!(tns&&tns.ok)){
      el.innerHTML='<div class="mcard" style="max-width:820px">'+tabbar('it')+'<div class="note warn">No se pudo traer de TNS.</div></div>';
      wireTabs(); return;
    }
    const precioDe={}; (tns.materiales||[]).forEach(function(m){ precioDe[m.codigo]=(m.precio!=null?m.precio:0); });
    let clasif=[]; try{ const ss=await ctx.rpc('rcd_articulos_clasif_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(ss)) clasif=ss; }catch(e){}
    const grupos={ producto:[], servicio:[], aprovechado:[] };
    clasif.forEach(function(c){
      if(grupos[c.clase]){
        grupos[c.clase].push({ cod:c.cod_articulo, desc:c.descripcion||'(sin descripcion)', sub:c.servicio_subtipo||'', precio:(precioDe[c.cod_articulo]!=null?precioDe[c.cod_articulo]:0) });
      }
    });
    const syncTxt='TNS sincronizado \u00b7 '+new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
    const total=grupos.producto.length+grupos.servicio.length+grupos.aprovechado.length;
    function subLabel(x){ return x==='disposicion'?'Disposicion RCD':(x==='generacion'?'Generacion RCD':''); }
    function grupoHtml(k,label){
      const arr=grupos[k];
      const rows = arr.length ? arr.map(function(it){
        const right = it.precio>0
          ? '<span class="mono" style="color:#0F6E56;font-weight:600">$'+Number(it.precio).toLocaleString('es-CO')+' /t</span>'
          : '<span style="font-size:11.5px;color:#993C1D;background:#FAECE7;padding:3px 8px;border-radius:6px">Sin precio en TNS</span>';
        const sub = it.sub?'<span style="font-size:11px;color:#9aa3a0"> \u00b7 '+subLabel(it.sub)+'</span>':'';
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fff;border:1px solid var(--line,#E0E0DA);border-radius:8px;padding:9px 12px;margin-bottom:6px">'+
            '<div style="min-width:0"><div style="font-size:13.5px">'+esc(it.desc)+sub+'</div><span class="mono" style="font-size:11px;color:#6E7A77">'+esc(it.cod)+'</span></div>'+
            right+'</div>';
      }).join('') : '<div class="empty" style="padding:8px 0">Sin articulos en esta clase.</div>';
      return '<div style="display:flex;align-items:center;gap:8px;margin:14px 0 6px"><span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#0F766E">'+label+'</span><span style="font-size:11px;color:#9aa3a0">'+arr.length+'</span></div>'+rows;
    }
    el.innerHTML=
      '<div class="mcard" style="max-width:820px">'+
      tabbar('it')+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">'+
        '<div><h3 style="margin:0">Items \u00b7 precio de TNS</h3>'+
        '<p class="lead" style="margin:4px 0 0">Los articulos y precios vienen de TNS. Aca solo se consultan.</p></div>'+
        '<span style="display:inline-flex;align-items:center;gap:7px;background:#E6F4EA;color:#15803D;font-size:12px;padding:6px 11px;border-radius:8px"><span style="width:8px;height:8px;border-radius:50%;background:#15803D"></span>'+esc(syncTxt)+'</span>'+
      '</div>'+
      (total? grupoHtml('producto','Producto')+grupoHtml('servicio','Servicio')+grupoHtml('aprovechado','Aprovechado')
        : '<div class="empty" style="margin-top:12px">No hay articulos clasificados como producto/servicio/aprovechado. Clasificalos en la pestana Articulos.</div>')+
      '<div class="note" style="margin-top:10px">El transporte no va aca: se gestiona en la pestana Municipios.</div>'+
      '</div>';
    wireTabs();
  }

  // ===================== MUNICIPIOS =====================
  async function muniList(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    await cargarCat();
    el.innerHTML=
      '<div class="mcard" style="max-width:820px">'+
      tabbar('mu')+
      '<h3 style="margin:0 0 4px">Municipios · transporte</h3>'+
      '<p class="lead">Entra a un municipio para configurar sus tarifas de transporte. (Los municipios y zonas se crean en Parametros.)</p>'+
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
    if(!comunas.length) comunas=[{id:null,nombre:'(sin zona)'}];
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
      h+='<div style="overflow-x:auto"><table class="mtable" style="font-size:12px;min-width:600px"><tr><th rowspan="2" style="vertical-align:bottom">Zona</th>'+
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
        '<div class="row2"><div class="field"><label>Zona</label><select id="t_com">'+
          (comunas[0]&&comunas[0].id===null?'<option value="">(sin zona)</option>':'')+
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
