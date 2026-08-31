from flask import Blueprint, jsonify, request
from sqlalchemy import String, cast, func, or_

from ..models import PaqueteAnalista, Reporte, Usuario
from ..utils import (
    _calcular_rendimiento,
    _estado_paquete_global,
    _estado_paquete_modo,
    _modos_de_paquete,
    _parse_fecha_fin,
    _parse_fecha_inicio,
    _semaforo_por_rendimiento,
)

status_bp = Blueprint('status', __name__, url_prefix='/api')


def _success(payload=None, status_code=200, **kwargs):
    data = {'status': 'ok', **(payload or {})}
    data.update(kwargs)
    return jsonify(data), status_code


def _error(message, status_code=400, **kwargs):
    data = {'status': 'error', 'message': message, **kwargs}
    return jsonify(data), status_code


@status_bp.route('/status/opciones', methods=['GET'])
def status_opciones():
    # Devuelve los filtros base para el dashboard público.
    paquetes = PaqueteAnalista.query.order_by(PaqueteAnalista.nombre.asc()).all()
    return _success({
        'paquetes': [
            {
                'nombre': paquete.nombre,
                'fecha_creacion': paquete.created_at.isoformat() + 'Z' if paquete.created_at else None,
                'estado_paquete': _estado_paquete_global(paquete)
            }
            for paquete in paquetes if paquete.nombre
        ],
        'modos': ['ALL', 'GENERAL'],
        'usuarios': [{'id': usuario.id, 'nombre': usuario.nombre} for usuario in Usuario.query.order_by(Usuario.nombre.asc()).all()]
    })


@status_bp.route('/status/resumen', methods=['GET'])
def status_resumen():
    # Consolida reportes, paquetes y analistas en una sola vista agregada.
    paquetes_param = (request.args.get('paquetes') or 'ALL').strip()
    modo_param = (request.args.get('modo') or 'ALL').upper().strip()
    analista_id_param = (request.args.get('analista_id') or '').strip()
    nombre_param = (request.args.get('nombre') or '').strip()
    desde_param = (request.args.get('desde') or '').strip()
    hasta_param = (request.args.get('hasta') or '').strip()

    query = Reporte.query
    paquetes_coincidentes_nombre = None

    if paquetes_param and paquetes_param.upper() != 'ALL':
        paquetes = [paquete.strip() for paquete in paquetes_param.split(',') if paquete.strip()]
        if paquetes:
            query = query.filter(Reporte.nombre_paquete.in_(paquetes))

    if modo_param in ['GENERAL']:
        query = query.filter_by(modo=modo_param)

    if analista_id_param:
        try:
            analista_id = int(analista_id_param)
            query = query.filter(Reporte.analista_id == analista_id)
        except ValueError:
            return _error('analista_id inválido', status_code=400)

    if nombre_param:
        termino = f'%{nombre_param.lower()}%'
        usuarios_ids = [usuario.id for usuario in Usuario.query.filter(func.lower(cast(Usuario.nombre, String)).like(termino)).all()]
        condiciones = [func.lower(cast(Reporte.nombre_paquete, String)).like(termino)]
        if usuarios_ids:
            condiciones.append(Reporte.analista_id.in_(usuarios_ids))
        query = query.filter(or_(*condiciones))
        paquetes_coincidentes_nombre = {paquete.nombre for paquete in PaqueteAnalista.query.filter(func.lower(cast(PaqueteAnalista.nombre, String)).like(termino)).all() if paquete.nombre}

    fecha_desde = _parse_fecha_inicio(desde_param)
    fecha_hasta = _parse_fecha_fin(hasta_param)
    if fecha_desde:
        query = query.filter(Reporte.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Reporte.fecha < fecha_hasta)

    reportes = query.order_by(Reporte.fecha.desc()).all()
    paquetes_base = PaqueteAnalista.query.all()
    usuarios = Usuario.query.all()
    mapa_usuarios = {usuario.id: usuario.nombre for usuario in usuarios}

    meta_total = sum(float(reporte.tiempo_meta or 0) for reporte in reportes)
    real_total = sum(float(reporte.tiempo_real or 0) for reporte in reportes)
    rendimiento_global = _calcular_rendimiento(meta_total, real_total)

    por_paquete_map = {}
    por_analista_map = {}

    for reporte in reportes:
        clave_paquete = f'{reporte.nombre_paquete}__{reporte.modo}'
        if clave_paquete not in por_paquete_map:
            por_paquete_map[clave_paquete] = {
                'nombre_paquete': reporte.nombre_paquete,
                'modo': reporte.modo,
                'registros': 0,
                'meta_total': 0.0,
                'real_total': 0.0,
                'fecha_creacion': reporte.fecha,
                'fecha_ultima': reporte.fecha
            }
        por_paquete_map[clave_paquete]['registros'] += 1
        por_paquete_map[clave_paquete]['meta_total'] += float(reporte.tiempo_meta or 0)
        por_paquete_map[clave_paquete]['real_total'] += float(reporte.tiempo_real or 0)
        if reporte.fecha and (por_paquete_map[clave_paquete]['fecha_creacion'] is None or reporte.fecha < por_paquete_map[clave_paquete]['fecha_creacion']):
            por_paquete_map[clave_paquete]['fecha_creacion'] = reporte.fecha
        if reporte.fecha and (por_paquete_map[clave_paquete]['fecha_ultima'] is None or reporte.fecha > por_paquete_map[clave_paquete]['fecha_ultima']):
            por_paquete_map[clave_paquete]['fecha_ultima'] = reporte.fecha

        aid = int(reporte.analista_id)
        if aid not in por_analista_map:
            por_analista_map[aid] = {
                'analista_id': aid,
                'nombre': mapa_usuarios.get(aid, f'Usuario {aid}'),
                'registros': 0,
                'meta_total': 0.0,
                'real_total': 0.0
            }
        por_analista_map[aid]['registros'] += 1
        por_analista_map[aid]['meta_total'] += float(reporte.tiempo_meta or 0)
        por_analista_map[aid]['real_total'] += float(reporte.tiempo_real or 0)

    for paquete in paquetes_base:
        if paquetes_param and paquetes_param.upper() != 'ALL':
            paquetes_filtrados = [paquete_nombre.strip() for paquete_nombre in paquetes_param.split(',') if paquete_nombre.strip()]
            if paquete.nombre not in paquetes_filtrados:
                continue

        if paquetes_coincidentes_nombre is not None and paquete.nombre not in paquetes_coincidentes_nombre and paquete.nombre not in {reporte.nombre_paquete for reporte in reportes}:
            continue

        for modo in _modos_de_paquete(paquete):
            if modo_param in ['GENERAL'] and modo_param != modo:
                continue

            clave_paquete = f'{paquete.nombre}__{modo}'
            if clave_paquete not in por_paquete_map:
                por_paquete_map[clave_paquete] = {
                    'nombre_paquete': paquete.nombre,
                    'modo': modo,
                    'registros': 0,
                    'meta_total': 0.0,
                    'real_total': 0.0,
                    'fecha_creacion': paquete.created_at,
                    'fecha_ultima': paquete.updated_at,
                    'estado_paquete': _estado_paquete_modo(paquete.nombre, modo)
                }
            else:
                por_paquete_map[clave_paquete]['estado_paquete'] = _estado_paquete_modo(paquete.nombre, modo)
                por_paquete_map[clave_paquete]['fecha_creacion'] = por_paquete_map[clave_paquete]['fecha_creacion'] or paquete.created_at
                por_paquete_map[clave_paquete]['fecha_ultima'] = por_paquete_map[clave_paquete]['fecha_ultima'] or paquete.updated_at

    por_paquete = []
    for _, item in por_paquete_map.items():
        rendimiento = _calcular_rendimiento(item['meta_total'], item['real_total'])
        item['rendimiento'] = round(rendimiento, 2)
        item['desviacion_total'] = round(item['real_total'] - item['meta_total'], 2)
        item['semaforo'] = _semaforo_por_rendimiento(rendimiento)
        item['meta_total'] = round(item['meta_total'], 2)
        item['real_total'] = round(item['real_total'], 2)
        item['fecha_creacion'] = item['fecha_creacion'].isoformat() + 'Z' if item['fecha_creacion'] else None
        item['fecha_ultima'] = item['fecha_ultima'].isoformat() + 'Z' if item['fecha_ultima'] else None
        if not item.get('estado_paquete'):
            item['estado_paquete'] = _estado_paquete_modo(item['nombre_paquete'], item['modo'])
        por_paquete.append(item)

    por_paquete.sort(key=lambda x: x['real_total'], reverse=True)

    por_analista = []
    for _, item in por_analista_map.items():
        rendimiento = _calcular_rendimiento(item['meta_total'], item['real_total'])
        item['rendimiento'] = round(rendimiento, 2)
        item['desviacion_total'] = round(item['real_total'] - item['meta_total'], 2)
        item['semaforo'] = _semaforo_por_rendimiento(rendimiento)
        item['meta_total'] = round(item['meta_total'], 2)
        item['real_total'] = round(item['real_total'], 2)
        por_analista.append(item)

    por_analista.sort(key=lambda x: x['rendimiento'], reverse=True)

    return _success({
        'filtros': {
            'paquetes': paquetes_param,
            'modo': modo_param,
            'analista_id': analista_id_param,
            'nombre': nombre_param,
            'desde': desde_param,
            'hasta': hasta_param
        },
        'resumen_global': {
            'registros': len(reportes),
            'paquetes': len({reporte.nombre_paquete for reporte in reportes}),
            'analistas': len({reporte.analista_id for reporte in reportes}),
            'meta_total': round(meta_total, 2),
            'real_total': round(real_total, 2),
            'desviacion_total': round(real_total - meta_total, 2),
            'rendimiento_global': round(rendimiento_global, 2),
            'semaforo': _semaforo_por_rendimiento(rendimiento_global)
        },
        'por_paquete': por_paquete,
        'por_analista': por_analista
    })