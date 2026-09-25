# GESPRO

## Descripción del Proyecto
GESPRO es un aplicativo web diseñado e implementado para gestionar la productividad y medir el rendimiento operativo dentro del área de Tecnología, Informática y Operaciones de Supertiendas y Droguerías Olímpica S.A. Su propósito principal es registrar de forma estandarizada el tiempo empleado en los paquetes de trabajo y calcular automáticamente el rendimiento de los analistas.

## Problemática que Resuelve
Antes de la implementación de este sistema, el control de tiempos se realizaba de manera completamente manual mediante el uso de papel, cálculos mentales y calculadoras físicas. Este proyecto soluciona los siguientes inconvenientes detectados:
* Demoras y posibles errores humanos en el cálculo manual de tiempos y rendimientos.
* Falta de una base centralizada para estandarizar los tiempos de referencia de cada tarea.
* Dificultades logísticas para medir y distribuir el tiempo en trabajos y paquetes grupales.
* Riesgo de pérdida de registros temporales por cierres accidentales o fallos durante el turno.

## Características y Funcionalidades Principales
El sistema opera bajo un enfoque de doble rol (Administrador y Analista) y cuenta con las siguientes características:

* **Módulo de Administración:** Interfaz que permite al usuario administrador crear, editar y eliminar las promociones disponibles, además de gestionar a los analistas y definir los tiempos de referencia.
* **Módulo de Analista (Modo General):** Interfaz para el registro de tareas y seguimiento de paquetes de trabajo, la cual integra un cronómetro para medir de manera exacta el tiempo empleado.
* **Cálculo Automático de Rendimiento:** El aplicativo calcula el "Tiempo Meta" multiplicando las unidades totales por el tiempo general establecido. Posteriormente, calcula el "Rendimiento (%)" comparando el tiempo meta frente al tiempo real utilizado.
* **Respaldo de Datos Offline:** Integración de la API `localStorage` del navegador para proteger los registros temporalmente en caso de desconexiones.

## Requerimientos del Sistema
A continuación, se detallan los requerimientos funcionales principales implementados en el desarrollo de la plataforma:

| Módulo / Componente | Requerimiento / Funcionalidad | Descripción |
| :--- | :--- | :--- |
| **Administración** | Gestión de Promociones | Capacidad para crear, editar y eliminar los tipos de promociones disponibles en el sistema. |
| **Administración** | Gestión de Usuarios | Interfaz dedicada a la gestión de los analistas que utilizarán el aplicativo. |
| **Administración** | Tiempos de Referencia | Establecimiento de los tiempos generales o base para las diferentes promociones, necesarios para los cálculos. |
| **Analista** | Registro de Trabajo | Selección y registro de paquetes de trabajo o múltiples promociones asignadas al usuario. |
| **Sistema Core** | Cálculo de Tiempo Meta | Funcionalidad que calcula la meta multiplicando las unidades totales por el tiempo general de los participantes. |
| **Sistema Core** | Cálculo de Rendimiento | Evaluación automática del rendimiento individual comparando el tiempo meta frente al tiempo real registrado. |
| **Seguridad / Datos** | Respaldo Local | Uso de la API `localStorage` del navegador para proteger los registros temporalmente en caso de caída de conexión. |

## 💻 Tecnologías y Herramientas Utilizadas
El proyecto está construido sobre las siguientes tecnologías:
* **Frontend:** Angular.
* **Backend:** Python con el framework Flask.
* **Base de Datos:** Relacional utilizando SQLite.
* **Control de Versiones y Entorno:** Git y Visual Studio Code.
