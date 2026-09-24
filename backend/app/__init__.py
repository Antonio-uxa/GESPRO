import os
from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS

from config import Config
from .extensions import db
from .auth import _inicializar_configuracion_admin
from .models import Promocion
from .utils import _asegurar_columna_finalizado, _asegurar_valor_tiempo_minutos_promocion
from .routes import register_blueprints


def create_app(config_class=Config):
    # Fábrica principal: crea la app, registra extensiones y deja la base lista para usar.
    base_dir = Path(__file__).resolve().parents[2]
    frontend_dist = base_dir / 'frontend' / 'dist' / 'frontend' / 'browser'

    app = Flask(
        __name__,
        static_folder=str(frontend_dist),
        template_folder=str(frontend_dist),
    )
    app.config.from_object(config_class)
    CORS(app)

    db.init_app(app)
    register_blueprints(app)

    @app.route('/')
    def index():
        if not frontend_dist.exists():
            return {'error': 'El frontend no está compilado aún. Ejecuta: cd frontend && npm run build'}, 503
        return send_from_directory(app.template_folder, 'index.html')

    @app.route('/<path:path>')
    def serve_spa(path):
        if not frontend_dist.exists():
            return {'error': 'El frontend no está compilado aún. Ejecuta: cd frontend && npm run build'}, 503

        if path.startswith('api/') or path == 'api':
            return {'error': 'Ruta API no encontrada'}, 404

        file_path = frontend_dist / path
        if file_path.is_file():
            return send_from_directory(app.static_folder, path)

        return send_from_directory(app.template_folder, 'index.html')

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
