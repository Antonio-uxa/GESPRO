from .admin import admin_bp
from .paquetes import paquetes_bp
from .reportes import reportes_bp
from .status import status_bp
from .promociones import promociones_bp


def register_blueprints(app):
    app.register_blueprint(admin_bp)
    app.register_blueprint(paquetes_bp)
    app.register_blueprint(reportes_bp)
    app.register_blueprint(status_bp)
    app.register_blueprint(promociones_bp)
