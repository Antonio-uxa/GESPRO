from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Reporte
from ..utils import _calcular_rendimiento

reportes_bp = Blueprint('reportes', __name__, url_prefix='/api')


def _success(payload=None, status_code=200, **kwargs):
    data = {'status': 'ok', **(payload or {})}
    data.update(kwargs)
    return jsonify(data), status_code


def _error(message, status_code=400, **kwargs):
    data = {'status': 'error', 'message': message, **kwargs}
    return jsonify(data), status_code


@reportes_bp.route('/guardar-reporte-plural', methods=['POST'])
def guardar_reporte_plural():
    # Guarda un mismo lote para varios analistas y calcula el rendimiento por usuario.
    data = request.get_json(silent=True) or {}
    ids = data.get('analista_ids', [])
    modo = str(data.get('modo') or '').upper()
    meta_total = float(data.get('tiempo_meta', 0) or 0)
    real_total = float(data.get('tiempo_real', 0) or 0)
    unidades_por_usuario = data.get('unidades_por_usuario', {}) or {}
    tiempos_meta_por_usuario = data.get('tiempos_meta_por_usuario', {}) or {}
    tiempos_reales_por_usuario = data.get('tiempos_reales_por_usuario', {}) or {}

    if not ids:
        return _error('No hay analistas seleccionados', status_code=400)
    if not modo:
        return _error('El modo del reporte es obligatorio', status_code=400)

    meta_por_usuario = meta_total / len(ids)
    rendimientos = []

    for uid in ids:
        unidades_usuario = int(unidades_por_usuario.get(str(uid), unidades_por_usuario.get(uid, data.get('unidades_general', 0) or 0)))
        tiempo_meta_usuario = float(tiempos_meta_por_usuario.get(str(uid), tiempos_meta_por_usuario.get(uid, meta_por_usuario)))
        tiempo_real_usuario = float(tiempos_reales_por_usuario.get(str(uid), tiempos_reales_por_usuario.get(uid, real_total)))
        rendimiento_usuario = _calcular_rendimiento(tiempo_meta_usuario, tiempo_real_usuario)

        nuevo = Reporte(
            analista_id=uid,
            nombre_paquete=data.get('nombre_paquete', 'Lote_Grupal'),
            modo=modo,
            unidades_general=unidades_usuario,
            tiempo_meta=tiempo_meta_usuario,
            tiempo_real=tiempo_real_usuario,
            rendimiento=round(rendimiento_usuario, 2)
        )
        db.session.add(nuevo)
        rendimientos.append(rendimiento_usuario)

    db.session.commit()

    rendimiento_promedio = (sum(rendimientos) / len(rendimientos)) if rendimientos else 0
    return _success({'rendimiento': round(rendimiento_promedio, 2)})


@reportes_bp.route('/guardar-reporte-especifico', methods=['POST'])
def guardar_reporte_especifico():
    return _error('El modo ESPECIFICO no está soportado en este servidor.', status_code=400)
