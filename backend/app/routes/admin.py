from ..models import TipoPromocion
from ..utils import _serializar_tipo_promocion
import json
import os
from datetime import datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import String, cast, or_

from ..auth import (
    _borrar_admin_configuracion,
    _crear_sesion_admin,
    _formatear_minutos_restantes,
    _guardar_admin_password,
    _guardar_admin_recovery_password,
    _obtener_admin_lock_until,
    _registrar_fallo_login_admin,
    _require_admin,
    _reiniciar_admin_login_failures,
    _verificar_password_admin,
    _verificar_password_recuperacion,
)
from ..auth import _obtener_admin_configuracion, _guardar_admin_configuracion
from ..extensions import db
from ..models import Promocion, Reporte, SesionPaquete, SesionUsuarioPaquete, Usuario
from ..utils import _load_json, _serializar_promocion

admin_bp = Blueprint('admin', __name__, url_prefix='/api')


def _success(payload=None, status_code=200, **kwargs):
    data = {'status': 'ok', **(payload or {})}
    data.update(kwargs)
    return jsonify(data), status_code


def _error(message, status_code=400, **kwargs):
    data = {'status': 'error', 'message': message, **kwargs}
    return jsonify(data), status_code


@admin_bp.route('/admin/login', methods=['POST'])
def admin_login():
    # Este endpoint controla el acceso al panel y aplica bloqueo por intentos fallidos.
    data = request.get_json(silent=True) or {}
    password = str(data.get('password') or '').strip()

    bloqueado_hasta = _obtener_admin_lock_until()
    if bloqueado_hasta and datetime.utcnow() < bloqueado_hasta:
        return _success({
            'status': 'locked',
            'message': f"Demasiados intentos fallidos. Intenta de nuevo en {_formatear_minutos_restantes(bloqueado_hasta)} minuto(s).",
            'lock_until': bloqueado_hasta.isoformat() + 'Z'
        }, status_code=423)

    if bloqueado_hasta and datetime.utcnow() >= bloqueado_hasta:
        _borrar_admin_configuracion('admin_login_lock_until')
        _borrar_admin_configuracion('admin_login_failures')

    if not _verificar_password_admin(password):
        resultado_fallo = _registrar_fallo_login_admin()
        if resultado_fallo['locked']:
            return _success({
                'status': 'locked',
                'message': f"Demasiados intentos fallidos. Intenta de nuevo en {_formatear_minutos_restantes(resultado_fallo['lock_until'])} minuto(s).",
                'lock_until': resultado_fallo['lock_until'].isoformat() + 'Z'
            }, status_code=423)
        return _error('Credenciales inválidas', status_code=401)

    _reiniciar_admin_login_failures()
    token, expira = _crear_sesion_admin()
    return _success({'token': token, 'expires_at': expira.isoformat() + 'Z'})


@admin_bp.route('/admin/logout', methods=['POST'])
def admin_logout():
    token = request.headers.get('X-Admin-Token')
    if token:
        from ..auth import _admin_sessions
        _admin_sessions.pop(token, None)
    return _success({})


@admin_bp.route('/admin/password', methods=['POST'])
@_require_admin
def admin_cambiar_password():
    # Cambia la contraseña principal sin tocar la de recuperación.
    data = request.get_json(silent=True) or {}
    password_actual = str(data.get('current_password') or '').strip()
    password_nueva = str(data.get('new_password') or '').strip()
    confirmacion = str(data.get('confirm_password') or '').strip()

    if not _verificar_password_admin(password_actual):
        return _error('La contraseña actual no es correcta', status_code=400)
    if not password_nueva:
        return _error('La nueva contraseña es obligatoria', status_code=400)
    if len(password_nueva) < 4:
        return _error('La nueva contraseña debe tener al menos 4 caracteres', status_code=400)
    if password_nueva != confirmacion:
        return _error('La confirmación no coincide', status_code=400)
    if _verificar_password_recuperacion(password_nueva):
        return _error('La contraseña de administrador debe ser diferente a la de restablecimiento', status_code=400)

    _guardar_admin_password(password_nueva)
    os.environ['ADMIN_PASSWORD'] = password_nueva
    return _success(message='Contraseña actualizada correctamente')


@admin_bp.route('/admin/password/reset', methods=['POST'])
def admin_restablecer_password():
    # Recuperación de acceso: usa la clave secundaria y luego reemplaza la contraseña principal.
    data = request.get_json(silent=True) or {}
    password_recuperacion = str(data.get('recovery_password') or '').strip()
    password_nueva = str(data.get('new_password') or '').strip()
    confirmacion = str(data.get('confirm_password') or '').strip()

    if not password_recuperacion:
        return _error('Ingresa la contraseña de restablecimiento', status_code=400)
    if not _verificar_password_recuperacion(password_recuperacion):
        return _error('La contraseña de restablecimiento no es correcta', status_code=400)
    if not password_nueva:
        return _error('La nueva contraseña es obligatoria', status_code=400)
    if len(password_nueva) < 4:
        return _error('La nueva contraseña debe tener al menos 4 caracteres', status_code=400)
    if password_nueva != confirmacion:
        return _error('La confirmación no coincide', status_code=400)
    if password_nueva == password_recuperacion:
        return _error('La nueva contraseña debe ser diferente a la de restablecimiento', status_code=400)

    _guardar_admin_password(password_nueva)
    os.environ['ADMIN_PASSWORD'] = password_nueva
    return _success(message='Contraseña de administrador restablecida correctamente')


@admin_bp.route('/admin/recovery-password', methods=['POST'])
@_require_admin
def admin_cambiar_contrasena_recuperacion():
    # Solo un admin autenticado puede rotar la contraseña de restablecimiento.
    data = request.get_json(silent=True) or {}
    password_actual_admin = str(data.get('current_admin_password') or '').strip()
    password_nueva = str(data.get('new_recovery_password') or '').strip()
    confirmacion = str(data.get('confirm_recovery_password') or '').strip()

    if not _verificar_password_admin(password_actual_admin):
        return _error('La contraseña actual de administrador no es correcta', status_code=400)
    if not password_nueva:
        return _error('La nueva contraseña de restablecimiento es obligatoria', status_code=400)
    if len(password_nueva) < 4:
        return _error('La nueva contraseña de restablecimiento debe tener al menos 4 caracteres', status_code=400)
    if password_nueva != confirmacion:
        return _error('La confirmación no coincide', status_code=400)
    if _verificar_password_admin(password_nueva):
        return _error('La contraseña de restablecimiento debe ser diferente a la del administrador', status_code=400)

    _guardar_admin_recovery_password(password_nueva)
    os.environ['ADMIN_RECOVERY_PASSWORD'] = password_nueva
    return _success(message='Contraseña de restablecimiento actualizada correctamente')


@admin_bp.route('/data', methods=['GET'])
def get_data():
    usuarios = Usuario.query.all()
    promos = Promocion.query.all()
    tipos = []
    try:
        tipos_query = TipoPromocion.query.order_by(TipoPromocion.nombre).all()
        tipos = [{
            'id': t.id,
            'nombre': t.nombre,
            'tiempo_minutos': float(t.tiempo_minutos or 0),
            'created_at': t.created_at.isoformat() + 'Z' if t.created_at else None,
            'updated_at': t.updated_at.isoformat() + 'Z' if t.updated_at else None,
        } for t in tipos_query]
    except Exception:
        tipos = []
    res_u = []
    for usuario in usuarios:
        res_u.append({
            'id': usuario.id,
            'nombre': usuario.nombre,
            'config_tiempos': _load_json(usuario.config_tiempos, {})
        })
    promos_payload = [_serializar_promocion(promocion) for promocion in promos]
    nombre_tipo_general = _obtener_admin_configuracion('nombre_tipo_paquete_general', 'Promociones planas')
    return _success({'usuarios': res_u, 'promos': promos_payload, 'tipos': tipos, 'nombre_tipo_paquete_general': nombre_tipo_general})



@admin_bp.route('/admin/configuracion', methods=['GET'])
@_require_admin
def obtener_configuracion():
    key = request.args.get('key')
    if not key:
        return _error('La clave es requerida', status_code=400)
    try:
        value = _obtener_admin_configuracion(key, '')
        return _success({'key': key, 'value': value})
    except Exception as exc:
        return _error(str(exc), status_code=500)


@admin_bp.route('/admin/configuracion', methods=['POST'])
@_require_admin
def guardar_configuracion():
    try:
        data = request.get_json(silent=True) or {}
        key = (data.get('key') or '').strip()
        value = data.get('value')
        if not key:
            return _error('La clave es requerida', status_code=400)
        _guardar_admin_configuracion(key, value or '')
        return _success({'key': key, 'value': str(value or '')})
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)

@admin_bp.route('/admin/tipos-promocion', methods=['GET'])
@_require_admin
def listar_tipos_promocion():
    try:
        tipos = TipoPromocion.query.order_by(TipoPromocion.nombre).all()
        payload = [{
            'id': t.id,
            'nombre': t.nombre,
            'tiempo_minutos': float(t.tiempo_minutos or 0),
            'created_at': t.created_at.isoformat() + 'Z' if t.created_at else None,
            'updated_at': t.updated_at.isoformat() + 'Z' if t.updated_at else None,
        } for t in tipos]
        return _success({'data': payload})
    except Exception as exc:
        return _error(str(exc), status_code=500)

@admin_bp.route('/admin/tipos-promocion', methods=['POST'])
@_require_admin
def crear_tipo_promocion():
    try:
        data = request.get_json(silent=True) or {}
        nombre = (data.get('nombre') or '').strip()
        tiempo_minutos = float(data.get('tiempo_minutos') or 0)
        if not nombre:
            return _error('El nombre del tipo es requerido', status_code=400)
        existente = TipoPromocion.query.filter_by(nombre=nombre).first()
        if existente:
            return _error('El tipo ya existe', status_code=400)
        tipo = TipoPromocion(nombre=nombre, tiempo_minutos=tiempo_minutos)
        db.session.add(tipo)
        db.session.commit()
        return _success({'id': tipo.id, 'nombre': tipo.nombre, 'tiempo_minutos': tipo.tiempo_minutos}, status_code=201)
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)

@admin_bp.route('/admin/tipos-promocion/<int:tipo_id>', methods=['PUT'])
@_require_admin
def actualizar_tipo_promocion(tipo_id):
    try:
        tipo = TipoPromocion.query.get(tipo_id)
        if not tipo:
            return _error('Tipo no encontrado', status_code=404)
        data = request.get_json(silent=True) or {}
        if 'nombre' in data:
            nuevo_nombre = (data.get('nombre') or '').strip()
            if nuevo_nombre and nuevo_nombre != tipo.nombre:
                existente = TipoPromocion.query.filter_by(nombre=nuevo_nombre).first()
                if existente:
                    return _error('El nombre ya existe', status_code=400)
                tipo.nombre = nuevo_nombre
        if 'tiempo_minutos' in data:
            tipo.tiempo_minutos = float(data.get('tiempo_minutos') or 0)
        db.session.commit()
        return _success({'id': tipo.id, 'nombre': tipo.nombre, 'tiempo_minutos': tipo.tiempo_minutos})
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)

@admin_bp.route('/admin/tipos-promocion/<int:tipo_id>', methods=['DELETE'])
@_require_admin
def eliminar_tipo_promocion(tipo_id):
    try:
        tipo = TipoPromocion.query.get(tipo_id)
        if not tipo:
            return _error('Tipo no encontrado', status_code=404)
        db.session.delete(tipo)
        db.session.commit()
        return _success({'id': tipo_id}, message='Tipo eliminado')
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


@admin_bp.route('/usuarios', methods=['POST'])
@_require_admin
def crear_usuario():
    data = request.get_json(silent=True) or {}
    nombre = str(data.get('nombre') or '').strip()
    if not nombre:
        return _error('El nombre del usuario es obligatorio', status_code=400)
    nuevo = Usuario(nombre=nombre, config_tiempos='{}')
    db.session.add(nuevo)
    db.session.commit()
    return _success({
        'id': nuevo.id,
        'nombre': nuevo.nombre,
        'config_tiempos': {}
    })



@admin_bp.route('/usuarios/<int:usuario_id>', methods=['PUT'])
@_require_admin
def actualizar_usuario(usuario_id):
    usuario = Usuario.query.get(usuario_id)
    if not usuario:
        return _error('Usuario no encontrado', status_code=404)

    data = request.get_json(silent=True) or {}
    if 'nombre' in data:
        usuario.nombre = str(data['nombre']).strip() or usuario.nombre

    db.session.commit()
    return _success({
        'usuario': {
            'id': usuario.id,
            'nombre': usuario.nombre,
            'config_tiempos': _load_json(usuario.config_tiempos, {})
        }
    })


@admin_bp.route('/usuarios/<int:usuario_id>', methods=['DELETE'])
@_require_admin
def eliminar_usuario(usuario_id):
    usuario = Usuario.query.get(usuario_id)
    if not usuario:
        return _error('Usuario no encontrado', status_code=404)

    usuario_id_str = str(usuario_id)
    try:
        reportes_eliminados = Reporte.query.filter(
            or_(Reporte.analista_id == usuario_id, cast(Reporte.analista_id, String) == usuario_id_str)
        ).delete(synchronize_session=False)

        sesiones_usuario_eliminadas = SesionUsuarioPaquete.query.filter(
            or_(SesionUsuarioPaquete.usuario_id == usuario_id, cast(SesionUsuarioPaquete.usuario_id, String) == usuario_id_str)
        ).delete(synchronize_session=False)

        db.session.delete(usuario)
        db.session.commit()
        return _success({
            'usuario_eliminado_id': usuario_id,
            'reportes_eliminados': reportes_eliminados,
            'sesiones_eliminadas': sesiones_usuario_eliminadas
        })
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)


@admin_bp.route('/configurar-tiempo', methods=['POST'])
@_require_admin
def configurar_tiempos():
    data = request.get_json(silent=True) or {}
    usuario = Usuario.query.get(data.get('usuario_id'))
    if not usuario:
        return _error('Usuario no encontrado', status_code=404)

    matriz = _load_json(usuario.config_tiempos, {})
    matriz[str(data.get('promocion_id'))] = data.get('minutos')
    usuario.config_tiempos = json.dumps(matriz)
    db.session.commit()
    return _success({})


@admin_bp.route('/admin/limpiar-db', methods=['POST'])
@_require_admin
def limpiar_db():
    try:
        reportes_eliminados = db.session.query(Reporte).delete()
        sesiones_paquete_eliminadas = db.session.query(SesionPaquete).delete()
        sesiones_usuario_eliminadas = db.session.query(SesionUsuarioPaquete).delete()
        db.session.commit()
        return _success({
            'reportes_eliminados': reportes_eliminados,
            'sesiones_paquete_eliminadas': sesiones_paquete_eliminadas,
            'sesiones_usuario_eliminadas': sesiones_usuario_eliminadas
        })
    except Exception as exc:
        db.session.rollback()
        return _error(str(exc), status_code=500)

