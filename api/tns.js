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
      const cfg = one(await rpc('rcd_tns_config_cred_get', { p_gestor_id: gestor_id }));
      if(!cfg){ res.status(200).json({ok:false, error:'SIN_CREDENCIALES'}); return; }

      let codEmpresa, usuario, clave, url;
      try{
        codEmpresa = decrypt(cfg.cod_empresa_cif, key);
        usuario    = decrypt(cfg.usuario_cif, key);
        clave      = decrypt(cfg.clave_cif, key);
      }catch(e){ res.status(200).json({ok:false, error:'NO_DESCIFRA'}); return; }
      url = (cfg.url_base || 'https://api.tns.co').replace(/\/+$/,'');

      let lr, ltxt, lj=null;
      try{
        lr = await fetch(url+'/v2/Acceso/Login', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ codigoEmpresa: codEmpresa, nombreUsuario: usuario, contrasenia: clave })
        });
        ltxt = await lr.text();
        try{ lj = JSON.parse(ltxt); }catch{ lj = null; }
      }catch(e){
        await rpc('rcd_tns_config_conexion_set', { p_gestor_id: gestor_id, p_ok: false });
        res.status(200).json({ok:false, error:'NO_CONECTA_TNS'}); return;
      }

      const okLogin = !!(lr.ok && lj && lj.status === true && lj.data);
      await rpc('rcd_tns_config_conexion_set', { p_gestor_id: gestor_id, p_ok: okLogin });

      if(okLogin){ res.status(200).json({ok:true}); return; }
      res.status(200).json({ok:false, error: (lj && lj.message) || ('HTTP '+(lr ? lr.status : '?')) }); return;
    }

    res.status(200).json({ok:false, error:'ACCION_DESCONOCIDA'});
  } catch(e){
    res.status(200).json({ok:false, error: 'ERR:'+((e && e.message) || String(e)) });
  }
};
