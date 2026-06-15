// ============================================================
// RCD PRO · Modulo Pesaje (RECEPCION)
// (usa helpers globales de mod-parametros.js: esc, scalar, v, numEs, parseNum)
// ============================================================
window.RCD_MODULOS = window.RCD_MODULOS || {};

window.RCD_MODULOS.pesaje = function(el, ctx){
  const pCrear=ctx.can('pesaje','escribir'), pEditar=ctx.can('pesaje','editar'), pEliminar=ctx.can('pesaje','eliminar');
  const filtros = { desde:'', hasta:'', origen:'', buscar:'', placa:'', estado:'' };

  function badgeEstado(e){
    if(e==='ok') return '<span class="badge ok">OK</span>';
    if(e==='esperando_tara') return '<span class="badge warn">Esperando 2a pesada</span>';
    if(e==='excedido_pendiente') return '<span class="badge danger">Excedido · pend.</span>';
    if(e==='anulada') return '<span class="badge off">Anulada</span>';
    return '<span class="badge off">'+esc(e||'')+'</span>';
  }
  function metodoTxt(m){ return m==='volumen' ? 'Vol × dens' : 'Bascula'; }

  // --- Fotos: comprimir en el dispositivo (liviano pero nitido) y subir a Storage ---
  function comprimirFoto(file, maxDim, calidad){
    return new Promise(function(resolve,reject){
      const img=new Image(), url=URL.createObjectURL(file);
      img.onload=function(){
        let w=img.width, h=img.height;
        if(w>h && w>maxDim){ h=Math.round(h*maxDim/w); w=maxDim; }
        else if(h>=w && h>maxDim){ w=Math.round(w*maxDim/h); h=maxDim; }
        const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        URL.revokeObjectURL(url);
        cv.toBlob(function(b){ b?resolve(b):reject(new Error('toBlob')); },'image/jpeg',calidad);
      };
      img.onerror=function(){ URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src=url;
    });
  }
  async function subirFoto(blob){
    const name='rec_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)+'.jpg';
    const path=ctx.ses.gestor_id+'/'+name;
    const res=await fetch(ctx.url+'/storage/v1/object/rcd-fotos/'+path,{
      method:'POST',
      headers:{ apikey:ctx.headers.apikey, Authorization:ctx.headers.Authorization, 'Content-Type':'image/jpeg' },
      body:blob });
    if(!res.ok) throw new Error('upload '+res.status);
    return ctx.url+'/storage/v1/object/public/rcd-fotos/'+path;
  }
  function msg(r){
    return ({SIN_PERMISO:'No tienes permiso.', ORIGEN_INVALIDO:'Origen invalido.',
      SIN_MATERIAL:'Selecciona el material (tipo de RCD).', METODO_INVALIDO:'Metodo invalido.',
      SIN_ORDEN:'Selecciona la orden.', ORDEN_INVALIDA:'La orden no es valida.',
      SIN_GENERADOR:'Escribe el nombre del generador particular.',
      VOLUMEN_DENSIDAD:'Volumen y densidad deben ser mayores a cero.',
      SIN_BRUTO:'El peso bruto debe ser mayor a cero.', TARA_MAYOR:'La tara no puede ser mayor o igual al bruto.',
      NO_ESPERA_TARA:'Esa recepcion no esta esperando 2a pesada.', SIN_TARA:'Escribe la tara.'})[r] || 'No se pudo completar la accion.';
  }

  // ===================== HISTORIAL =====================
  async function lista(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let rows=[];
    try{ const r=await ctx.rpc('rcd_recepciones_lista',{
        p_gestor_id:ctx.ses.gestor_id, p_desde:filtros.desde||null, p_hasta:filtros.hasta||null,
        p_origen:filtros.origen||null, p_buscar:filtros.buscar||null, p_placa:filtros.placa||null, p_estado:filtros.estado||null });
      rows=Array.isArray(r)?r:[]; }catch(e){}
    el.innerHTML=
      '<div class="mcard">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
        '<h3 style="margin:0">Recepciones</h3>'+
        (pCrear?'<button class="btn primary sm" id="bNueva">+ Nueva recepcion</button>':'')+
      '</div>'+
      '<p class="lead" style="margin:6px 0 12px">Historial de lo que entra. El Anexo II se genera desde aqui (en Cumplimiento).</p>'+
      '<div class="row2" style="gap:8px;flex-wrap:wrap;align-items:end;display:flex">'+
        '<div class="field" style="margin:0"><label>Desde</label><input type="date" id="f_desde" value="'+esc(filtros.desde)+'"></div>'+
        '<div class="field" style="margin:0"><label>Hasta</label><input type="date" id="f_hasta" value="'+esc(filtros.hasta)+'"></div>'+
        '<div class="field" style="margin:0"><label>Origen</label><select id="f_origen"><option value="">Todos</option>'+
          '<option value="orden"'+(filtros.origen==='orden'?' selected':'')+'>Obra</option>'+
          '<option value="particular"'+(filtros.origen==='particular'?' selected':'')+'>Particular</option></select></div>'+
        '<div class="field" style="margin:0"><label>Generador</label><input id="f_buscar" value="'+esc(filtros.buscar)+'" placeholder="Buscar"></div>'+
        '<div class="field" style="margin:0"><label>Placa</label><input id="f_placa" class="mono" value="'+esc(filtros.placa)+'" placeholder="ABC123"></div>'+
        '<div class="field" style="margin:0"><label>Estado</label><select id="f_estado"><option value="">Todos</option>'+
          '<option value="ok"'+(filtros.estado==='ok'?' selected':'')+'>OK</option>'+
          '<option value="esperando_tara"'+(filtros.estado==='esperando_tara'?' selected':'')+'>Esperando 2a pesada</option>'+
          '<option value="excedido_pendiente"'+(filtros.estado==='excedido_pendiente'?' selected':'')+'>Excedido pend.</option></select></div>'+
        '<button class="btn ghost sm" id="bFiltrar">Filtrar</button>'+
        '<button class="btn ghost sm" id="bLimpiar">Limpiar</button>'+
      '</div>'+
      (rows.length?
        '<table class="mtable" style="margin-top:12px"><tr><th>N.º</th><th>Fecha</th><th>Generador</th><th>Placa</th><th>Material</th><th>Neto</th><th>Metodo</th><th>Estado</th><th></th></tr>'+
        rows.map(function(r,i){ return '<tr>'+
          '<td class="mono"><b>'+esc(r.numero||'')+'</b></td>'+
          '<td class="mono">'+(r.fecha?esc(r.fecha):'-')+'</td>'+
          '<td>'+esc(r.generador||'')+(r.origen==='particular'?' <span class="badge off">particular</span>':'')+'</td>'+
          '<td class="mono">'+esc(r.placa||'-')+'</td>'+
          '<td>'+esc(r.material||'')+'</td>'+
          '<td class="mono">'+(r.neto_t!=null?numEs(r.neto_t)+' t':'<span style="color:var(--muted)">—</span>')+'</td>'+
          '<td>'+metodoTxt(r.metodo)+'</td>'+
          '<td>'+badgeEstado(r.estado)+'</td>'+
          '<td><div class="rowbtns">'+accionesIdx(r,i)+'</div></td></tr>'; }).join('')+'</table>'
        : '<div class="empty" style="margin-top:12px">No hay recepciones con esos filtros.</div>')+
      '</div>';

    const b=el.querySelector('#bNueva'); if(b) b.onclick=()=>form();
    el.querySelector('#bFiltrar').onclick=function(){
      filtros.desde=v(el,'f_desde'); filtros.hasta=v(el,'f_hasta'); filtros.origen=v(el,'f_origen');
      filtros.buscar=v(el,'f_buscar'); filtros.placa=v(el,'f_placa'); filtros.estado=v(el,'f_estado'); lista();
    };
    el.querySelector('#bLimpiar').onclick=function(){
      filtros.desde=filtros.hasta=filtros.origen=filtros.buscar=filtros.placa=filtros.estado=''; lista();
    };
    rows.forEach(function(r,i){
      const t=el.querySelector('[data-tara="'+i+'"]'); if(t) t.onclick=()=>taraForm(r);
      const ap=el.querySelector('[data-apr="'+i+'"]'); if(ap) ap.onclick=()=>aprobar(r);
      const a=el.querySelector('[data-anu="'+i+'"]'); if(a) a.onclick=()=>anular(r);
    });
  }

  function accionesIdx(r,i){
    let h='';
    if(r.estado==='esperando_tara' && pEditar) h+='<button class="btn ghost sm" data-tara="'+i+'">Registrar tara</button>';
    if(r.estado==='excedido_pendiente' && pEliminar) h+='<button class="btn primary sm" data-apr="'+i+'">Aprobar</button>';
    if(r.foto1_url) h+='<a class="btn ghost sm" href="'+esc(r.foto1_url)+'" target="_blank" rel="noopener">Foto 1</a>';
    if(r.foto2_url) h+='<a class="btn ghost sm" href="'+esc(r.foto2_url)+'" target="_blank" rel="noopener">Foto 2</a>';
    if(r.estado!=='anulada' && pEliminar) h+='<button class="btn ghost sm" data-anu="'+i+'">Anular</button>';
    h+='<button class="btn ghost sm" disabled title="Se genera en Cumplimiento (G5)">Anexo II</button>';
    return h || '<span class="mono" style="color:#C9C9C1;font-size:11px">-</span>';
  }

  // ===================== NUEVA RECEPCION =====================
  async function form(){
    el.innerHTML='<div class="loading">Cargando...</div>';
    let tipos=[], ordenes=[], tams=[];
    try{ const r=await ctx.rpc('rcd_tipos_residuo_lista',{}); tipos=Array.isArray(r)?r:[]; }catch(e){}
    try{ const r=await ctx.rpc('rcd_ordenes_para_pesaje',{p_gestor_id:ctx.ses.gestor_id}); ordenes=Array.isArray(r)?r:[]; }catch(e){}
    try{ const r=await ctx.rpc('rcd_volquetas_lista',{p_gestor_id:ctx.ses.gestor_id}); tams=(Array.isArray(r)?r:[]).filter(t=>t.activa); }catch(e){}

    let origen='orden', metodo='bascula';
    el.innerHTML=
      '<div class="mcard" style="max-width:720px">'+
      '<button class="btn ghost sm" id="bBack">&larr; Recepciones</button>'+
      '<h3 style="margin:12px 0 10px">Nueva recepcion</h3>'+

      '<div class="field"><label>Origen</label>'+
        '<select id="p_origen"><option value="orden">Con orden (obra)</option><option value="particular">Particular (suelto)</option></select></div>'+

      // CON ORDEN
      '<div id="bOrden">'+
        '<div class="field"><label>Orden que llega</label><select id="p_orden"><option value="">Selecciona...</option>'+
          ordenes.map(o=>'<option value="'+o.orden_id+'">'+esc(o.etiqueta||'')+'</option>').join('')+'</select>'+
          (ordenes.length?'':'<div class="note warn">No hay ordenes de recepcion asignadas/en ruta. Crea/asigna en Solicitudes, o usa Particular.</div>')+'</div>'+
        '<div id="cupoBox"></div>'+
      '</div>'+

      // PARTICULAR
      '<div id="bPart" style="display:none">'+
        '<div class="note warn">Particular: no descuenta cupo de obra, pero suma a los totales del gestor. Se piden los datos del generador para su Anexo II.</div>'+
        '<div class="row2"><div class="field"><label>Generador (nombre/razon social)</label><input id="g_nombre"></div>'+
          '<div class="field"><label>Documento / NIT</label><input id="g_doc"></div></div>'+
        '<div class="row2"><div class="field"><label>Direccion de origen</label><input id="g_dir"></div>'+
          '<div class="field"><label>Telefono</label><input id="g_tel"></div></div>'+
        '<div class="row2"><div class="field"><label>Placa</label><input id="g_placa" class="mono"></div>'+
          '<div class="field"><label>Conductor</label><input id="g_cond"></div></div>'+
        '<div class="field"><label>Tamano</label><select id="g_tam"><option value="">(opcional)</option>'+
          tams.map(t=>'<option value="'+t.id+'">'+esc(t.nombre)+'</option>').join('')+'</select></div>'+
      '</div>'+

      // MATERIAL
      '<div class="field"><label>Material / tipo de RCD</label><select id="p_tipo"><option value="">Selecciona...</option>'+
        tipos.map(t=>'<option value="'+t.id+'">'+esc(t.codigo)+' · '+esc(t.nombre)+'</option>').join('')+'</select></div>'+

      // METODO
      '<div class="field"><label>Metodo de peso</label>'+
        '<select id="p_metodo"><option value="bascula">Bascula (2 pesadas)</option><option value="volumen">Volumen × densidad</option></select></div>'+

      // BASCULA
      '<div id="bBas"><div class="row3" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'+
        '<div class="field"><label>1a pesada · bruto (t)</label><input id="p_bruto" class="cellnum"></div>'+
        '<div class="field"><label>2a pesada · tara (t)</label><input id="p_tara" class="cellnum" placeholder="al salir"></div>'+
        '<div class="field"><label>Neto (t)</label><div id="netoB" class="mono" style="font-size:18px;font-weight:600;color:var(--green)">—</div></div>'+
      '</div><div class="note">Si dejas la tara vacia, queda "esperando 2a pesada" y la registras al salir.</div></div>'+

      // VOLUMEN
      '<div id="bVol" style="display:none"><div class="row3" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'+
        '<div class="field"><label>Volumen (m³)</label><input id="p_vol" class="cellnum"></div>'+
        '<div class="field"><label>Densidad (t/m³)</label><input id="p_dens" class="cellnum"></div>'+
        '<div class="field"><label>Peso (t)</label><div id="netoV" class="mono" style="font-size:18px;font-weight:600;color:var(--green)">—</div></div>'+
      '</div><div class="note">Una sola captura. Escribe la densidad a mano.</div></div>'+

      // CONTACTO + OBS
      '<div class="field"><label>WhatsApp o correo (para enviar el Anexo II)</label><input id="p_contacto" placeholder="300 123 4567 / correo@dominio.com"></div>'+
      '<div class="field"><label>Fotos (opcional, max 2 · se comprimen solas)</label>'+
        '<div id="fotosWrap" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"></div>'+
        '<input type="file" id="fileFoto" accept="image/*" capture="environment" style="display:none">'+
      '</div>'+
      '<div class="field"><label>Observaciones</label><textarea id="p_obs" rows="2"></textarea></div>'+

      '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn ghost" id="bCancel">Cancelar</button><button class="btn primary" id="bSave">Guardar recepcion</button></div>'+
      '</div>';

    const selOrigen=el.querySelector('#p_origen'), selMetodo=el.querySelector('#p_metodo');
    const selOrden=el.querySelector('#p_orden'), cupoBox=el.querySelector('#cupoBox');
    async function mostrarCupo(){
      if(!selOrden || !selOrden.value){ if(cupoBox) cupoBox.innerHTML=''; return; }
      try{ const r=await ctx.rpc('rcd_orden_cupo',{p_orden_id:selOrden.value});
        const c=Array.isArray(r)&&r.length?r[0]:null;
        if(c && Number(c.tope_t)>0){
          const tope=Number(c.tope_t), rec=Number(c.recibido_t), disp=tope-rec;
          cupoBox.innerHTML='<div class="note'+(disp<=0?' warn':'')+'">Cupo de la obra: declarado <b>'+numEs(tope)+' t</b> · recibido <b>'+numEs(rec)+' t</b> · disponible <b>'+numEs(disp)+' t</b>'+(disp<=0?'. Lo que pese de mas quedara pendiente de aprobacion del admin.':'')+'</div>';
        } else { cupoBox.innerHTML='<div class="note">Esta obra no tiene cupo total declarado (no se bloquea por cupo).</div>'; }
      }catch(e){ cupoBox.innerHTML=''; }
    }
    if(selOrden) selOrden.onchange=mostrarCupo;

    // --- Fotos ---
    const fotos=[]; // urls subidas (max 2)
    const fotosWrap=el.querySelector('#fotosWrap'), fileFoto=el.querySelector('#fileFoto');
    function renderFotos(){
      let h='';
      fotos.forEach(function(u,i){
        h+='<div style="position:relative"><img src="'+u+'" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">'+
           '<button type="button" data-qf="'+i+'" title="Quitar" style="position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;border:none;background:var(--bad);color:#fff;cursor:pointer;font-weight:700;line-height:1">×</button></div>';
      });
      if(fotos.length<2) h+='<button type="button" class="btn ghost sm" id="bAddFoto">+ Foto</button>';
      fotosWrap.innerHTML=h;
      const add=fotosWrap.querySelector('#bAddFoto'); if(add) add.onclick=()=>fileFoto.click();
      fotosWrap.querySelectorAll('[data-qf]').forEach(function(btn){ btn.onclick=function(){ fotos.splice(+btn.dataset.qf,1); renderFotos(); }; });
    }
    fileFoto.onchange=async function(){
      const f=this.files&&this.files[0]; this.value=''; if(!f) return;
      if(fotos.length>=2){ ctx.toast('Maximo 2 fotos.','error'); return; }
      ctx.toast('Procesando foto...','info');
      try{ const blob=await comprimirFoto(f, 1280, 0.7); const url=await subirFoto(blob); fotos.push(url); renderFotos(); ctx.toast('Foto agregada'); }
      catch(e){ ctx.toast('No se pudo subir la foto.','error'); }
    };
    renderFotos();
    function tgOrigen(){ origen=selOrigen.value;
      el.querySelector('#bOrden').style.display = origen==='orden'?'':'none';
      el.querySelector('#bPart').style.display  = origen==='particular'?'':'none'; }
    function tgMetodo(){ metodo=selMetodo.value;
      el.querySelector('#bBas').style.display = metodo==='bascula'?'':'none';
      el.querySelector('#bVol').style.display = metodo==='volumen'?'':'none';
      el.querySelector('#bSave').textContent = (metodo==='bascula') ? 'Guardar (1a pesada o completa)' : 'Guardar recepcion'; }
    selOrigen.onchange=tgOrigen; selMetodo.onchange=tgMetodo; tgOrigen(); tgMetodo();

    function calcB(){ const b=parseNum(v(el,'p_bruto')), t=parseNum(v(el,'p_tara'));
      el.querySelector('#netoB').textContent = (b>0 && t>0 && t<b) ? numEs(Math.round((b-t)*1000)/1000) : '—'; }
    function calcV(){ const vol=parseNum(v(el,'p_vol')), d=parseNum(v(el,'p_dens'));
      el.querySelector('#netoV').textContent = (vol>0 && d>0) ? numEs(Math.round(vol*d*1000)/1000) : '—'; }
    ['p_bruto','p_tara'].forEach(id=>{ const e=el.querySelector('#'+id); if(e) e.oninput=calcB; });
    ['p_vol','p_dens'].forEach(id=>{ const e=el.querySelector('#'+id); if(e) e.oninput=calcV; });

    el.querySelector('#bBack').onclick=lista;
    el.querySelector('#bCancel').onclick=lista;
    el.querySelector('#bSave').onclick=async function(){
      const btn=this;
      const body={ p_usuario_id:ctx.ses.id, p_gestor_id:ctx.ses.gestor_id, p_origen:origen,
        p_orden_id: origen==='orden' ? (v(el,'p_orden')||null) : null,
        p_gen_nombre: origen==='particular' ? v(el,'g_nombre') : null,
        p_gen_documento: origen==='particular' ? v(el,'g_doc') : null,
        p_gen_direccion: origen==='particular' ? v(el,'g_dir') : null,
        p_gen_telefono: origen==='particular' ? v(el,'g_tel') : null,
        p_placa: origen==='particular' ? v(el,'g_placa') : null,
        p_conductor: origen==='particular' ? v(el,'g_cond') : null,
        p_tamano_id: origen==='particular' ? (v(el,'g_tam')||null) : null,
        p_tipo_residuo_id: v(el,'p_tipo')||null, p_metodo: metodo,
        p_bruto_t: metodo==='bascula' ? parseNum(v(el,'p_bruto')) : null,
        p_tara_t:  metodo==='bascula' ? (v(el,'p_tara')?parseNum(v(el,'p_tara')):null) : null,
        p_volumen_m3: metodo==='volumen' ? parseNum(v(el,'p_vol')) : null,
        p_densidad:   metodo==='volumen' ? parseNum(v(el,'p_dens')) : null,
        p_contacto_anexo: v(el,'p_contacto'), p_observaciones: v(el,'p_obs'),
        p_foto1_url: fotos[0]||null, p_foto2_url: fotos[1]||null };
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const r=scalar(await ctx.rpc('rcd_recepcion_crear',body));
        if(typeof r==='string' && r.indexOf('PEND:')===0){ ctx.toast('Guardada '+r.slice(5)+', pero EXCEDE el cupo: requiere aprobacion del admin.','error'); lista(); return; }
        if(typeof r==='string' && r.indexOf('PES-')===0){ ctx.toast('Recepcion '+r+' guardada'); lista(); return; }
        ctx.toast(msg(r),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; tgMetodo();
    };
  }

  // ===================== 2a PESADA (TARA) =====================
  async function taraForm(r){
    el.innerHTML=
      '<div class="mcard" style="max-width:520px">'+
      '<button class="btn ghost sm" id="bBackT">&larr; Recepciones</button>'+
      '<h3 style="margin:12px 0 6px">2a pesada · '+esc(r.numero||'')+'</h3>'+
      '<p class="lead">Registra la tara (vacio) al salir. El neto = bruto − tara.</p>'+
      '<div class="field"><label>Tara (t)</label><input id="t_tara" class="cellnum"></div>'+
      '<div style="display:flex;gap:10px;margin-top:6px"><button class="btn ghost" id="bCancelT">Cancelar</button><button class="btn primary" id="bSaveT">Guardar neto</button></div>'+
      '</div>';
    el.querySelector('#bBackT').onclick=lista;
    el.querySelector('#bCancelT').onclick=lista;
    el.querySelector('#bSaveT').onclick=async function(){
      const btn=this, tara=parseNum(v(el,'t_tara'));
      if(!(tara>0)){ ctx.toast('Escribe la tara.','error'); return; }
      btn.disabled=true; btn.textContent='Guardando...';
      try{ const res=scalar(await ctx.rpc('rcd_recepcion_tara',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:r.id,p_tara_t:tara}));
        if(res==='OK'){ ctx.toast('Neto registrado'); lista(); return; }
        if(res==='PEND'){ ctx.toast('Neto registrado, pero EXCEDE el cupo: requiere aprobacion del admin.','error'); lista(); return; }
        ctx.toast(msg(res),'error');
      }catch(e){ ctx.toast('Error de conexion.','error'); }
      btn.disabled=false; btn.textContent='Guardar neto';
    };
  }

  async function aprobar(r){
    if(!(await ctx.confirm('Aprobar la recepcion '+(r.numero||'')+' que excede el cupo? Quedara OK y se completara su orden.'))) return;
    try{ const res=scalar(await ctx.rpc('rcd_recepcion_aprobar',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:r.id}));
      if(res==='OK'){ ctx.toast('Recepcion aprobada'); lista(); return; }
      ctx.toast(res==='NO_PENDIENTE'?'Esa recepcion no esta pendiente.':msg(res),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  async function anular(r){
    if(!(await ctx.confirm('Anular la recepcion '+(r.numero||'')+'?'))) return;
    try{ const res=scalar(await ctx.rpc('rcd_recepcion_anular',{p_usuario_id:ctx.ses.id,p_gestor_id:ctx.ses.gestor_id,p_id:r.id}));
      if(res==='OK'){ ctx.toast('Recepcion anulada'); lista(); return; }
      ctx.toast(msg(res),'error');
    }catch(e){ ctx.toast('Error de conexion.','error'); }
  }

  lista();
};
