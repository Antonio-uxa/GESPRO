from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys


def _cargar_paquete_aplicacion():
    # Carga el paquete real de Flask aunque este archivo se ejecute como script directo.
    base_dir = Path(__file__).resolve().parent
    package_dir = base_dir / 'app'
    spec = spec_from_file_location(
        'gestion_promos_app',
        package_dir / '__init__.py',
        submodule_search_locations=[str(package_dir)]
    )
    if spec is None or spec.loader is None:
        raise RuntimeError('No se pudo cargar el paquete de la aplicación')

    modulo = module_from_spec(spec)
    sys.modules[spec.name] = modulo
    spec.loader.exec_module(modulo)
    return modulo


_modulo_aplicacion = _cargar_paquete_aplicacion()
# Punto de entrada compatible con `python app.py`.
app = _modulo_aplicacion.create_app()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)