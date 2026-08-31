import os
from flask import Flask
from flask_cors import CORS

from config import Config
from .extensions import db
from .auth import _inicializar_configuracion_admin
from .models import Promocion
from .utils import _asegurar_columna_finalizado, _asegurar_valor_tiempo_minutos_promocion
from .routes import register_blueprints


def create_app(config_class=Config):
    # Fábrica principal: crea la app, registra extensiones y deja la base lista para usar.
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(app)

    db.init_app(app)
    register_blueprints(app)

    with app.app_context():
        # Inicializa tablas, corrige columnas antiguas y asegura valores mínimos de arranque.
        db.create_all()
        _asegurar_columna_finalizado()
        _asegurar_valor_tiempo_minutos_promocion()
        _inicializar_configuracion_admin()
        # Semilla mínima para que el sistema siempre tenga promociones base.
        if not Promocion.query.first():
            db.session.add(Promocion(nombre='Bono Texto', tiempo_minutos=0))
            db.session.add(Promocion(nombre='Bono Imagen', tiempo_minutos=0))
            db.session.commit()

    return app
