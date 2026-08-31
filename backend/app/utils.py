import json
import re
from datetime import datetime, timedelta

from sqlalchemy import text

from .extensions import db
from .models import PaqueteAnalista, Reporte, SesionPaquete, SesionUsuarioPaquete


def _dt_to_iso(value):
    return value.isoformat() + 'Z' if value else None


def _load_json(value, default=None):
    if value is None:
        return default if default is not None else {}
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default if default is not None else {}


def _serializar_paquete_analista(paquete):
    if not paquete:
        return None
    return {
        'nombre': paquete.nombre,
        'tipo_paquete': paquete.tipo_paquete,
        'configuracion': _load_json(paquete.configuracion, {}),
        'created_at': _dt_to_iso(paquete.created_at),
        'updated_at': _dt_to_iso(paquete.updated_at),
    }


def _serializar_promocion(promocion):
    return {
        'id': promocion.id,
        'nombre': promocion.nombre,
        'tiempo_minutos': float(promocion.tiempo_minutos or 0),
        'created_at': _dt_to_iso(promocion.created_at),
        'updated_at': _dt_to_iso(promocion.updated_at),
    }
    
def _serializar_tipo_promocion(tipo):
    return {
        'id': tipo.id,
        'nombre': tipo.nombre,
        'tiempo_minutos': float(tipo.tiempo_minutos or 0),
        'created_at': _dt_to_iso(tipo.created_at),
        'updated_at': _dt_to_iso(tipo.updated_at),
    }


def _serializar_sesion(sesion):
    if not sesion:
        return None
    return {
        'id': sesion.id,
        'paquete_nombre': sesion.paquete_nombre,
        'modo': sesion.modo,
        'started_at': _dt_to_iso(sesion.started_at),
        'ended_at': _dt_to_iso(sesion.ended_at),
        'elapsed_seconds': sesion.elapsed_seconds,
        'activo': sesion.activo,
    }


def _serializar_sesion_usuario(sesion):
    if not sesion:
        return None
    return {
        'id': sesion.id,
        'usuario_id': sesion.usuario_id,
        'paquete_nombre': sesion.paquete_nombre,
        'modo': sesion.modo,
        'started_at': _dt_to_iso(sesion.started_at),
        'ended_at': _dt_to_iso(sesion.ended_at),
        'elapsed_seconds': sesion.elapsed_seconds,
        'activo': sesion.activo,
        'finalizado': bool(getattr(sesion, 'finalizado', False)),
    }


def _semaforo_por_rendimiento(rendimiento):
    if rendimiento >= 0:
        return "VERDE"
    if rendimiento >= -15:
        return "AMARILLO"
    return "ROJO"


def _calcular_rendimiento(meta_min, real_min):
    meta = float(meta_min or 0)
    real = float(real_min or 0)
    if real <= 0:
        return 100 if meta > 0 else 0
    return ((meta - real) / real) * 100


def _parse_fecha_inicio(valor):
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor)
    except ValueError:
        return None


def _parse_fecha_fin(valor):
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor) + timedelta(days=1)
    except ValueError:
        return None


def _normalizar_nombre_paquete(nombre):
    texto = (nombre or '').strip().upper()
    texto = re.sub(r'\s*-\s*', '-', texto)
    texto = re.sub(r'\s+', ' ', texto)
    return texto


def _obtener_alias_paquete(nombre_base):
    objetivo = _normalizar_nombre_paquete(nombre_base)
    if not objetivo:
        return []

    nombres = set()
    for _, campo in [
        (Reporte, Reporte.nombre_paquete),
        (SesionPaquete, SesionPaquete.paquete_nombre),
        (SesionUsuarioPaquete, SesionUsuarioPaquete.paquete_nombre)
    ]:
        filas = db.session.query(campo).filter(campo.isnot(None)).distinct().all()
        for (valor,) in filas:
            if _normalizar_nombre_paquete(valor) == objetivo:
                nombres.add(valor)

    return list(nombres)


def _modos_de_paquete(paquete):
    tipo = (getattr(paquete, 'tipo_paquete', '') or '').upper()
    if tipo == 'GENERAL':
        return ['GENERAL']
    return ['GENERAL']


def _estado_entregado_desde_configuracion_paquete(paquete):
    configuracion = _load_json(getattr(paquete, 'configuracion', '{}') or '{}', {})
    estado_guardado = str(configuracion.get('estadoPaquete') or configuracion.get('estado_paquete') or '').upper()
    if estado_guardado in ['FINALIZADO', 'ENTREGADO']:
        return True
    if bool(configuracion.get('bloqueadoEdicion')):
        return True
    if configuracion.get('sesionFinIso'):
        return True
    return False


def _estado_paquete_modo(nombre_paquete, modo):
    modo = (modo or 'GENERAL').upper()
    nombre = (nombre_paquete or '').strip()
    if not nombre:
        return 'SIN ESTADO'

    paquete_guardado = PaqueteAnalista.query.filter_by(nombre=nombre).first()
    if paquete_guardado and _estado_entregado_desde_configuracion_paquete(paquete_guardado):
        return 'ENTREGADO'

    if modo == 'GENERAL':
        sesion_activa = SesionPaquete.query.filter_by(paquete_nombre=nombre, modo=modo, activo=True).order_by(SesionPaquete.id.desc()).first()
        if sesion_activa:
            return 'ACTIVO'

        ultima = SesionPaquete.query.filter_by(paquete_nombre=nombre, modo=modo).order_by(SesionPaquete.id.desc()).first()
        if ultima:
            return 'ENTREGADO' if ultima.ended_at else 'EN PROCESO'

        if Reporte.query.filter_by(nombre_paquete=nombre, modo=modo).first():
            return 'EN PROCESO'
        return 'SIN ESTADO'

    sesiones = SesionUsuarioPaquete.query.filter_by(paquete_nombre=nombre, modo=modo).all()
    if any(s.activo for s in sesiones):
        return 'ACTIVO'
    if sesiones:
        if all(bool(s.finalizado) for s in sesiones):
            return 'ENTREGADO'
        if any(s.ended_at for s in sesiones):
            return 'EN PROCESO'

    if Reporte.query.filter_by(nombre_paquete=nombre, modo=modo).first():
        return 'EN PROCESO'
    return 'SIN ESTADO'


def _estado_paquete_global(paquete):
    estados = [_estado_paquete_modo(paquete.nombre, modo) for modo in _modos_de_paquete(paquete)]
    if not estados:
        return 'SIN ESTADO'
    if 'ACTIVO' in estados:
        return 'ACTIVO'
    if 'EN PROCESO' in estados:
        return 'EN PROCESO'
    if all(estado == 'ENTREGADO' for estado in estados):
        return 'ENTREGADO'
    if any(estado != 'SIN ESTADO' for estado in estados):
        return 'EN PROCESO'
    return 'SIN ESTADO'


def _cerrar_sesion_usuario(sesion, finalizado=False):
    ahora = datetime.utcnow()
    sesion.ended_at = ahora
    sesion.activo = False
    sesion.elapsed_seconds = max(0, int((ahora - sesion.started_at).total_seconds()))
    sesion.finalizado = bool(finalizado)
    return sesion


def _asegurar_columna_finalizado():
    resultado = db.session.execute(text("PRAGMA table_info('sesion_usuario_paquete')"))
    columnas = [fila[1] for fila in resultado.fetchall()]
    if 'finalizado' not in columnas:
        db.session.execute(text("ALTER TABLE sesion_usuario_paquete ADD COLUMN finalizado BOOLEAN NOT NULL DEFAULT 0"))
        db.session.commit()



def _asegurar_valor_tiempo_minutos_promocion():
    db.session.execute(text("UPDATE promocion SET tiempo_minutos = 0 WHERE tiempo_minutos IS NULL"))
    db.session.commit()
