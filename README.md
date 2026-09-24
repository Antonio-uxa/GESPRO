# GESPRO: Sistema Web de Gestión de Productividad y Medición de Rendimiento Operativo[cite: 1]

## 📖 Descripción del Proyecto
GESPRO es un aplicativo web diseñado e implementado para gestionar la productividad y medir el rendimiento operativo dentro del área de Tecnología, Informática y Operaciones de Supertiendas y Droguerías Olímpica S.A.[cite: 1]. Su propósito principal es registrar de forma estandarizada el tiempo empleado en los paquetes de trabajo y calcular automáticamente el rendimiento de los analistas[cite: 1].

## ⚠️ Problemática que Resuelve
Antes de la implementación de este sistema, el control de tiempos se realizaba de manera completamente manual mediante el uso de papel, cálculos mentales y calculadoras físicas[cite: 1]. Este proyecto soluciona los siguientes inconvenientes detectados[cite: 1]:
* Demoras y posibles errores humanos en el cálculo manual de tiempos y rendimientos[cite: 1].
* Falta de una base centralizada para estandarizar los tiempos de referencia de cada tarea[cite: 1].
* Dificultades logísticas para medir y distribuir el tiempo en trabajos y paquetes grupales[cite: 1].
* Riesgo de pérdida de registros temporales por cierres accidentales o fallos durante el turno[cite: 1].

## ⚙️ Características y Funcionalidades Principales
El sistema opera bajo un enfoque de doble rol (Administrador y Analista) y cuenta con las siguientes características[cite: 1]:

* **Módulo de Administración:** Interfaz que permite al usuario administrador crear, editar y eliminar las promociones disponibles, además de gestionar a los analistas y definir los tiempos de referencia[cite: 1].
* **Módulo de Analista (Modo General):** Interfaz para el registro de tareas y seguimiento de paquetes de trabajo, la cual integra un cronómetro para medir de manera exacta el tiempo empleado[cite: 1].
* **Cálculo Automático de Rendimiento:** El aplicativo calcula el "Tiempo Meta" multiplicando las unidades totales por el tiempo general establecido[cite: 1]. Posteriormente, calcula el "Rendimiento (%)" comparando el tiempo meta frente al tiempo real utilizado[cite: 1].
* **Respaldo de Datos Offline:** Integración de la API `localStorage` del navegador para proteger los registros temporalmente en caso de desconexiones[cite: 1].

## 📋 Requerimientos del Sistema
A continuación, se detallan los requerimientos funcionales principales implementados en el desarrollo de la plataforma:

| Módulo / Componente | Requerimiento / Funcionalidad | Descripción |
| :--- | :--- | :--- |
| **Administración** | Gestión de Promociones | Capacidad para crear, editar y eliminar los tipos de promociones disponibles en el sistema[cite: 1]. |
| **Administración** | Gestión de Usuarios | Interfaz dedicada a la gestión de los analistas que utilizarán el aplicativo[cite: 1]. |
| **Administración** | Tiempos de Referencia | Establecimiento de los tiempos generales o base para las diferentes promociones, necesarios para los cálculos[cite: 1]. |
| **Analista** | Registro de Trabajo (Modo General) | Selección y registro de paquetes de trabajo o múltiples promociones asignadas al usuario[cite: 1]. |
| **Analista** | Control de Tiempo (Cronómetro) | Implementación de un cronómetro en la interfaz para medir con exactitud el tiempo real empleado en cada tarea[cite: 1]. |
| **Sistema Core** | Cálculo de Tiempo Meta | Funcionalidad que calcula la meta multiplicando las unidades totales por el tiempo general de los participantes[cite: 1]. |
| **Sistema Core** | Cálculo de Rendimiento (%) | Evaluación automática del rendimiento individual comparando el tiempo meta frente al tiempo real registrado[cite: 1]. |
| **Seguridad / Datos** | Respaldo Local (Offline) | Uso de la API `localStorage` del navegador para proteger los registros temporalmente en caso de caída de conexión[cite: 1]. |

## 💻 Tecnologías y Herramientas Utilizadas
El proyecto está construido sobre las siguientes tecnologías[cite: 1]:
* **Frontend:** Angular[cite: 1].
* **Backend:** Python con el framework Flask (API REST) y Flask-CORS[cite: 1].
* **Base de Datos:** Relacional utilizando SQLite[cite: 1].
* **Control de Versiones y Entorno:** Git y Visual Studio Code[cite: 1].

## 👤 Autor y Contexto
* **Desarrollador:** Antonio José Ortega Millán[cite: 1].
* **Contexto:** Este proyecto fue desarrollado como práctica profesional para Supertiendas y Droguerías Olímpica S.A., bajo el programa de Tecnología en Informática[cite: 1]. El proceso contó con la supervisión académica del docente César Daniel Lavacude Rivera[cite: 1].
