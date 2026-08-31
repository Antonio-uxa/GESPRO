from flask import Blueprint, jsonify, request

from ..auth import _require_admin
from ..extensions import db
from ..models import Promocion
from ..utils import _serializar_promocion

promociones_bp = Blueprint('promociones', __name__, url_prefix='/api')


def _success(payload=None, status_code=200, **kwargs):
    data = {'status': 'ok', **(payload or {})}
    data.update(kwargs)
    return jsonify(data), status_code


def _error(message, status_code=400, **kwargs):
    data = {'status': 'error', 'message': message, **kwargs}
    return jsonify(data), status_code


@promociones_bp.route('/admin/promociones', methods=['GET'])
@_require_admin
def listar_promociones():
    # Catálogo administrativo de promociones, protegido por token de admin.
    try:
        promociones = Promocion.query.order_by(Promocion.nombre).all()
        return _success({'data': [_serializar_promocion(promocion) for promocion in promociones]})
    except Exception as exc:
        return _error(str(exc), status_code=500)


@promociones_bp.route('/admin/promociones', methods=['POST'])
@_require_admin
def crear_promocion():
    # Crea una promoción nueva y la asocia a una categoría si corresponde.
    try:
        data = request.get_json(silent=True) or {}
        nombre = (data.get('nombre') or '').strip()
        tiempo_minutos = float(data.get('tiempo_minutos') or 0)

        if not nombre:
            return _error('El nombre de la promoción es requerido', status_code=400)
        promocion = Promocion(nombre=nombre, tiempo_minutos=tiempo_minutos)
        db.session.add(promocion)
        db.session.commit()

        return _success(_serializar_promocion(promocion), status_code=201)
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


@promociones_bp.route('/admin/promociones/<int:promocion_id>', methods=['PUT'])
@_require_admin
def actualizar_promocion(promocion_id):
    # Permite editar nombre, categoría y tiempo sin perder el registro existente.
    try:
        promocion = Promocion.query.get(promocion_id)
        if not promocion:
            return _error('Promoción no encontrada', status_code=404)

        data = request.get_json(silent=True) or {}

        if 'nombre' in data:
            nuevo_nombre = (data.get('nombre') or '').strip()
            if nuevo_nombre:
                promocion.nombre = nuevo_nombre
        if 'tiempo_minutos' in data:
            promocion.tiempo_minutos = float(data.get('tiempo_minutos') or 0)

        db.session.commit()
        return _success(_serializar_promocion(promocion))
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


@promociones_bp.route('/admin/promociones/<int:promocion_id>', methods=['DELETE'])
@_require_admin
def eliminar_promocion(promocion_id):
    # Borra la promoción solo desde administración autenticada.
    try:
        promocion = Promocion.query.get(promocion_id)
        if not promocion:
            return _error('Promoción no encontrada', status_code=404)

        db.session.delete(promocion)
        db.session.commit()
        return _success(message='Promoción eliminada')
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


# Rutas alternativas para compatibilidad con frontend (nombres de endpoints usados originalmente)
@promociones_bp.route('/admin/tipos-promocion', methods=['GET'])
@_require_admin
def listar_tipos_promocion():
    try:
        promociones = Promocion.query.order_by(Promocion.nombre).all()
        return _success({'data': [_serializar_promocion(promocion) for promocion in promociones]})
    except Exception as exc:
        return _error(str(exc), status_code=500)


@promociones_bp.route('/admin/tipos-promocion', methods=['POST'])
@_require_admin
def crear_tipo_promocion():
    try:
        data = request.get_json(silent=True) or {}
        nombre = (data.get('nombre') or '').strip()
        tiempo_minutos = float(data.get('tiempo_minutos') or 0)

        if not nombre:
            return _error('El nombre de la promoción es requerido', status_code=400)
        promocion = Promocion(nombre=nombre, tiempo_minutos=tiempo_minutos)
        db.session.add(promocion)
        db.session.commit()

        return _success(_serializar_promocion(promocion), status_code=201)
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


@promociones_bp.route('/admin/tipos-promocion/<int:promocion_id>', methods=['PUT'])
@_require_admin
def actualizar_tipo_promocion(promocion_id):
    try:
        promocion = Promocion.query.get(promocion_id)
        if not promocion:
            return _error('Promoción no encontrada', status_code=404)

        data = request.get_json(silent=True) or {}

        if 'nombre' in data:
            nuevo_nombre = (data.get('nombre') or '').strip()
            if nuevo_nombre:
                promocion.nombre = nuevo_nombre
        if 'tiempo_minutos' in data:
            promocion.tiempo_minutos = float(data.get('tiempo_minutos') or 0)

        db.session.commit()
        return _success(_serializar_promocion(promocion))
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


@promociones_bp.route('/admin/tipos-promocion/<int:promocion_id>', methods=['DELETE'])
@_require_admin
def eliminar_tipo_promocion(promocion_id):
    try:
        promocion = Promocion.query.get(promocion_id)
        if not promocion:
            return _error('Promoción no encontrada', status_code=404)

        db.session.delete(promocion)
        db.session.commit()
        return _success(message='Promoción eliminada')
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)
