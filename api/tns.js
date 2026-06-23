// ============================================================
// RCD PRO · Servidor del Conector de Facturacion (Vercel)
// Ruta: /api/tns   (este archivo va en la carpeta  api/  del repo)
// Unico componente que ve la clave de TNS y la descifra.
// El navegador NUNCA recibe la clave.
//
// Variable de entorno requerida en Vercel:
//   TNS_CRYPTO_KEY  = 64 caracteres hex (llave de cifrado AES-256)
// ============================================================
const crypto = require('crypto');

const SUPABASE_URL  = "https://ymzxjuncantobxeftfqd.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltenhqdW5jYW50b2J4ZWZ0ZnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzM0ODUsImV4cCI6MjA5MjgwOTQ4NX0.p1K6pvZy-Agb2J-mKF2MNR5ujrTfRjmvtTyP3QiIzu8";

function getKey(){
  const k = (process.env.TNS_CRYPTO_KEY || '').trim();
  if(!/^[0-9a-fA-F]{64}$/.test(k)) return null;
  return Buffer.from(k, 'hex');
}
function encrypt(text, key){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(text||''),'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex')+':'+tag.toString('hex')+':'+ct.toString('hex');
}
function decrypt(blob, key){
  const p = String(blob||'').split(':');
  if(p.length!==3) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(p[0],'hex'));
  decipher.setAuthTag(Buffer.from(p[1],'hex'));
  const pt = Buffer.concat([decipher.update(Buffer.from(p[2],'hex')), decipher.final()]);
  return pt.toString('utf8');
}
async function rpc(fn, body){
  const r = await fetch(SUPABASE_URL+'/rest/v1/rpc/'+fn, {
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON,'Authorization':'Bearer '+SUPABASE_ANON},
    body: JSON.stringify(body||{})
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return txt; }
}
function one(r){ return Array.isArray(r) ? r[0] : r; }

async function tnsLogin(gestor_id, key){
  const cfg = one(await rpc('rcd_tns_config_cred_get', { p_gestor_id: gestor_id }));
  if(!cfg) return { error:'SIN_CREDENCIALES' };
  let codEmpresa, usuario, clave;
  try{
    codEmpresa = decrypt(cfg.cod_empresa_cif, key);
    usuario    = decrypt(cfg.usuario_cif, key);
    clave      = decrypt(cfg.clave_cif, key);
  }catch(e){ return { error:'NO_DESCIFRA' }; }
  const url = (cfg.url_base || 'https://api.tns.co').replace(/\/+$/,'');
  let lr, lj=null;
  try{
    lr = await fetch(url+'/v2/Acceso/Login', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ codigoEmpresa: codEmpresa, nombreUsuario: usuario, contrasenia: clave }) });
    const t = await lr.text(); try{ lj = JSON.parse(t); }catch{ lj = null; }
  }catch(e){ return { error:'NO_CONECTA_TNS' }; }
  const ok = !!(lr.ok && lj && lj.status === true && lj.data);
  if(!ok) return { error: (lj && lj.message) || ('HTTP '+(lr ? lr.status : '?')) };
  return { token: lj.data, url };
}

module.exports = async (req, res) => {
  if(req.method !== 'POST'){ res.status(405).json({ok:false, error:'METHOD'}); return; }

  let body = req.body;
  if(typeof body === 'string'){ try{ body = JSON.parse(body); }catch{ body = {}; } }
  if(!body || typeof body !== 'object') body = {};

  const key = getKey();
  if(!key){ res.status(200).json({ok:false, error:'LLAVE_INVALIDA'}); return; }

  const { accion, usuario_id, gestor_id } = body;
  if(!gestor_id){ res.status(200).json({ok:false, error:'FALTA_GESTOR'}); return; }

  try {
    // ---- Guardar credenciales (las cifra aqui y las manda cifradas a Supabase) ----
    if(accion === 'guardar_credenciales'){
      const r = await rpc('rcd_tns_config_cred_set', {
        p_usuario_id: usuario_id, p_gestor_id: gestor_id,
        p_cod_empresa_cif: encrypt(body.cod_empresa, key),
        p_usuario_cif:     encrypt(body.usuario, key),
        p_clave_cif:       encrypt(body.clave, key),
        p_url_base:        body.url_base || ''
      });
      const v = one(r);
      if(v === 'OK'){ res.status(200).json({ok:true}); return; }
      res.status(200).json({ok:false, error: v || 'NO_GUARDO'}); return;
    }

    // ---- Probar conexion (descifra y hace Login a TNS) ----
    if(accion === 'probar_conexion'){
      const lg = await tnsLogin(gestor_id, key);
      const okLogin = !lg.error;
      await rpc('rcd_tns_config_conexion_set', { p_gestor_id: gestor_id, p_ok: okLogin });
      if(okLogin){ res.status(200).json({ok:true}); return; }
      res.status(200).json({ok:false, error: lg.error}); return;
    }

    // ---- Traer materiales de TNS (Material/Listar) ----
    if(accion === 'traer_materiales'){
      const lg = await tnsLogin(gestor_id, key);
      if(lg.error){ res.status(200).json({ok:false, error: lg.error}); return; }
      const suc = encodeURIComponent(body.codigosucursal || '');
      let r2, j2=null;
      try{
        r2 = await fetch(lg.url+'/v2/tablas/Material/Listar?codigosucursal='+suc, {
          method:'GET', headers:{'Authorization':'Bearer '+lg.token} });
        const t2 = await r2.text(); try{ j2 = JSON.parse(t2); }catch{ j2 = null; }
      }catch(e){ res.status(200).json({ok:false, error:'NO_CONECTA_TNS'}); return; }
      if(!(r2.ok && j2 && j2.status === true)){
        res.status(200).json({ok:false, error: (j2 && j2.message) || ('HTTP '+(r2 ? r2.status : '?')) }); return;
      }
      const lista = (Array.isArray(j2.data) ? j2.data : []).map(x => ({
        codigo: x.codigo, descripcion: x.descripcion, iva: x.porcentajeIva
      })).filter(x => x.codigo);
      res.status(200).json({ok:true, materiales: lista}); return;
    }

    // ---- Traer clientes de TNS (Tercero/Listar) ----
    if(accion === 'traer_clientes'){
      const lg = await tnsLogin(gestor_id, key);
      if(lg.error){ res.status(200).json({ok:false, error: lg.error}); return; }
      const filtro = encodeURIComponent(body.filtro || '');
      let r2, j2=null;
      try{
        r2 = await fetch(lg.url+'/v2/tablas/Tercero/Listar?filtro='+filtro, {
          method:'GET', headers:{'Authorization':'Bearer '+lg.token} });
        const t2 = await r2.text(); try{ j2 = JSON.parse(t2); }catch{ j2 = null; }
      }catch(e){ res.status(200).json({ok:false, error:'NO_CONECTA_TNS'}); return; }
      if(!(r2.ok && j2 && j2.status === true)){
        res.status(200).json({ok:false, error: (j2 && j2.message) || ('HTTP '+(r2 ? r2.status : '?')) }); return;
      }
      const arr = Array.isArray(j2.data) ? j2.data : [];
      const esCliente = x => x.cliente !== undefined && x.cliente !== null && String(x.cliente).toUpperCase() === 'S';
      let base = arr.filter(esCliente);
      // Si TNS no devuelve el campo 'cliente' en el listado, no podemos distinguir: devolvemos marca para avisar.
      const sinCampoCliente = arr.length > 0 && arr.every(x => x.cliente === undefined || x.cliente === null || x.cliente === '');
      const lista = base.map(x => ({
        codigo: x.codigo, nit: x.nit, nombre: x.nombre,
        natJuridica: x.natJuridica, codigoCiudad: x.codigoCiudad,
        nombreCiudad: x.nombreCiudad, telefono: x.telefono
      })).filter(x => x.codigo || x.nit);
      res.status(200).json({ok:true, clientes: lista, total_tns: arr.length, sin_campo_cliente: sinCampoCliente}); return;
    }

    // ---- Crear factura (Ventas/Crear) ----
    if(accion === 'crear_factura'){
      const lg = await tnsLogin(gestor_id, key);
      if(lg.error){ res.status(200).json({ok:false, error: lg.error}); return; }
      const suc = encodeURIComponent(body.codigosucursal || '');
      const factura = body.factura || {};
      if(typeof factura.asentar === 'undefined') factura.asentar = 0; // 0 = borrador
      let r2, j2=null, t2='';
      try{
        r2 = await fetch(lg.url+'/v2/facturacion/Ventas/Crear?codigosucursal='+suc, {
          method:'POST',
          headers:{'Authorization':'Bearer '+lg.token,'Content-Type':'application/json'},
          body: JSON.stringify(factura)
        });
        t2 = await r2.text(); try{ j2 = JSON.parse(t2); }catch{ j2 = null; }
      }catch(e){ res.status(200).json({ok:false, error:'NO_CONECTA_TNS'}); return; }
      if(!(r2.ok && j2)){
        res.status(200).json({ok:false, error: (j2 && j2.message) || ('HTTP '+(r2 ? r2.status : '?')), detalle: (t2||'').slice(0,400) }); return;
      }
      const d = j2.data || {};
      res.status(200).json({
        ok: true,
        success: (d.success !== false),
        consecutivo: d.consecutivo || d.numeroFactura || null,
        asentado: d.asentado || false,
        mensaje: d.mensajeAsentado || j2.message || '',
        enlace_pago: d.enlacePago || null,
        detalle: d.responseDetalle || null
      }); return;
    }

    res.status(200).json({ok:false, error:'ACCION_DESCONOCIDA'});
  } catch(e){
    res.status(200).json({ok:false, error: 'ERR:'+((e && e.message) || String(e)) });
  }
};
