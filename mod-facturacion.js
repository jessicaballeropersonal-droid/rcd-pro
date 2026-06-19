-- ============================================================
-- RCD PRO · rcd_obras_saldos: agrega numero/fecha/valor de la cotizacion vigente
-- Pegar en: Supabase -> SQL Editor -> Run
-- ============================================================
drop function if exists rcd_obras_saldos(uuid);
create or replace function rcd_obras_saldos(p_gestor_id uuid)
returns table(obra_id uuid, obra text, cliente text, abonado numeric, consumido numeric, saldo numeric,
              modalidad text, cupo_credito numeric, bloqueada boolean,
              cot_numero text, cot_fecha date, cot_total numeric)
language sql security definer as $$
  select o.id, o.nombre,
    (select razon_social from rcd_clientes c where c.id=o.cliente_id),
    coalesce((select sum(monto) from rcd_anticipos a where a.obra_id=o.id and coalesce(a.anulada,false)=false),0) as abonado,
    rcd_obra_consumo(p_gestor_id,o.id) as consumido,
    coalesce((select sum(monto) from rcd_anticipos a where a.obra_id=o.id and coalesce(a.anulada,false)=false),0) - rcd_obra_consumo(p_gestor_id,o.id) as saldo,
    coalesce(o.modalidad,'anticipo') as modalidad,
    coalesce(o.cupo_credito,0) as cupo_credito,
    ( ( (coalesce((select sum(monto) from rcd_anticipos a where a.obra_id=o.id and coalesce(a.anulada,false)=false),0) - rcd_obra_consumo(p_gestor_id,o.id))
        + (case when coalesce(o.modalidad,'anticipo')='credito' then coalesce(o.cupo_credito,0) else 0 end) ) <= 0
      and not coalesce(o.desbloqueo_saldo,false) ) as bloqueada,
    (select numero from rcd_cotizaciones q where q.obra_id=o.id and q.estado='aceptada' and coalesce(q.anulada,false)=false order by q.fecha desc, q.creado_en desc limit 1) as cot_numero,
    (select fecha  from rcd_cotizaciones q where q.obra_id=o.id and q.estado='aceptada' and coalesce(q.anulada,false)=false order by q.fecha desc, q.creado_en desc limit 1) as cot_fecha,
    (select total  from rcd_cotizaciones q where q.obra_id=o.id and q.estado='aceptada' and coalesce(q.anulada,false)=false order by q.fecha desc, q.creado_en desc limit 1) as cot_total
  from rcd_obras o
  where o.gestor_id=p_gestor_id and coalesce(o.anulada,false)=false
    and ( exists(select 1 from rcd_anticipos a where a.obra_id=o.id and coalesce(a.anulada,false)=false)
       or exists(select 1 from rcd_cotizaciones q where q.obra_id=o.id and q.estado='aceptada' and coalesce(q.anulada,false)=false) )
  order by o.nombre;
$$;
grant execute on function rcd_obras_saldos(uuid) to anon;
