import os
import secrets
from datetime import datetime, timedelta
from functools import wraps

from flask import jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db
from .models import AdminConfiguracion


ADMIN_SESSION_MINUTES = int(os.getenv('ADMIN_SESSION_MINUTES', '120'))
ADMIN_LOGIN_MAX_ATTEMPTS = int(os.getenv('ADMIN_LOGIN_MAX_ATTEMPTS', '5'))
ADMIN_LOGIN_LOCK_MINUTES = int(os.getenv('ADMIN_LOGIN_LOCK_MINUTES', '0'))
_admin_sessions = {}


def _crear_sesion_admin():
    # La sesión de admin vive en memoria y expira por tiempo, no por cookies.
    token = secrets.token_urlsafe(32)
    expira = datetime.utcnow() + timedelta(minutes=ADMIN_SESSION_MINUTES)
    _admin_sessions[token] = expira
    return token, expira


def _token_admin_valido(token):
    if not token:
        return False
    expira = _admin_sessions.get(token)
    if not expira:
        return False
    if datetime.utcnow() > expira:
        _admin_sessions.pop(token, None)
        return False
    return True


def _require_admin(fn):
    @wraps(fn)
    def _inner(*args, **kwargs):
        token = request.headers.get('X-Admin-Token')
        if not _token_admin_valido(token):
            return jsonify({"status": "error", "message": "No autorizado"}), 401
        return fn(*args, **kwargs)

    return _inner


def _obtener_admin_password_hash():
    # Fuente de verdad de la contraseña de admin: configuración persistida en BD.
    configuracion_hash = AdminConfiguracion.query.filter_by(clave='admin_password_hash').first()
    if configuracion_hash and str(configuracion_hash.valor or '').strip():
        return str(configuracion_hash.valor).strip()

    configuracion_legacy = AdminConfiguracion.query.filter_by(clave='admin_password').first()
    if configuracion_legacy and str(configuracion_legacy.valor or '').strip():
        password_legacy = str(configuracion_legacy.valor).strip()
        password_hash = generate_password_hash(password_legacy)
        db.session.add(AdminConfiguracion(clave='admin_password_hash', valor=password_hash))
        db.session.delete(configuracion_legacy)
        db.session.commit()
        return password_hash

    password_defecto = os.getenv('ADMIN_PASSWORD', 'admin123')
    return generate_password_hash(password_defecto)


def _verificar_password_admin(password_ingresado):
    return check_password_hash(_obtener_admin_password_hash(), password_ingresado or '')


def _guardar_admin_password(nuevo_password):
    password_hash = generate_password_hash(nuevo_password)
    configuracion = AdminConfiguracion.query.filter_by(clave='admin_password_hash').first()
    if configuracion:
        configuracion.valor = password_hash
    else:
        db.session.add(AdminConfiguracion(clave='admin_password_hash', valor=password_hash))
    db.session.commit()


def _obtener_admin_recovery_password_hash():
    # La contraseña de restablecimiento es una credencial separada de la del admin.
    configuracion_hash = AdminConfiguracion.query.filter_by(clave='admin_recovery_password_hash').first()
    if configuracion_hash and str(configuracion_hash.valor or '').strip():
        return str(configuracion_hash.valor).strip()

    configuracion_legacy = AdminConfiguracion.query.filter_by(clave='admin_recovery_password').first()
    if configuracion_legacy and str(configuracion_legacy.valor or '').strip():
        password_legacy = str(configuracion_legacy.valor).strip()
        password_hash = generate_password_hash(password_legacy)
        db.session.add(AdminConfiguracion(clave='admin_recovery_password_hash', valor=password_hash))
        db.session.delete(configuracion_legacy)
        db.session.commit()
        return password_hash

    admin_password = _obtener_admin_password_hash()
    password_defecto = os.getenv('ADMIN_RECOVERY_PASSWORD', 'reset1234')
    if check_password_hash(admin_password, password_defecto):
        password_defecto = f'{password_defecto}-recuperacion'
    return generate_password_hash(password_defecto)


def _verificar_password_recuperacion(password_ingresado):
    return check_password_hash(_obtener_admin_recovery_password_hash(), password_ingresado or '')


def _guardar_admin_recovery_password(nuevo_password):
    password_hash = generate_password_hash(nuevo_password)
    configuracion = AdminConfiguracion.query.filter_by(clave='admin_recovery_password_hash').first()
    if configuracion:
        configuracion.valor = password_hash
    else:
        db.session.add(AdminConfiguracion(clave='admin_recovery_password_hash', valor=password_hash))
    db.session.commit()


def _obtener_admin_configuracion(clave, por_defecto=''):
    configuracion = AdminConfiguracion.query.filter_by(clave=clave).first()
    if configuracion is None:
        return por_defecto
    return str(configuracion.valor or por_defecto).strip()


def _guardar_admin_configuracion(clave, valor):
    configuracion = AdminConfiguracion.query.filter_by(clave=clave).first()
    if configuracion:
        configuracion.valor = str(valor)
    else:
        db.session.add(AdminConfiguracion(clave=clave, valor=str(valor)))
    db.session.commit()


def _borrar_admin_configuracion(clave):
    configuracion = AdminConfiguracion.query.filter_by(clave=clave).first()
    if configuracion:
        db.session.delete(configuracion)
        db.session.commit()


def _obtener_admin_lock_until():
    valor = _obtener_admin_configuracion('admin_login_lock_until', '')
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor)
    except ValueError:
        _borrar_admin_configuracion('admin_login_lock_until')
        return None


def _obtener_admin_login_failures():
    try:
        return max(0, int(_obtener_admin_configuracion('admin_login_failures', '0') or 0))
    except ValueError:
        return 0


def _reiniciar_admin_login_failures():
    _borrar_admin_configuracion('admin_login_failures')
    _borrar_admin_configuracion('admin_login_lock_until')


def _registrar_fallo_login_admin():
    fallos = _obtener_admin_login_failures() + 1
    if fallos >= ADMIN_LOGIN_MAX_ATTEMPTS:
        bloqueado_hasta = datetime.utcnow() + timedelta(minutes=ADMIN_LOGIN_LOCK_MINUTES)
        _guardar_admin_configuracion('admin_login_lock_until', bloqueado_hasta.isoformat())
        _guardar_admin_configuracion('admin_login_failures', '0')
        return {
            'locked': True,
            'lock_until': bloqueado_hasta,
            'attempts_left': 0,
        }

    _guardar_admin_configuracion('admin_login_failures', str(fallos))
    return {
        'locked': False,
        'lock_until': None,
        'attempts_left': max(0, ADMIN_LOGIN_MAX_ATTEMPTS - fallos),
    }


def _formatear_minutos_restantes(fecha_hasta):
    if not fecha_hasta:
        return 0
    segundos = int((fecha_hasta - datetime.utcnow()).total_seconds())
    return max(0, (segundos + 59) // 60)


def _inicializar_configuracion_admin():
    # Migra claves antiguas y garantiza que existan ambos secretos administrativos.
    configuracion_hash = AdminConfiguracion.query.filter_by(clave='admin_password_hash').first()
    configuracion_legacy = AdminConfiguracion.query.filter_by(clave='admin_password').first()
    configuracion_recovery_hash = AdminConfiguracion.query.filter_by(clave='admin_recovery_password_hash').first()
    configuracion_recovery_legacy = AdminConfiguracion.query.filter_by(clave='admin_recovery_password').first()

    if configuracion_hash:
        if configuracion_legacy:
            db.session.delete(configuracion_legacy)
            db.session.commit()
    else:
        if configuracion_legacy and str(configuracion_legacy.valor or '').strip():
            password_hash = generate_password_hash(str(configuracion_legacy.valor).strip())
            db.session.add(AdminConfiguracion(clave='admin_password_hash', valor=password_hash))
            db.session.delete(configuracion_legacy)
            db.session.commit()
        else:
            password_defecto = os.getenv('ADMIN_PASSWORD', 'admin123')
            db.session.add(AdminConfiguracion(clave='admin_password_hash', valor=generate_password_hash(password_defecto)))
            db.session.commit()

    if configuracion_recovery_hash:
        if configuracion_recovery_legacy:
            db.session.delete(configuracion_recovery_legacy)
            db.session.commit()
    else:
        if configuracion_recovery_legacy and str(configuracion_recovery_legacy.valor or '').strip():
            password_hash = generate_password_hash(str(configuracion_recovery_legacy.valor).strip())
            db.session.add(AdminConfiguracion(clave='admin_recovery_password_hash', valor=password_hash))
            db.session.delete(configuracion_recovery_legacy)
            db.session.commit()
        else:
            admin_password = _obtener_admin_password_hash()
            password_defecto = os.getenv('ADMIN_RECOVERY_PASSWORD', 'reset1234')
            if check_password_hash(admin_password, password_defecto):
                password_defecto = f'{password_defecto}-recuperacion'
            db.session.add(AdminConfiguracion(clave='admin_recovery_password_hash', valor=generate_password_hash(password_defecto)))
            db.session.commit()
