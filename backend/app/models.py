import json
from datetime import datetime

from .extensions import db


class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    config_tiempos = db.Column(db.Text, default='{}')


class Reporte(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    analista_id = db.Column(db.Integer, db.ForeignKey('usuario.id'))
    nombre_paquete = db.Column(db.String(100))
    modo = db.Column(db.String(20))
    unidades_general = db.Column(db.Integer, nullable=True)
    detalle_especifico = db.Column(db.Text, nullable=True)
    tiempo_meta = db.Column(db.Float)
    tiempo_real = db.Column(db.Float)
    rendimiento = db.Column(db.Float)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)


class Promocion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    tiempo_minutos = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TipoPromocion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False, unique=True)
    tiempo_minutos = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SesionPaquete(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    paquete_nombre = db.Column(db.String(120), nullable=False)
    modo = db.Column(db.String(20), nullable=False, default='GENERAL')
    started_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    elapsed_seconds = db.Column(db.Integer, nullable=False, default=0)
    activo = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SesionUsuarioPaquete(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    paquete_nombre = db.Column(db.String(120), nullable=False)
    modo = db.Column(db.String(20), nullable=False, default='GENERAL')
    started_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    elapsed_seconds = db.Column(db.Integer, nullable=False, default=0)
    activo = db.Column(db.Boolean, nullable=False, default=True)
    finalizado = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class PaqueteAnalista(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False, unique=True)
    tipo_paquete = db.Column(db.String(20), nullable=False, default='GENERAL')
    configuracion = db.Column(db.Text, nullable=False, default='{}')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdminConfiguracion(db.Model):
    clave = db.Column(db.String(64), primary_key=True)
    valor = db.Column(db.Text, nullable=False)


def _serializar_paquete_analista(paquete):
    if not paquete:
        return None
    return {
        'nombre': paquete.nombre,
        'tipo_paquete': paquete.tipo_paquete,
        'configuracion': json.loads(paquete.configuracion or '{}'),
        'created_at': paquete.created_at.isoformat() + 'Z' if paquete.created_at else None,
        'updated_at': paquete.updated_at.isoformat() + 'Z' if paquete.updated_at else None,
    }


def _serializar_promocion(promocion):
    return {
        'id': promocion.id,
        'nombre': promocion.nombre,
        'tiempo_minutos': float(promocion.tiempo_minutos or 0),
        'created_at': promocion.created_at.isoformat() + 'Z' if promocion.created_at else None,
        'updated_at': promocion.updated_at.isoformat() + 'Z' if promocion.updated_at else None,
    }


def _serializar_sesion(sesion):
    if not sesion:
        return None
    return {
        'id': sesion.id,
        'paquete_nombre': sesion.paquete_nombre,
        'modo': sesion.modo,
        'started_at': sesion.started_at.isoformat() + 'Z' if sesion.started_at else None,
        'ended_at': sesion.ended_at.isoformat() + 'Z' if sesion.ended_at else None,
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
        'started_at': sesion.started_at.isoformat() + 'Z' if sesion.started_at else None,
        'ended_at': sesion.ended_at.isoformat() + 'Z' if sesion.ended_at else None,
        'elapsed_seconds': sesion.elapsed_seconds,
        'activo': sesion.activo,
        'finalizado': bool(getattr(sesion, 'finalizado', False)),
    }
