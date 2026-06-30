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
    let GEST={}; try{ const r=await ctx.rpc('rcd_gestor',{p_gestor_id:ctx.ses.gestor_id}); GEST=(Array.isArray(r)?r[0]:r)||{}; }catch(e){}
    el.innerHTML='<div class="mcard" style="max-width:920px">'+tabbar('mu')+'<div id="muBody"></div></div>';
    wireTabs();
    const body = el.querySelector('#muBody');
    const pEditar=ctx.can('parametros','editar'), pEliminar=ctx.can('parametros','eliminar');

    async function listaMun(){
      body.innerHTML='<div class="loading">Cargando...</div>';
      const ppSigla=(GEST.sigla_patio_propio||'pp');
      let lista=[]; try{ const r=await ctx.rpc('rcd_municipios_lista',{p_gestor_id:ctx.ses.gestor_id}); if(Array.isArray(r)) lista=r; }catch(e){}
      body.innerHTML=
        '<div style="background:#F0FAF7;border:1px solid #CCE9E1;border-radius:8px;padding:12px;margin-bottom:14px">'+
          '<div style="font-weight:600;margin-bottom:2px">Patio propio</div>'+
          '<div class="note" style="margin-bottom:8px">Tu propia escombrera. Su sigla cierra el codigo de transporte: <span class="mono">municipio-zona-tamano-'+esc(ppSigla)+'</span></div>'+
          '<div style="display:flex;gap:8px;align-items:flex-end">'+
            '<div class="field" style="margin:0"><label>Sigla del patio propio</label><input id="pp_sigla" class="mono" style="width:120px" value="'+esc(ppSigla)+'" placeholder="pp"></div>'+
            (pEditar?'<button class="btn primary sm" id="bPP">Guardar</button>':'')+
          '</div>'+
        '</div>'+
        '<h3 style="margin-top:0">Transporte \u00b7 municipios y zonas</h3>'+
        '<p class="lead">Aca se configura lo que arma el precio de cada ruta: municipios, zonas, siglas y metas. Las tarifas van en el boton Tarifas de cada municipio.</p>'+
        (pCrear?'<div style="margin-bottom:12px"><button class="btn primary sm" id="bNuevo">+ Municipio</button></div>':'')+
        (lista.length?
          '<table class="mtable"><tr><th>Municipio</th><th>Sigla</th><th>Zonas</th><th style="text-align:right">Meta vigente</th><th>Estado</th><th></th></tr>'+
          lista.map((m,i)=>'<tr><td><b>'+esc(m.nombre)+'</b></td><td class="mono">'+(m.sigla?esc(m.sigla):'<span style="color:#993C1D">sin sigla</span>')+'</td><td class="mono">'+m.n_comunas+'</td>'+
            '<td style="text-align:right" class="mono">'+(m.meta_vigente==null?'<span style="color:#C9C9C1">sin meta</span>':numEs(m.meta_vigente)+'%')+'</td>'+
            '<td><span class="badge '+(m.activo?'ok':'off')+'">'+(m.activo?'Activo':'Inactivo')+'</span></td>'+
            '<td><div class="rowbtns"><button class="btn ghost sm" data-open="'+i+'">Gestionar</button>'+
            '<button class="btn ghost sm" data-tar="'+i+'">Tarifas</button>'+
            (pEditar?'<button class="btn ghost sm" data-edit="'+i+'">Editar</button>':'')+
            (pEliminar?'<button class="btn ghost sm" data-anular="'+i+'">Anular</button>':'')+
            '</div></td></tr>').join('')+'</table>'
          : '<div class="empty">Aun no hay municipios.</div>');
      const bpp=body.querySelector('#bPP');
      if(bpp) bpp.onclick=async function(){
        if(!GEST.id){ ctx.toast('No se pudo cargar el gestor, recarga la pagina.','error'); return; }
        const nueva=(body.querySelector('#pp_sigla').value||'').trim().toLowerCase();
        if(!nueva){ ctx.toast('Escribe una sigla.','error'); return; }
        bpp.disabled=true;
        try{
          const r=scalar(await ctx.rpc('rcd_gestor_guardar',{
            p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id,
            p_nombre:GEST.nombre||'', p_nit:GEST.nit||'', p_telefono:GEST.telefono||'',
            p_correo:GEST.correo||'', p_direccion:GEST.direccion||'', p_logo_url:null,
            p_sigla_patio_propio:nueva }));
          if(r==='OK'){ GEST.sigla_patio_propio=nueva; ctx.toast('Sigla del patio propio guardada.'); listaMun(); }
          else ctx.toast('No se pudo guardar ('+(r||'error')+').','error');
        }catch(e){ ctx.toast('Error de conexion.','error'); }
        bpp.disabled=false;
      };
      if(pCrear) body.querySelector('#bNuevo').onclick=()=>formMun(null);
      body.querySelectorAll('[data-open]').forEach(b=>{const i=+b.dataset.open; b.onclick=()=>detalle(lista[i]);});
      body.querySelectorAll('[data-tar]').forEach(b=>{const i=+b.dataset.tar; b.onclick=()=>muniDetalle(lista[i]);});
      body.querySelectorAll('[data-edit]').forEach(b=>{const i=+b.dataset.edit; b.onclick=()=>formMun(lista[i]);});
      body.querySelectorAll('[data-anular]').forEach(b=>{const i=+b.dataset.anular; b.onclick=()=>anularMun(lista[i]);});
    }

    function formMun(m){
      const esNuevo=!m;
      body.innerHTML=
        '<h3 style="margin-top:0">'+(esNuevo?'Nuevo municipio':'Editar municipio')+'</h3>'+
        '<div class="field"><label>Nombre</label><input id="m_nombre" value="'+(esNuevo?'':esc(m.nombre))+'"></div>'+
        '<div class="field"><label>Sigla (para el codigo de transporte en TNS, ej: cuc)</label><input id="m_sigla" value="'+(esNuevo?'':esc(m.sigla||''))+'" placeholder="cuc"></div>'+
        (esNuevo?'':'<div class="field"><label>Estado</label><select id="m_activo"><option value="true"'+(m.activo?' selected':'')+'>Activo</option><option value="false"'+(!m.activo?' selected':'')+'>Inactivo</option></select></div>')+
        '<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar</button></div>';
      body.querySelector('#bCancel').onclick=listaMun;
      body.querySelector('#bSave').onclick=async function(){
        const btn=this, nombre=v(body,'m_nombre'); if(!nombre){ ctx.toast('Escribe el nombre.','error'); return; }
        const activo=esNuevo?true:(body.querySelector('#m_activo').value==='true');
        btn.disabled=true; btn.textContent='Guardando...';
        try{ const r=scalar(await ctx.rpc('rcd_municipio_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:esNuevo?null:m.id,p_nombre:nombre,p_activo:activo,p_sigla:v(body,'m_sigla')}));
          if(r==='OK'){ ctx.toast('Municipio guardado'); listaMun(); return; }
          ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.','error');
        }catch(e){ ctx.toast('Error de conexion.','error'); }
        btn.disabled=false; btn.textContent='Guardar';
      };
    }

    async function anularMun(m){
      if(!(await ctx.confirm('Anular el municipio "'+m.nombre+'"? Se ocultara, pero el historico queda.'))) return;
      try{ const r=scalar(await ctx.rpc('rcd_municipio_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:m.id}));
        if(r==='OK'){ ctx.toast('Municipio anulado'); listaMun(); return; }
        ctx.toast(r==='TIENE_OBRAS'?'No se puede anular: tiene obras asociadas.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.'),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
    }

    // ===== Nivel 2: detalle del municipio (metas + comunas) =====
    function detalle(m){
      body.innerHTML=
        '<button class="btn ghost sm" id="bBack">&larr; Municipios</button>'+
        '<h3 style="margin:12px 0 2px">'+esc(m.nombre)+'</h3>'+
        '<div id="secMetas" style="margin-top:14px"></div>'+
        '<div id="secComunas" style="margin-top:22px"></div>';
      body.querySelector('#bBack').onclick=listaMun;
      metas(m); comunas(m);
    }

    // ----- METAS -----
    async function metas(m){
      const cont=body.querySelector('#secMetas');
      cont.innerHTML='<div class="loading">Cargando metas...</div>';
      let lista=[]; try{ const r=await ctx.rpc('rcd_metas_lista',{p_municipio_id:m.id}); if(Array.isArray(r)) lista=r; }catch(e){}
      cont.innerHTML=
        '<div style="display:flex;align-items:center;gap:10px"><b>Metas de aprovechamiento</b>'+
          (pCrear?'<button class="btn ghost sm" id="bNuevaMeta" style="margin-left:auto">+ Meta</button>':'')+'</div>'+
        (lista.length?
          '<table class="mtable"><tr><th>Desde</th><th>Hasta</th><th style="text-align:right">Meta</th><th></th></tr>'+
          lista.map((x,i)=>'<tr><td class="mono">'+esc(x.vigencia_desde)+'</td>'+
            '<td class="mono">'+(x.vigencia_hasta?esc(x.vigencia_hasta):'indefinida')+'</td>'+
            '<td style="text-align:right" class="mono">'+numEs(x.porcentaje)+'%</td>'+
            '<td><div class="rowbtns">'+
              (pEditar?'<button class="btn ghost sm" data-emeta="'+i+'">Editar</button>':'')+
              (pEliminar?'<button class="btn ghost sm" data-ameta="'+i+'">Anular</button>':'')+
            '</div></td></tr>').join('')+'</table>'
          : '<div class="empty">Sin metas. Agrega la vigente.</div>');
      if(pCrear) cont.querySelector('#bNuevaMeta').onclick=()=>formMeta(m,null,cont);
      cont.querySelectorAll('[data-emeta]').forEach(b=>{const i=+b.dataset.emeta; b.onclick=()=>formMeta(m,lista[i],cont);});
      cont.querySelectorAll('[data-ameta]').forEach(b=>{const i=+b.dataset.ameta; b.onclick=()=>anularMeta(m,lista[i]);});
    }

    function formMeta(m,x,cont){
      const esNueva=!x;
      cont.innerHTML=
        '<b>'+(esNueva?'Nueva meta':'Editar meta')+'</b>'+
        '<div class="row2" style="margin-top:8px">'+
          '<div class="field"><label>Vigente desde</label><input type="date" id="me_desde" value="'+(esNueva?'':esc(x.vigencia_desde))+'"></div>'+
          '<div class="field"><label>Hasta (opcional)</label><input type="date" id="me_hasta" value="'+(esNueva||!x.vigencia_hasta?'':esc(x.vigencia_hasta))+'"></div>'+
        '</div>'+
        '<div class="field"><label>Meta de aprovechamiento (%)</label><input id="me_pct" value="'+(esNueva?'':numEs(x.porcentaje))+'"></div>'+
        '<div style="display:flex;gap:10px"><button class="btn ghost" id="bC">Cancelar</button><button class="btn primary" id="bS">Guardar</button></div>';
      cont.querySelector('#bC').onclick=()=>metas(m);
      cont.querySelector('#bS').onclick=async function(){
        const btn=this, desde=v(cont,'me_desde'), hasta=v(cont,'me_hasta'), pct=parseNum(v(cont,'me_pct'));
        if(!desde){ ctx.toast('Pon la fecha "desde".','error'); return; }
        btn.disabled=true; btn.textContent='Guardando...';
        try{ const r=scalar(await ctx.rpc('rcd_meta_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:esNueva?null:x.id,p_municipio_id:m.id,p_desde:desde,p_hasta:hasta||null,p_porcentaje:pct}));
          if(r==='OK'){ ctx.toast('Meta guardada'); metas(m); return; }
          ctx.toast(r==='RANGO_INVALIDO'?'La fecha "hasta" no puede ser antes de "desde".':(r==='PORCENTAJE_INVALIDO'?'El % debe estar entre 0 y 100.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.')),'error');
        }catch(e){ ctx.toast('Error de conexion.','error'); }
        btn.disabled=false; btn.textContent='Guardar';
      };
    }

    async function anularMeta(m,x){
      if(!(await ctx.confirm('Anular esta meta ('+numEs(x.porcentaje)+'%)?'))) return;
      try{ const r=scalar(await ctx.rpc('rcd_meta_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:x.id}));
        if(r==='OK'){ ctx.toast('Meta anulada'); metas(m); return; }
        ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.','error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
    }

    // ----- COMUNAS -----
    async function comunas(m){
      const cont=body.querySelector('#secComunas');
      cont.innerHTML='<div class="loading">Cargando zonas...</div>';
      let lista=[]; try{ const r=await ctx.rpc('rcd_comunas_lista',{p_municipio_id:m.id}); if(Array.isArray(r)) lista=r; }catch(e){}
      cont.innerHTML=
        '<div style="display:flex;align-items:center;gap:10px"><b>Zonas</b>'+
          (pCrear?'<button class="btn ghost sm" id="bNuevaComuna" style="margin-left:auto">+ Zona</button>':'')+'</div>'+
        (lista.length?
          '<table class="mtable"><tr><th>Zona</th><th>Sigla</th><th>Estado</th><th></th></tr>'+
          lista.map((c,i)=>'<tr><td><b>'+esc(c.nombre)+'</b></td><td class="mono">'+(c.sigla?esc(c.sigla):'<span style="color:#993C1D">sin</span>')+'</td>'+
            '<td><span class="badge '+(c.activa?'ok':'off')+'">'+(c.activa?'Activa':'Inactiva')+'</span></td>'+
            '<td><div class="rowbtns">'+
                          (pEditar?'<button class="btn ghost sm" data-ecom="'+i+'">Editar</button>':'')+
              (pEliminar?'<button class="btn ghost sm" data-acom="'+i+'">Anular</button>':'')+
            '</div></td></tr>').join('')+'</table>'
          : '<div class="empty">Sin zonas.</div>');
      if(pCrear) cont.querySelector('#bNuevaComuna').onclick=()=>formComuna(m,null,cont);
      cont.querySelectorAll('[data-ecom]').forEach(b=>{const i=+b.dataset.ecom; b.onclick=()=>formComuna(m,lista[i],cont);});
      cont.querySelectorAll('[data-acom]').forEach(b=>{const i=+b.dataset.acom; b.onclick=()=>anularComuna(m,lista[i]);});
    }

    function formComuna(m,c,cont){
      const esNueva=!c;
      cont.innerHTML=
        '<b>'+(esNueva?'Nueva zona':'Editar zona')+'</b>'+
        '<div class="field" style="margin-top:8px"><label>Nombre</label><input id="c_nombre" value="'+(esNueva?'':esc(c.nombre))+'"></div>'+
        '<div class="field"><label>Sigla (ej: z1)</label><input id="c_sigla" value="'+(esNueva?'':esc(c.sigla||''))+'" placeholder="z1"></div>'+
        '<div class="note" id="c_prev" style="margin-top:0"></div>'+
        (esNueva?'':'<div class="field"><label>Estado</label><select id="c_activa"><option value="true"'+(c.activa?' selected':'')+'>Activa</option><option value="false"'+(!c.activa?' selected':'')+'>Inactiva</option></select></div>')+
        '<div style="display:flex;gap:10px"><button class="btn ghost" id="bC2">Cancelar</button><button class="btn primary" id="bS2">Guardar</button></div>';
      cont.querySelector('#bC2').onclick=()=>comunas(m);
      const _prev=()=>{ const sg=(v(cont,'c_sigla')||'[sigla]').toLowerCase(); const pe=cont.querySelector('#c_prev'); if(pe) pe.innerHTML='Codigo de transporte: <b class="mono">'+esc(m.sigla||'(sigla-muni)')+'-'+esc(sg)+'-t7-mer</b> &middot; ejemplo con 7t y aliado Mercedes'; };
      const _si=cont.querySelector('#c_sigla'); if(_si){ _si.addEventListener('input',_prev); _prev(); }
      cont.querySelector('#bS2').onclick=async function(){
        const btn=this, nombre=v(cont,'c_nombre'); if(!nombre){ ctx.toast('Escribe el nombre.','error'); return; }
        const activa=esNueva?true:(cont.querySelector('#c_activa').value==='true');
        btn.disabled=true; btn.textContent='Guardando...';
        try{ const r=scalar(await ctx.rpc('rcd_comuna_guardar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:esNueva?null:c.id,p_municipio_id:m.id,p_nombre:nombre,p_activa:activa,p_sigla:v(cont,'c_sigla')}));
          if(r==='OK'){ ctx.toast('Zona guardada'); comunas(m); return; }
          ctx.toast(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo guardar.','error');
        }catch(e){ ctx.toast('Error de conexion.','error'); }
        btn.disabled=false; btn.textContent='Guardar';
      };
    }

    async function anularComuna(m,c){
      if(!(await ctx.confirm('Anular la comuna "'+c.nombre+'"? Se ocultara, pero el historico queda.'))) return;
      try{ const r=scalar(await ctx.rpc('rcd_comuna_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:c.id}));
        if(r==='OK'){ ctx.toast('Zona anulada'); comunas(m); return; }
        ctx.toast(r==='TIENE_OBRAS'?'No se puede anular: tiene obras asociadas.':(r==='SIN_PERMISO'?'No tienes permiso.':'No se pudo anular.'),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
    }

    listaMun();
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
