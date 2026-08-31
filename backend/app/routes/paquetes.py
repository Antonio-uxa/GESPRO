import json
from datetime import datetime

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import PaqueteAnalista, Reporte, SesionPaquete, SesionUsuarioPaquete
from ..utils import _cerrar_sesion_usuario, _load_json, _obtener_alias_paquete, _serializar_sesion, _serializar_sesion_usuario

paquetes_bp = Blueprint('paquetes', __name__, url_prefix='/api')


def _success(payload=None, status_code=200, **kwargs):
    data = {'status': 'ok', **(payload or {})}
    data.update(kwargs)
    return jsonify(data), status_code


def _error(message, status_code=400, **kwargs):
    data = {'status': 'error', 'message': message, **kwargs}
    return jsonify(data), status_code


@paquetes_bp.route('/paquetes-analista', methods=['GET'])
def obtener_paquetes_analista():
    paquetes = PaqueteAnalista.query.all()
    resultado = []
    for paquete in paquetes:
        resultado.append({
            'nombre': paquete.nombre,
            'tipo_paquete': paquete.tipo_paquete,
            'configuracion': _load_json(paquete.configuracion, {}),
            'created_at': paquete.created_at.isoformat() + 'Z' if paquete.created_at else None,
            'updated_at': paquete.updated_at.isoformat() + 'Z' if paquete.updated_at else None,
        })
    return _success({'paquetes': resultado})


@paquetes_bp.route('/paquetes-analista', methods=['POST'])
def guardar_paquete_analista():
    # Guarda el estado de trabajo del analista y resuelve conflictos por cambios concurrentes.
    data = request.get_json(silent=True) or {}
    nombre = (data.get('nombre') or '').strip()
    tipo_paquete = (data.get('tipo_paquete') or 'GENERAL').upper()
    if tipo_paquete not in ['GENERAL']:
        tipo_paquete = 'GENERAL'
    configuracion = data.get('configuracion', {})
    expected_updated_at = (data.get('expected_updated_at') or '').strip()

    if not nombre:
        return _error('El nombre del paquete es obligatorio', status_code=400)

    paquete_existente = PaqueteAnalista.query.filter_by(nombre=nombre).first()
    if paquete_existente:
        actual_updated_at = paquete_existente.updated_at.isoformat() + 'Z' if paquete_existente.updated_at else ''
        if expected_updated_at and actual_updated_at and expected_updated_at != actual_updated_at:
            return _success({
                'status': 'conflict',
                'message': 'Otro usuario guardó cambios en este paquete. Se cargó la versión más reciente.',
                'paquete': {
                    'nombre': paquete_existente.nombre,
                    'tipo_paquete': paquete_existente.tipo_paquete,
                    'configuracion': _load_json(paquete_existente.configuracion, {}),
                    'created_at': paquete_existente.created_at.isoformat() + 'Z' if paquete_existente.created_at else None,
                    'updated_at': paquete_existente.updated_at.isoformat() + 'Z' if paquete_existente.updated_at else None,
                }
            }, status_code=409)
        paquete_existente.tipo_paquete = tipo_paquete
        paquete_existente.configuracion = json.dumps(configuracion)
        paquete_existente.updated_at = datetime.utcnow()
    else:
        paquete_nuevo = PaqueteAnalista(
            nombre=nombre,
            tipo_paquete=tipo_paquete,
            configuracion=json.dumps(configuracion)
        )
        db.session.add(paquete_nuevo)

    db.session.commit()
    paquete_guardado = PaqueteAnalista.query.filter_by(nombre=nombre).first()
    return _success({
        'nombre': nombre,
        'updated_at': paquete_guardado.updated_at.isoformat() + 'Z' if paquete_guardado and paquete_guardado.updated_at else None,
        'paquete': {
            'nombre': paquete_guardado.nombre,
            'tipo_paquete': paquete_guardado.tipo_paquete,
            'configuracion': _load_json(paquete_guardado.configuracion, {}),
            'created_at': paquete_guardado.created_at.isoformat() + 'Z' if paquete_guardado.created_at else None,
            'updated_at': paquete_guardado.updated_at.isoformat() + 'Z' if paquete_guardado.updated_at else None,
        }
    })


@paquetes_bp.route('/paquetes-analista/<string:nombre>', methods=['PATCH'])
def actualizar_paquete_analista(nombre):
    # Renombrar un paquete también actualiza reportes y sesiones asociadas para no romper historial.
    nombre_original = (nombre or '').strip()
    data = request.get_json(silent=True) or {}
    nuevo_nombre = (data.get('nombre') or nombre_original).strip()
    tipo_paquete = (data.get('tipo_paquete') or 'GENERAL').upper()
    if tipo_paquete not in ['GENERAL']:
        tipo_paquete = 'GENERAL'
    configuracion = data.get('configuracion', {})
    expected_updated_at = (data.get('expected_updated_at') or '').strip()

    if not nombre_original:
        return _error('Nombre de paquete inválido', status_code=400)
    if not nuevo_nombre:
        return _error('El nombre del paquete es obligatorio', status_code=400)

    paquete_existente = PaqueteAnalista.query.filter_by(nombre=nombre_original).first()
    if not paquete_existente:
        return _error('Paquete no encontrado', status_code=404)

    if nuevo_nombre != nombre_original:
        conflicto = PaqueteAnalista.query.filter_by(nombre=nuevo_nombre).first()
        if conflicto:
            return _error('Ya existe un paquete con ese nombre', status_code=409)

    actual_updated_at = paquete_existente.updated_at.isoformat() + 'Z' if paquete_existente.updated_at else ''
    if expected_updated_at and actual_updated_at and expected_updated_at != actual_updated_at:
        return _success({
            'status': 'conflict',
            'message': 'Otro usuario modificó este paquete. Se cargó la versión más reciente.',
            'paquete': {
                'nombre': paquete_existente.nombre,
                'tipo_paquete': paquete_existente.tipo_paquete,
                'configuracion': _load_json(paquete_existente.configuracion, {}),
                'created_at': paquete_existente.created_at.isoformat() + 'Z' if paquete_existente.created_at else None,
                'updated_at': paquete_existente.updated_at.isoformat() + 'Z' if paquete_existente.updated_at else None,
            }
        }, status_code=409)

    try:
        reportes_actualizados = Reporte.query.filter(Reporte.nombre_paquete == nombre_original).update({Reporte.nombre_paquete: nuevo_nombre}, synchronize_session=False)
        sesiones_paquete_actualizadas = SesionPaquete.query.filter(SesionPaquete.paquete_nombre == nombre_original).update({SesionPaquete.paquete_nombre: nuevo_nombre}, synchronize_session=False)
        sesiones_usuario_actualizadas = SesionUsuarioPaquete.query.filter(SesionUsuarioPaquete.paquete_nombre == nombre_original).update({SesionUsuarioPaquete.paquete_nombre: nuevo_nombre}, synchronize_session=False)

        paquete_existente.nombre = nuevo_nombre
        paquete_existente.tipo_paquete = tipo_paquete
        paquete_existente.configuracion = json.dumps(configuracion)
        paquete_existente.updated_at = datetime.utcnow()

        db.session.commit()
        return _success({
            'nombre': nuevo_nombre,
            'nombre_anterior': nombre_original,
            'updated_at': paquete_existente.updated_at.isoformat() + 'Z' if paquete_existente.updated_at else None,
            'paquete': {
                'nombre': paquete_existente.nombre,
                'tipo_paquete': paquete_existente.tipo_paquete,
                'configuracion': _load_json(paquete_existente.configuracion, {}),
                'created_at': paquete_existente.created_at.isoformat() + 'Z' if paquete_existente.created_at else None,
                'updated_at': paquete_existente.updated_at.isoformat() + 'Z' if paquete_existente.updated_at else None,
            },
            'reportes_actualizados': reportes_actualizados,
            'sesiones_paquete_actualizadas': sesiones_paquete_actualizadas,
            'sesiones_usuario_actualizadas': sesiones_usuario_actualizadas
        })
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


@paquetes_bp.route('/paquetes-analista/<string:nombre>', methods=['DELETE'])
def eliminar_paquete_analista(nombre):
    nombre = (nombre or '').strip()
    if not nombre:
        return _error('Nombre de paquete inválido', status_code=400)

    paquete = PaqueteAnalista.query.filter_by(nombre=nombre).first()
    if not paquete:
        return _error('Paquete no encontrado', status_code=404)

    db.session.delete(paquete)
    db.session.commit()
    return _success({'nombre': nombre})


@paquetes_bp.route('/paquetes/<string:nombre_paquete>', methods=['DELETE'])
def eliminar_paquete(nombre_paquete):
    nombre = (nombre_paquete or '').strip()
    if not nombre:
        return _error('Nombre de paquete inválido', status_code=400)

    alias_paquete = _obtener_alias_paquete(nombre) or [nombre]

    try:
        reportes_eliminados = Reporte.query.filter(Reporte.nombre_paquete.in_(alias_paquete)).delete(synchronize_session=False)
        sesiones_paquete_eliminadas = SesionPaquete.query.filter(SesionPaquete.paquete_nombre.in_(alias_paquete)).delete(synchronize_session=False)
        sesiones_usuario_eliminadas = SesionUsuarioPaquete.query.filter(SesionUsuarioPaquete.paquete_nombre.in_(alias_paquete)).delete(synchronize_session=False)
        paquetes_eliminados = PaqueteAnalista.query.filter(PaqueteAnalista.nombre.in_(alias_paquete)).delete(synchronize_session=False)

        db.session.commit()
        return _success({
            'nombre_paquete': nombre,
            'alias_eliminados': alias_paquete,
            'reportes_eliminados': reportes_eliminados,
            'sesiones_paquete_eliminadas': sesiones_paquete_eliminadas,
            'sesiones_usuario_eliminadas': sesiones_usuario_eliminadas,
            'paquetes_eliminados': paquetes_eliminados
        })
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


@paquetes_bp.route('/sesiones-paquete', methods=['GET'])
def estado_sesion_paquete():
    nombre = (request.args.get('nombre') or '').strip()
    modo = (request.args.get('modo') or 'GENERAL').upper()
    if not nombre:
        return _error('Falta el nombre del paquete', status_code=400)

    activas = SesionPaquete.query.filter_by(paquete_nombre=nombre, modo=modo, activo=True).order_by(SesionPaquete.id.desc()).first()
    ultima = SesionPaquete.query.filter_by(paquete_nombre=nombre, modo=modo).order_by(SesionPaquete.id.desc()).first()
    return _success({
        'activa': _serializar_sesion(activas),
        'ultima': _serializar_sesion(ultima)
    })


@paquetes_bp.route('/paquetes/iniciar', methods=['POST'])
def iniciar_sesion_paquete():
    # Abre una sesión activa por paquete y modo; si ya existe, la reutiliza.
    data = request.get_json(silent=True) or {}
    nombre = (data.get('paquete_nombre') or '').strip()
    modo = (data.get('modo') or 'GENERAL').upper()

    if not nombre:
        return _error('Falta el nombre del paquete', status_code=400)

    sesion_activa = SesionPaquete.query.filter_by(paquete_nombre=nombre, modo=modo, activo=True).order_by(SesionPaquete.id.desc()).first()
    if sesion_activa:
        return _success({'sesion': _serializar_sesion(sesion_activa), 'reutilizada': True})

    nueva = SesionPaquete(paquete_nombre=nombre, modo=modo, started_at=datetime.utcnow(), activo=True)
    db.session.add(nueva)
    db.session.commit()
    return _success({'sesion': _serializar_sesion(nueva), 'reutilizada': False})


@paquetes_bp.route('/paquetes/finalizar', methods=['POST'])
def finalizar_sesion_paquete():
    # Cierra la sesión activa y deja calculado el tiempo total consumido.
    data = request.get_json(silent=True) or {}
    nombre = (data.get('paquete_nombre') or '').strip()
    modo = (data.get('modo') or 'GENERAL').upper()

    if not nombre:
        return _error('Falta el nombre del paquete', status_code=400)

    sesion_activa = SesionPaquete.query.filter_by(paquete_nombre=nombre, modo=modo, activo=True).order_by(SesionPaquete.id.desc()).first()
    if not sesion_activa:
        return _error('No hay sesión activa para este paquete', status_code=404)

    ahora = datetime.utcnow()
    sesion_activa.ended_at = ahora
    sesion_activa.activo = False
    sesion_activa.elapsed_seconds = max(0, int((ahora - sesion_activa.started_at).total_seconds()))
    db.session.commit()
    return _success({'sesion': _serializar_sesion(sesion_activa)})


@paquetes_bp.route('/sesiones-usuario-paquete', methods=['GET'])
def estado_sesion_usuario_paquete():
    nombre = (request.args.get('paquete') or '').strip()
    modo = (request.args.get('modo') or 'GENERAL').upper()
    if not nombre:
        return _error('Falta el nombre del paquete', status_code=400)

    sesiones = SesionUsuarioPaquete.query.filter_by(paquete_nombre=nombre, modo=modo).order_by(SesionUsuarioPaquete.id.desc()).all()
    return _success({'sesiones': [_serializar_sesion_usuario(sesion) for sesion in sesiones]})


@paquetes_bp.route('/sesiones-usuario-paquete/iniciar', methods=['POST'])
def iniciar_sesion_usuario_paquete():
    data = request.get_json(silent=True) or {}
    nombre = (data.get('paquete_nombre') or '').strip()
    modo = (data.get('modo') or 'GENERAL').upper()
    usuario_id = data.get('usuario_id')

    if not nombre:
        return _error('Falta el nombre del paquete', status_code=400)
    if not usuario_id:
        return _error('Falta el usuario', status_code=400)

    sesion_finalizada = SesionUsuarioPaquete.query.filter_by(
        paquete_nombre=nombre,
        usuario_id=usuario_id,
        modo=modo,
        finalizado=True
    ).order_by(SesionUsuarioPaquete.id.desc()).first()
    if sesion_finalizada:
        return _error('Este usuario ya finalizó el paquete y no puede reiniciar.', status_code=409)

    sesion_activa = SesionUsuarioPaquete.query.filter_by(
        paquete_nombre=nombre,
        usuario_id=usuario_id,
        modo=modo,
        activo=True
    ).order_by(SesionUsuarioPaquete.id.desc()).first()
    if sesion_activa:
        return _success({'sesion': _serializar_sesion_usuario(sesion_activa), 'reutilizada': True})

    nueva = SesionUsuarioPaquete(
        usuario_id=usuario_id,
        paquete_nombre=nombre,
        modo=modo,
        started_at=datetime.utcnow(),
        activo=True
    )
    db.session.add(nueva)
    db.session.commit()
    return _success({'sesion': _serializar_sesion_usuario(nueva), 'reutilizada': False})


@paquetes_bp.route('/sesiones-usuario-paquete/finalizar', methods=['POST'])
def finalizar_sesion_usuario_paquete():
    data = request.get_json(silent=True) or {}
    nombre = (data.get('paquete_nombre') or '').strip()
    modo = (data.get('modo') or 'GENERAL').upper()
    usuario_id = data.get('usuario_id')

    if not nombre:
        return _error('Falta el nombre del paquete', status_code=400)
    if not usuario_id:
        return _error('Falta el usuario', status_code=400)

    sesion_activa = SesionUsuarioPaquete.query.filter_by(
        paquete_nombre=nombre,
        usuario_id=usuario_id,
        modo=modo,
        activo=True
    ).order_by(SesionUsuarioPaquete.id.desc()).first()
    if not sesion_activa:
        return _error('No hay sesión activa para este usuario', status_code=404)

    _cerrar_sesion_usuario(sesion_activa, finalizado=True)
    db.session.commit()
    return _success({'sesion': _serializar_sesion_usuario(sesion_activa), 'accion': 'finalizada'})


@paquetes_bp.route('/sesiones-usuario-paquete/pausar', methods=['POST'])
def pausar_sesion_usuario_paquete():
    data = request.get_json(silent=True) or {}
    nombre = (data.get('paquete_nombre') or '').strip()
    modo = (data.get('modo') or 'GENERAL').upper()
    usuario_id = data.get('usuario_id')

    if not nombre:
        return _error('Falta el nombre del paquete', status_code=400)
    if not usuario_id:
        return _error('Falta el usuario', status_code=400)

    sesion_activa = SesionUsuarioPaquete.query.filter_by(
        paquete_nombre=nombre,
        usuario_id=usuario_id,
        modo=modo,
        activo=True
    ).order_by(SesionUsuarioPaquete.id.desc()).first()
    if not sesion_activa:
        return _error('No hay sesión activa para este usuario', status_code=404)

    _cerrar_sesion_usuario(sesion_activa, finalizado=False)
    db.session.commit()
    return _success({'sesion': _serializar_sesion_usuario(sesion_activa), 'accion': 'pausada'})
