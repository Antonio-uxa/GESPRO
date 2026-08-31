import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { AdminPanelComponent } from './admin-panel.component';
Chart.register(...registerables);

type ModoTrabajo = 'GENERAL';
type TipoPaquete = ModoTrabajo;

interface PaqueteAnalistaGuardado {
  paqueteAnalistaNombre: string;
  tipoPaquete?: TipoPaquete;
  backendUpdatedAt?: string | null;
  estadoPaquete?: 'SIN INICIAR' | 'EN PROCESO' | 'ENTREGADO';
  bloqueadoEdicion?: boolean;
  unidadesLoteGeneralFijado?: boolean;
  tiposPromocionesSeleccionadas?: number[];
  tiposPromocionesFijadas?: boolean;
  repartoFijado?: boolean;
  modoRepartoGeneral?: 'PROMEDIO' | 'MANUAL';
  unidadesPorUsuarioGeneral?: { [key: number]: { [key: number]: number } };
  participantesFijados?: boolean;
  // Modo Específico
  participantesFijadosEspecifico?: boolean;
  repartoFijadoEspecifico?: boolean;
  modoRepartoEspecifico?: 'PROMEDIO' | 'MANUAL';
  unidadesPorUsuarioEspecifico?: { [key: number]: { [key: number]: number } };
  idsSeleccionadosEspecifico?: number[];
  paqueteAnalistaCantidadPromos: number | null;
  nombreLote: string;
  nombrePaqueteEspecifico: string;
  modoTrabajo: ModoTrabajo;
  idsSeleccionados: number[];
  unidadesLoteGeneral: number;
  registroCantidades: any;
  segundos: number;
  tiempoAcumuladoMs: number;
  inicioCronometroMs: number | null;
  corriendo: boolean;
  sesionId?: number | null;
  sesionInicioIso?: string | null;
  sesionFinIso?: string | null;
  sesionDuracionSegundos?: number;
}

interface SesionUsuarioPaqueteGuardada {
  id: number;
  usuario_id: number;
  paquete_nombre: string;
  modo: ModoTrabajo;
  started_at: string | null;
  ended_at: string | null;
  elapsed_seconds: number;
  activo: boolean;
  finalizado?: boolean;
}

interface StatusResumenGlobal {
  registros: number;
  paquetes: number;
  analistas: number;
  meta_total: number;
  real_total: number;
  desviacion_total: number;
  rendimiento_global: number;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
}

interface StatusFila {
  nombre_paquete?: string;
  modo?: string;
  fecha_creacion?: string | null;
  fecha_ultima?: string | null;
  estado_paquete?: string;
  analista_id?: number;
  nombre?: string;
  registros: number;
  meta_total: number;
  real_total: number;
  desviacion_total: number;
  rendimiento: number;
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
}

interface StatusPaqueteOpcion {
  nombre: string;
  fecha_creacion: string | null;
  estado_paquete?: string;
}

interface StatusPaqueteBasico {
  nombre: string;
  fecha_creacion: string | null;
  estado_paquete: string;
  meta_total: number;
  real_total: number;
  rendimiento: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, AdminPanelComponent],
  templateUrl: './app.html',
  styleUrls: []
})
export class AppComponent implements OnInit, OnDestroy {
  baseUrl: string = '';
  urlBackendConfigurable: string = '';
  private paquetesGuardadosBackend: Record<string, PaqueteAnalistaGuardado> = {};

  private obtenerBaseUrl(): string {
    // La API puede cambiar de equipo o red, así que primero respeta lo guardado en localStorage.
    try {
      const stored = localStorage.getItem('apiBase') || '';
      if (stored && stored.trim()) {
        this.urlBackendConfigurable = stored.replace(/\/+$/, '');
        return this.urlBackendConfigurable;
      }
    } catch (e) {}
    const proto = (window.location && window.location.protocol) ? window.location.protocol : 'http:';
    const host = (window.location && window.location.hostname) ? window.location.hostname : '127.0.0.1';
    const defaultUrl = `${proto}//${host}:5000/api`;
    this.urlBackendConfigurable = defaultUrl;
    return defaultUrl;
  }

  cambiarUrlBackend() {
    const nuevaUrl = prompt(
      'Ingresa la URL del backend (ej: http://192.168.1.100:5000/api):',
      this.urlBackendConfigurable
    );
    if (nuevaUrl && nuevaUrl.trim()) {
      const urlLimpia = nuevaUrl.trim().replace(/\/+$/, '');
      localStorage.setItem('apiBase', urlLimpia);
      this.baseUrl = urlLimpia;
      this.urlBackendConfigurable = urlLimpia;
      alert('URL del backend actualizada. Recargando...');
      location.reload();
    }
  }

  rolActual: 'admin' | 'analista' | 'dashboard' = 'analista';
  adminModo: 'GESTION' | 'GENERAL' | 'CATEGORIAS' = 'GESTION';
  adminGestionVista: 'USUARIOS' | 'PAQUETES' = 'USUARIOS';
  modoTrabajo: ModoTrabajo = 'GENERAL';
  paqueteAnalistaNombre: string = '';
  paqueteAnalistaCantidadPromos: number | null = null;
  paqueteAnalistaActivo: boolean = false;
  paqueteBloqueadoEdicion: boolean = false;
  paquetesGuardados: string[] = [];

  // Datos Base
  usuarios: any[] = [];
  configuracionPromos: any[] = [];
  registroCantidades: any = {}; 
  
  nuevoUsuario: string = '';
  usuarioEditando: any = null;
  paqueteEditandoOriginal: string | null = null;
  paqueteEditandoNombre: string = '';
  paqueteEditandoTipo: TipoPaquete = 'GENERAL';
  nuevoPaqueteTipo: TipoPaquete = 'GENERAL';
  nuevoPaqueteGeneralNombre: string = '';
  nuevoPaqueteGeneralCantidadPromos: number | null = 0;
  nuevoPaqueteEspecificoNombre: string = '';
  nuevoPaqueteEspecificoCantidadPromos: number | null = 0;
  busquedaPaquetes: string = '';

  // Modo General Plural
  idsSeleccionados: number[] = [];
  unidadesLoteGeneral: number = 0;
  unidadesLoteGeneralFijado: boolean = false;
  tiposPromocionesSeleccionadas: number[] = [];
  tiposPromocionesFijadas: boolean = false;
  modoRepartoGeneral: 'PROMEDIO' | 'MANUAL' = 'PROMEDIO';
  repartoFijado: boolean = false;  // Indica si la distribución de promociones está fija
  participantesFijados: boolean = false; // Indica si la selección de participantes está fijada
  unidadesPorUsuarioGeneral: { [key: number]: { [key: number]: number } } = {};
  nombreLote: string = '';
  nombrePaqueteEspecifico: string = '';

  // Modo Específico Plural (análogo a modo general)
  idsSeleccionadosEspecifico: number[] = [];
  participantesFijadosEspecifico: boolean = false;
  repartoFijadoEspecifico: boolean = false;
  modoRepartoEspecifico: 'PROMEDIO' | 'MANUAL' = 'PROMEDIO';
  unidadesPorUsuarioEspecifico: { [key: number]: { [key: number]: number } } = {}; // user_id -> promo_id -> cantidad
  
  // Cronómetro
  segundos: number = 0;
  timer: any;
  corriendo: boolean = false;
  tiempoAcumuladoMs: number = 0;
  inicioCronometroMs: number | null = null;
  sesionId: number | null = null;
  sesionInicioIso: string | null = null;
  sesionFinIso: string | null = null;
  sesionDuracionSegundos: number = 0;
  sesionesUsuarios: { [key: number]: SesionUsuarioPaqueteGuardada } = {}
  sesionesUsuariosBaseSegundos: { [key: number]: number } = {}
  refrescoTiempoUsuarios: any;

  // Status público (solo lectura)
  statusOpcionesPaquetes: StatusPaqueteOpcion[] = [];
  statusPaquetesSeleccionados: string[] = [];
  statusSeleccionarTodos: boolean = true;
  statusTipoEstadistica: 'TODO' | 'PAQUETE' = 'TODO';
  statusPaquetesDesplegado: boolean = false;
  statusUsuarioIndividualId: number | null = null;
  statusFiltroModo: 'ALL' | ModoTrabajo = 'ALL';
  statusFiltroNombre: string = '';
  statusResumenGlobal: StatusResumenGlobal | null = null;
  statusPorPaquete: StatusFila[] = [];
  statusPorAnalista: StatusFila[] = [];
  statusCargando: boolean = false;

  // Admin - Gestión de Tipos de Promoción

  private sincronizacionPaquetes: any;
  private sincronizacionStatus: any;
  private ultimaCargaPaquetesMs: number = 0;
  private ultimaCargaStatusMs: number = 0;
  private intervaloRefrescoMs: number = 30 * 1000; // 30 segundos

  appHost = this;

  // Autenticación admin
  adminToken: string | null = null;
  adminLoginPassword: string = '';
  adminLoginError: string = '';
  adminAutenticando: boolean = false;
  adminResetPanelOpen: boolean = false;
  adminRecoveryPassword: string = '';
  adminRecoveryNewPassword: string = '';
  adminRecoveryConfirmacion: string = '';
  adminRecoveryError: string = '';
  adminRecoveryExito: string = '';
  adminRestableciendoPassword: boolean = false;
  adminPasswordActual: string = '';
  adminPasswordNueva: string = '';
  adminPasswordConfirmacion: string = '';
  adminPasswordError: string = '';
  adminPasswordExito: string = '';
  adminCambiandoPassword: boolean = false;
  adminPasswordPanelOpen: boolean = false;
  adminRecoveryAdminPasswordActual: string = '';
  adminRecoveryNuevaClave: string = '';
  adminRecoveryConfirmacionClave: string = '';
  adminRecoveryAdminError: string = '';
  adminRecoveryAdminExito: string = '';
  adminCambiandoRecoveryPassword: boolean = false;

  @ViewChild('myChart') canvas!: ElementRef;
  chart: any;

  constructor(public http: HttpClient, public cdr: ChangeDetectorRef) {}

  @HostListener('document:pointerdown', ['$event'])
  onGlobalPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const accionDirecta = target.closest('button, a, [role="button"], input[type="checkbox"], input[type="radio"]');
    if (!accionDirecta) return;

    const activo = document.activeElement as HTMLElement | null;
    if (!activo) return;

    const esCampo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName) || activo.isContentEditable;
    if (!esCampo) return;

    if (activo !== target && !activo.contains(target)) {
      activo.blur();
    }
  }

  @HostListener('window:focus')
  onWindowFocus() {
    const ahora = Date.now();
    
    // Solo recargar paquetes si han pasado al menos 30 segundos desde la última carga
    if (ahora - this.ultimaCargaPaquetesMs >= this.intervaloRefrescoMs) {
      this.cargarPaquetesDelBackend();
      this.ultimaCargaPaquetesMs = ahora;
    }
    
    // Solo recargar status si estamos en dashboard y han pasado al menos 30 segundos
    if (this.rolActual === 'dashboard' && ahora - this.ultimaCargaStatusMs >= this.intervaloRefrescoMs) {
      this.cargarStatusOpciones();
      this.cargarStatusResumen();
      this.ultimaCargaStatusMs = ahora;
    }
  }

  seleccionarNumeroEntero(event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    input.select();
  }

  ngOnInit() { 
    // Primero resuelve la URL del backend y luego carga datos, estados y rol guardado.
    this.baseUrl = this.obtenerBaseUrl();
    this.cargarDatos();
    this.iniciarSincronizacionPaquetes();
    setTimeout(() => {
      const rolGuardado = localStorage.getItem('rolActual');
      this.adminToken = sessionStorage.getItem('adminToken');
      if (rolGuardado === 'dashboard') {
        this.setRol('dashboard');
      } else if (rolGuardado === 'admin') {
        this.setRol('admin');
      }
    }, 100);
  }

  get adminAutenticado(): boolean {
    return Boolean(this.adminToken);
  }

  private adminRequestOptions() {
    return {
      headers: {
        'X-Admin-Token': this.adminToken || ''
      }
    };
  }

  private manejarNoAutorizadoAdmin(err: any): boolean {
    if (err?.status === 401) {
      this.cerrarSesionAdmin('Tu sesión de administrador expiró. Inicia sesión nuevamente.');
      return true;
    }
    return false;
  }

  loginAdmin() {
    // Entrada del panel administrativo: valida localmente antes de llamar al backend.
    const password = (this.adminLoginPassword || '').trim();
    if (!password) {
      this.adminLoginError = 'Ingresa la contraseña de administrador.';
      this.cdr.detectChanges();
      return;
    }

    this.adminAutenticando = true;
    this.adminLoginError = '';

    this.http.post(`${this.baseUrl}/admin/login`, { password }).subscribe({
      next: (res: any) => {
        const token = String(res?.token || '');
        if (!token) {
          this.adminLoginError = 'No se recibió token de sesión.';
          this.adminAutenticando = false;
          return;
        }

        this.adminToken = token;
        sessionStorage.setItem('adminToken', token);
        this.adminLoginPassword = '';
        this.adminAutenticando = false;
        this.adminLoginError = '';
        this.adminRecoveryPassword = '';
        this.adminRecoveryNewPassword = '';
        this.adminRecoveryConfirmacion = '';
        this.adminRecoveryError = '';
        this.adminRecoveryExito = '';
        this.adminResetPanelOpen = false;
        this.adminPasswordError = '';
        this.adminPasswordExito = '';
        this.adminPasswordPanelOpen = false;
        this.adminRecoveryAdminPasswordActual = '';
        this.adminRecoveryNuevaClave = '';
        this.adminRecoveryConfirmacionClave = '';
        this.adminRecoveryAdminError = '';
        this.adminRecoveryAdminExito = '';
        // Cargar tipos para que la UI muestre la lista con privilegios de admin
        try { this.cargarTiposPromocion(); } catch (e) { /* ignore */ }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.adminAutenticando = false;
        if (err?.status === 423 || err?.error?.status === 'locked') {
          this.adminLoginError = err?.error?.message || 'Demasiados intentos fallidos. Intenta de nuevo más tarde.';
        } else {
          this.adminLoginError = err?.error?.message || 'Credenciales inválidas.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  cerrarSesionAdmin(mensaje?: string) {
    const options = this.adminRequestOptions();
    this.http.post(`${this.baseUrl}/admin/logout`, {}, options).subscribe({
      next: () => {},
      error: () => {}
    });

    this.adminToken = null;
    sessionStorage.removeItem('adminToken');
    if (this.rolActual === 'admin') {
      this.adminLoginPassword = '';
      this.adminLoginError = mensaje || '';
      this.adminRecoveryPassword = '';
      this.adminRecoveryNewPassword = '';
      this.adminRecoveryConfirmacion = '';
      this.adminRecoveryError = '';
      this.adminRecoveryExito = '';
      this.adminResetPanelOpen = false;
      this.adminPasswordActual = '';
      this.adminPasswordNueva = '';
      this.adminPasswordConfirmacion = '';
      this.adminPasswordError = '';
      this.adminPasswordExito = '';
      this.adminPasswordPanelOpen = false;
      this.adminRecoveryAdminPasswordActual = '';
      this.adminRecoveryNuevaClave = '';
      this.adminRecoveryConfirmacionClave = '';
      this.adminRecoveryAdminError = '';
      this.adminRecoveryAdminExito = '';
      this.adminCambiandoRecoveryPassword = false;
    }
    if (mensaje) alert(mensaje);
    this.cdr.detectChanges();
  }

  cambiarContrasenaAdmin() {
    // Rotación de la contraseña principal del administrador.
    if (!this.adminAutenticado) return;

    const contraseñaActual = (this.adminPasswordActual || '').trim();
    const contraseñaNueva = (this.adminPasswordNueva || '').trim();
    const confirmacion = (this.adminPasswordConfirmacion || '').trim();

    if (!contraseñaActual || !contraseñaNueva || !confirmacion) {
      this.adminPasswordError = 'Completa los tres campos para cambiar la contraseña.';
      this.adminPasswordExito = '';
      this.cdr.detectChanges();
      return;
    }

    if (contraseñaNueva !== confirmacion) {
      this.adminPasswordError = 'La nueva contraseña y su confirmación no coinciden.';
      this.adminPasswordExito = '';
      this.cdr.detectChanges();
      return;
    }

    this.adminCambiandoPassword = true;
    this.adminPasswordError = '';
    this.adminPasswordExito = '';

    this.http.post(`${this.baseUrl}/admin/password`, {
      current_password: contraseñaActual,
      new_password: contraseñaNueva,
      confirm_password: confirmacion
    }, this.adminRequestOptions()).subscribe({
      next: (res: any) => {
        this.adminCambiandoPassword = false;
        this.adminPasswordActual = '';
        this.adminPasswordNueva = '';
        this.adminPasswordConfirmacion = '';
        this.adminPasswordError = '';
        this.adminPasswordExito = res?.message || 'Contraseña actualizada correctamente.';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.adminCambiandoPassword = false;
        if (this.manejarNoAutorizadoAdmin(err)) return;
        this.adminPasswordError = err?.error?.message || 'No se pudo actualizar la contraseña.';
        this.adminPasswordExito = '';
        this.cdr.detectChanges();
      }
    });
  }

  restablecerContrasenaAdmin() {
    // Recupera acceso usando la contraseña secundaria y reemplaza la contraseña principal.
    const recoveryPassword = (this.adminRecoveryPassword || '').trim();
    const newPassword = (this.adminRecoveryNewPassword || '').trim();
    const confirmacion = (this.adminRecoveryConfirmacion || '').trim();

    if (!recoveryPassword || !newPassword || !confirmacion) {
      this.adminRecoveryError = 'Completa los tres campos para restablecer la contraseña.';
      this.adminRecoveryExito = '';
      this.cdr.detectChanges();
      return;
    }

    if (newPassword !== confirmacion) {
      this.adminRecoveryError = 'La nueva contraseña y su confirmación no coinciden.';
      this.adminRecoveryExito = '';
      this.cdr.detectChanges();
      return;
    }

    this.adminRestableciendoPassword = true;
    this.adminRecoveryError = '';
    this.adminRecoveryExito = '';

    this.http.post(`${this.baseUrl}/admin/password/reset`, {
      recovery_password: recoveryPassword,
      new_password: newPassword,
      confirm_password: confirmacion
    }).subscribe({
      next: (res: any) => {
        this.adminRestableciendoPassword = false;
        this.adminRecoveryPassword = '';
        this.adminRecoveryNewPassword = '';
        this.adminRecoveryConfirmacion = '';
        this.adminRecoveryError = '';
        this.adminRecoveryExito = res?.message || 'Contraseña restablecida correctamente.';
        this.adminResetPanelOpen = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.adminRestableciendoPassword = false;
        this.adminRecoveryError = err?.error?.message || 'No se pudo restablecer la contraseña.';
        this.adminRecoveryExito = '';
        this.cdr.detectChanges();
      }
    });
  }

  cambiarContrasenaRecuperacionAdmin() {
    // El administrador autenticado puede cambiar la clave de recuperación sin salir de la sesión.
    if (!this.adminAutenticado) return;

    const contraseñaActualAdmin = (this.adminRecoveryAdminPasswordActual || '').trim();
    const nuevaClave = (this.adminRecoveryNuevaClave || '').trim();
    const confirmacionClave = (this.adminRecoveryConfirmacionClave || '').trim();

    if (!contraseñaActualAdmin || !nuevaClave || !confirmacionClave) {
      this.adminRecoveryAdminError = 'Completa los tres campos para cambiar la contraseña de restablecimiento.';
      this.adminRecoveryAdminExito = '';
      this.cdr.detectChanges();
      return;
    }

    if (nuevaClave !== confirmacionClave) {
      this.adminRecoveryAdminError = 'La nueva contraseña de restablecimiento y su confirmación no coinciden.';
      this.adminRecoveryAdminExito = '';
      this.cdr.detectChanges();
      return;
    }

    this.adminCambiandoRecoveryPassword = true;
    this.adminRecoveryAdminError = '';
    this.adminRecoveryAdminExito = '';

    this.http.post(`${this.baseUrl}/admin/recovery-password`, {
      current_admin_password: contraseñaActualAdmin,
      new_recovery_password: nuevaClave,
      confirm_recovery_password: confirmacionClave
    }, this.adminRequestOptions()).subscribe({
      next: (res: any) => {
        this.adminCambiandoRecoveryPassword = false;
        this.adminRecoveryAdminPasswordActual = '';
        this.adminRecoveryNuevaClave = '';
        this.adminRecoveryConfirmacionClave = '';
        this.adminRecoveryAdminError = '';
        this.adminRecoveryAdminExito = res?.message || 'Contraseña de restablecimiento actualizada correctamente.';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.adminCambiandoRecoveryPassword = false;
        if (this.manejarNoAutorizadoAdmin(err)) return;
        this.adminRecoveryAdminError = err?.error?.message || 'No se pudo actualizar la contraseña de restablecimiento.';
        this.adminRecoveryAdminExito = '';
        this.cdr.detectChanges();
      }
    });
  }

  toggleAdminPasswordPanel(forceState?: boolean) {
    this.adminPasswordPanelOpen = typeof forceState === 'boolean'
      ? forceState
      : !this.adminPasswordPanelOpen;
    if (this.adminPasswordPanelOpen) {
      this.adminPasswordError = '';
      this.adminPasswordExito = '';
    }
    this.cdr.detectChanges();
  }

  toggleAdminResetPanel(forceState?: boolean) {
    this.adminResetPanelOpen = typeof forceState === 'boolean'
      ? forceState
      : !this.adminResetPanelOpen;
    if (this.adminResetPanelOpen) {
      this.adminRecoveryError = '';
      this.adminRecoveryExito = '';
    }
    this.cdr.detectChanges();
  }

  cargarDatos() {
    // Carga usuarios, promociones y estructura base antes de pintar cualquier modo.
    this.http.get(`${this.baseUrl}/data`).subscribe({
      next: (res: any) => {
        this.usuarios = res.usuarios || [];
        // Preferir tipos (nuevo modelo) cuando estén presentes, si no usar promos antiguos
        this.configuracionPromos = (res.tipos && Array.isArray(res.tipos) && res.tipos.length) ? res.tipos : (res.promos || []);
        this.registroCantidades = this.crearMatrizVacia();
        // Cargar paquetes desde backend
        this.cargarPaquetesDelBackend();
        this.restaurarPaqueteActivo();
        this.cdr.detectChanges();
      }
      ,
      error: (err: any) => {
        console.error('Error al cargar datos desde backend:', err);
        alert('No se pudo conectar al backend. Verifica que el servidor esté corriendo y la URL de la API.');
        this.usuarios = [];
        this.configuracionPromos = [];
        this.registroCantidades = {};
        this.cdr.detectChanges();
      }
    });
  }

  // Nota: la etiqueta visible para 'GENERAL' es fija en la UI ('Promociones planas').

  ngOnDestroy() {
    if (this.sincronizacionPaquetes) {
      clearInterval(this.sincronizacionPaquetes);
      this.sincronizacionPaquetes = null;
    }
    if (this.sincronizacionStatus) {
      clearInterval(this.sincronizacionStatus);
      this.sincronizacionStatus = null;
    }
  }

  private cargarPaquetesDelBackend() {
    // Sincroniza lo que el analista ve con el estado compartido que guarda el backend.
    this.ultimaCargaPaquetesMs = Date.now();
    this.http.get(`${this.baseUrl}/paquetes-analista`).subscribe({
      next: (res: any) => {
        if (res?.paquetes && Array.isArray(res.paquetes)) {
          const paquetesGuardados: Record<string, PaqueteAnalistaGuardado> = {};
          res.paquetes.forEach((p: any) => {
            const nombre = p.nombre || '';
            if (nombre) {
              // El backend prevalece para que otros equipos vean la versión compartida
              paquetesGuardados[nombre] = {
                paqueteAnalistaNombre: nombre,
                tipoPaquete: this.normalizarTipoPaquete(p.tipo_paquete, p.configuracion),
                backendUpdatedAt: p.updated_at || null,
                ...p.configuracion,
                bloqueadoEdicion: false
              };
            }
          });
          this.guardarPaquetesGuardados(paquetesGuardados);
          this.refrescarPaquetesGuardados();
          this.cdr.detectChanges();
        }
      },
      error: () => {
        console.warn('No se pudieron cargar paquetes del backend.');
        this.refrescarPaquetesGuardados();
        this.cdr.detectChanges();
      }
    });
  }

  private crearMatrizVacia() {
    const matrizTemporal: any = {};
    this.usuarios.forEach((u: any) => {
      matrizTemporal[u.id] = {};
      this.configuracionPromos.forEach(p => {
        matrizTemporal[u.id][p.id] = Math.max(0, Number(p?.tiempo_minutos || 0));
      });
    });
    return matrizTemporal;
  }

  private obtenerPaquetesGuardados(): Record<string, PaqueteAnalistaGuardado> {
    const normalizados: Record<string, PaqueteAnalistaGuardado> = {};
    const parsed = this.paquetesGuardadosBackend || {};

    Object.keys(parsed || {}).forEach((key) => {
      const paquete = parsed[key] || {};
      const tipo = this.normalizarTipoPaquete(paquete.tipoPaquete, paquete);
      const modoGuardado: ModoTrabajo = 'GENERAL';
      const repartoRaw = ((paquete.modoRepartoGeneral || 'PROMEDIO') as string).toUpperCase();
      const repartoGuardado: 'PROMEDIO' | 'MANUAL' = repartoRaw === 'MANUAL' ? 'MANUAL' : 'PROMEDIO';
      const asignaciones = Object.entries(paquete.unidadesPorUsuarioGeneral || {}).reduce((acc: { [key: number]: { [key: number]: number } }, [uid, valor]) => {
        const id = Number(uid);
        if (Number.isFinite(id)) {
          if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
            acc[id] = Object.entries(valor as { [key: string]: unknown }).reduce((promos: { [key: number]: number }, [promoId, cantidad]) => {
              const promo = Number(promoId);
              const num = Math.max(0, Math.floor(Number(cantidad || 0)));
              if (Number.isFinite(promo)) promos[promo] = num;
              return promos;
            }, {});
          } else {
            acc[id] = { [this.promocionesDisponiblesGeneral[0]?.id || 0]: Math.max(0, Math.floor(Number(valor || 0))) };
          }
        }
        return acc;
      }, {});

      normalizados[key] = {
        ...paquete,
        paqueteAnalistaNombre: paquete.paqueteAnalistaNombre || key,
        tipoPaquete: tipo,
        backendUpdatedAt: paquete.backendUpdatedAt || null,
        bloqueadoEdicion: Boolean(paquete.bloqueadoEdicion),
        unidadesLoteGeneralFijado: Boolean(paquete.unidadesLoteGeneralFijado ?? false),
        tiposPromocionesSeleccionadas: Array.isArray(paquete.tiposPromocionesSeleccionadas)
          ? paquete.tiposPromocionesSeleccionadas.map((valor: any) => Number(valor)).filter((valor: number) => Number.isFinite(valor))
          : [],
        tiposPromocionesFijadas: Boolean(paquete.tiposPromocionesFijadas ?? false),
        modoRepartoGeneral: repartoGuardado,
        unidadesPorUsuarioGeneral: asignaciones,
        modoTrabajo: modoGuardado,
        nombreLote: paquete.nombreLote || (paquete.paqueteAnalistaNombre || key),
        nombrePaqueteEspecifico: paquete.nombrePaqueteEspecifico || (paquete.paqueteAnalistaNombre || key)
      };
    });

    return normalizados;
  }

  private guardarPaquetesGuardados(paquetes: Record<string, PaqueteAnalistaGuardado>) {
    this.paquetesGuardadosBackend = JSON.parse(JSON.stringify(paquetes || {}));
    this.paquetesGuardados = Object.keys(paquetes).sort((a, b) => a.localeCompare(b));
    this.cdr.detectChanges();
  }

  paqueteGuardado(nombre: string): PaqueteAnalistaGuardado | null {
    return this.obtenerPaquetesGuardados()[nombre] || null;
  }

  tipoPaqueteDe(nombre: string): TipoPaquete {
    const paquete = this.obtenerPaquetesGuardados()[nombre];
    return this.normalizarTipoPaquete(paquete?.tipoPaquete, paquete);
  }

  private coincideBusquedaPaquete(nombre: string): boolean {
    const q = (this.busquedaPaquetes || '').trim().toLowerCase();
    return !q || nombre.toLowerCase().includes(q);
  }

  get paquetesGeneralesFiltrados(): string[] {
    return this.paquetesGuardados.filter((nombre) => {
      const tipo = this.tipoPaqueteDe(nombre);
      return tipo === 'GENERAL' && this.coincideBusquedaPaquete(nombre);
    });
  }

  get paquetesEspecificosFiltrados(): string[] {
    // Specific mode removed — no paquetes específicos
    return [];
  }

  private normalizarTipoPaquete(tipo: any, paquete?: any): TipoPaquete {
    return 'GENERAL';
  }

  private refrescarPaquetesGuardados() {
    this.paquetesGuardados = Object.keys(this.obtenerPaquetesGuardados()).sort((a, b) => a.localeCompare(b));
    this.cdr.detectChanges();
  }

  private iniciarSincronizacionPaquetes() {
    if (this.sincronizacionPaquetes) {
      clearInterval(this.sincronizacionPaquetes);
    }

    this.sincronizacionPaquetes = setInterval(() => {
      this.cargarPaquetesDelBackend();
    }, 5000);
  }

  private iniciarSincronizacionStatus() {
    if (this.sincronizacionStatus) {
      clearInterval(this.sincronizacionStatus);
    }

    if (this.rolActual !== 'dashboard') {
      this.sincronizacionStatus = null;
      return;
    }

    this.sincronizacionStatus = setInterval(() => {
      this.cargarStatusOpciones();
      this.cargarStatusResumen();
    }, this.intervaloRefrescoMs);
  }

  private detenerSincronizacionStatus() {
    if (this.sincronizacionStatus) {
      clearInterval(this.sincronizacionStatus);
      this.sincronizacionStatus = null;
    }
  }

  private capturarPaqueteActual(): PaqueteAnalistaGuardado | null {
    const nombre = this.paqueteAnalistaNombre.trim();
    if (!nombre) return null;

    const tiempoAcumuladoMs = this.obtenerTiempoActualMs();

    return {
      paqueteAnalistaNombre: nombre,
      tipoPaquete: this.nuevoPaqueteTipo,
      bloqueadoEdicion: this.paqueteBloqueadoEdicion,
      unidadesLoteGeneralFijado: this.unidadesLoteGeneralFijado,
      tiposPromocionesSeleccionadas: [...this.tiposPromocionesSeleccionadas],
      tiposPromocionesFijadas: this.tiposPromocionesFijadas,
      repartoFijado: this.repartoFijado,
      paqueteAnalistaCantidadPromos: this.paqueteAnalistaCantidadPromos,
      nombreLote: this.nombreLote,
      nombrePaqueteEspecifico: this.nombrePaqueteEspecifico,
      modoTrabajo: this.modoTrabajo,
      modoRepartoGeneral: this.modoRepartoGeneral,
      idsSeleccionados: [...this.idsSeleccionados],
      unidadesLoteGeneral: this.unidadesLoteGeneral,
      unidadesPorUsuarioGeneral: JSON.parse(JSON.stringify(this.unidadesPorUsuarioGeneral || {})),
      participantesFijados: this.participantesFijados,
      // Modo Específico
      participantesFijadosEspecifico: this.participantesFijadosEspecifico,
      repartoFijadoEspecifico: this.repartoFijadoEspecifico,
      modoRepartoEspecifico: this.modoRepartoEspecifico,
      idsSeleccionadosEspecifico: [...this.idsSeleccionadosEspecifico],
      unidadesPorUsuarioEspecifico: JSON.parse(JSON.stringify(this.unidadesPorUsuarioEspecifico || {})),
      registroCantidades: JSON.parse(JSON.stringify(this.registroCantidades || {})),
      segundos: Math.floor(tiempoAcumuladoMs / 1000),
      tiempoAcumuladoMs,
      inicioCronometroMs: this.corriendo ? (this.inicioCronometroMs ?? Date.now()) : null,
      corriendo: this.corriendo,
      sesionId: this.sesionId,
      sesionInicioIso: this.sesionInicioIso,
      sesionFinIso: this.sesionFinIso,
      sesionDuracionSegundos: this.sesionDuracionSegundos
    };
  }

  private obtenerTiempoActualMs(): number {
    const base = this.tiempoAcumuladoMs || 0;
    if (!this.corriendo || this.inicioCronometroMs === null) {
      return base;
    }

    return base + (Date.now() - this.inicioCronometroMs);
  }

  private limpiarIntervaloCronometro() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private refrescarTiempoVisibleDesdeSesion() {
    if (this.corriendo && this.sesionInicioIso) {
      const inicio = new Date(this.sesionInicioIso).getTime();
      this.segundos = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
      return;
    }

    if (this.sesionFinIso) {
      this.segundos = Math.max(0, Math.floor(this.sesionDuracionSegundos || 0));
      return;
    }

    this.segundos = 0;
  }

  private iniciarIntervaloSesion() {
    this.limpiarIntervaloCronometro();
    if (!this.corriendo || !this.sesionInicioIso) {
      return;
    }

    this.timer = setInterval(() => {
      this.refrescarTiempoVisibleDesdeSesion();
      this.cdr.markForCheck();
    }, 1000);
  }

  private aplicarSesionRespuesta(sesion: any) {
    if (!sesion) {
      this.sesionId = null;
      this.sesionInicioIso = null;
      this.sesionFinIso = null;
      this.sesionDuracionSegundos = 0;
      this.tiempoAcumuladoMs = 0;
      this.inicioCronometroMs = null;
      this.corriendo = false;
      this.segundos = 0;
      this.refrescarTiempoVisibleDesdeSesion();
      return;
    }

    this.sesionId = sesion.id ?? null;
    this.sesionInicioIso = sesion.started_at ?? null;
    this.sesionFinIso = sesion.ended_at ?? null;
    this.sesionDuracionSegundos = Number(sesion.elapsed_seconds || 0);
    this.corriendo = Boolean(sesion.activo);
    this.tiempoAcumuladoMs = this.corriendo && this.sesionInicioIso ? 0 : this.sesionDuracionSegundos * 1000;
    this.inicioCronometroMs = this.corriendo && this.sesionInicioIso ? new Date(this.sesionInicioIso).getTime() : null;

    if (this.sesionFinIso) {
      this.paqueteBloqueadoEdicion = true;
    }

    this.refrescarTiempoVisibleDesdeSesion();
    this.iniciarIntervaloSesion();
  }

  private cargarSesionPaquete(nombre: string, modo: ModoTrabajo = this.modoTrabajo, fallbackPaquete?: PaqueteAnalistaGuardado) {
    if (!nombre.trim()) {
      this.aplicarSesionRespuesta(null);
      return;
    }

    this.http.get(`${this.baseUrl}/sesiones-paquete`, { params: { nombre, modo } }).subscribe({
      next: (res: any) => {
        const sesion = res?.activa || res?.ultima || null;
        if (sesion) {
          this.aplicarSesionRespuesta(sesion);
        } else if (fallbackPaquete) {
          this.aplicarEstadoLocalPaquete(fallbackPaquete);
        } else {
          this.aplicarSesionRespuesta(null);
        }
      },
      error: () => {
        if (fallbackPaquete) {
          this.aplicarEstadoLocalPaquete(fallbackPaquete);
        } else {
          this.aplicarSesionRespuesta(null);
        }
      }
    });
  }

  private iniciarSesionBackend(nombre: string) {
    return this.http.post(`${this.baseUrl}/paquetes/iniciar`, {
      paquete_nombre: nombre,
      modo: this.modoTrabajo
    });
  }

  private finalizarSesionBackend(nombre: string) {
    return this.http.post(`${this.baseUrl}/paquetes/finalizar`, {
      paquete_nombre: nombre,
      modo: this.modoTrabajo
    });
  }

  private iniciarRefrescoUsuarios() {
    if (this.refrescoTiempoUsuarios) {
      clearInterval(this.refrescoTiempoUsuarios);
      this.refrescoTiempoUsuarios = null;
    }

    if (!this.haySesionesUsuariosActivas()) {
      return;
    }

    this.refrescoTiempoUsuarios = setInterval(() => {
      this.cdr.markForCheck();
      if (!this.haySesionesUsuariosActivas()) {
        this.detenerRefrescoUsuarios();
      }
    }, 1000);
  }

  private detenerRefrescoUsuarios() {
    if (this.refrescoTiempoUsuarios) {
      clearInterval(this.refrescoTiempoUsuarios);
      this.refrescoTiempoUsuarios = null;
    }
  }

  private haySesionesUsuariosActivas(): boolean {
    return Object.values(this.sesionesUsuarios || {}).some((sesion: SesionUsuarioPaqueteGuardada | undefined) => Boolean(sesion?.activo));
  }

  private cargarSesionesUsuarios(nombre: string, modo: ModoTrabajo = this.modoTrabajo) {
    if (!nombre.trim()) {
      this.sesionesUsuarios = {};
      this.sesionesUsuariosBaseSegundos = {};
      this.detenerRefrescoUsuarios();
      return;
    }

    this.http.get(`${this.baseUrl}/sesiones-usuario-paquete`, { params: { paquete: nombre, modo } }).subscribe({
      next: (res: any) => {
        const sesiones = Array.isArray(res?.sesiones) ? res.sesiones : [];
        const mapa: { [key: number]: SesionUsuarioPaqueteGuardada } = {};
        const acumulado: { [key: number]: number } = {};

        // Agrupar y sumar elapsed_seconds por usuario
        sesiones.forEach((sesion: SesionUsuarioPaqueteGuardada) => {
          acumulado[sesion.usuario_id] = (acumulado[sesion.usuario_id] || 0) + Number(sesion.elapsed_seconds || 0);
          // Preferir guardar la sesión activa como representante del usuario
          if (!mapa[sesion.usuario_id] || sesion.activo) {
            mapa[sesion.usuario_id] = sesion;
          }
        });

        // Para evitar doble conteo: restar del acumulado el elapsed_seconds
        // de la sesión representativa (normalmente la activa). De este modo
        // `sesionesUsuariosBaseSegundos` contiene solo los segundos de sesiones
        // previas/otras y `obtenerSegundosSesionUsuario` puede sumar correctamente
        // el elapsed de la sesión representativa más el tiempo en curso.
        Object.keys(mapa).forEach((uidStr) => {
          const uid = Number(uidStr);
          const rep = mapa[uid];
          const repElapsed = Number(rep?.elapsed_seconds || 0);
          acumulado[uid] = Math.max(0, (acumulado[uid] || 0) - repElapsed);
        });

        this.sesionesUsuarios = mapa;
        this.sesionesUsuariosBaseSegundos = acumulado;
        this.iniciarRefrescoUsuarios();
        this.cdr.detectChanges();
      },
      error: () => {
        this.sesionesUsuarios = {};
        this.sesionesUsuariosBaseSegundos = {};
        this.detenerRefrescoUsuarios();
      }
    });
  }

  obtenerSesionUsuario(usuarioId: number): SesionUsuarioPaqueteGuardada | null {
    return this.sesionesUsuarios?.[usuarioId] || null;
  }

  sesionUsuarioActiva(usuarioId: number): boolean {
    return Boolean(this.obtenerSesionUsuario(usuarioId)?.activo);
  }

  sesionUsuarioFinalizada(usuarioId: number): boolean {
    return Boolean(this.obtenerSesionUsuario(usuarioId)?.finalizado);
  }

  private calcularDescuentoDescanso(startedAt: string | null, endedAt: string | null): number {
    // Si la sesión ocurrió entre 1 PM (13:00) y 2 PM (14:00), restar 1 hora (3600 segundos)
    if (!startedAt || !endedAt) return 0;
    
    try {
      const start = new Date(startedAt);
      const end = new Date(endedAt);
      
      const startHour = start.getHours();
      const endHour = end.getHours();
      
      // Verificar si la sesión está entre las 13 y 14 horas (1 PM - 2 PM)
      if ((startHour >= 13 && startHour < 14) || (endHour > 13 && endHour <= 14)) {
        return 3600; // 1 hora en segundos
      }
    } catch {
      // Ignorar errores de fecha
    }
    
    return 0;
  }

  obtenerSegundosSesionUsuario(usuarioId: number): number {
    const sesion = this.obtenerSesionUsuario(usuarioId);
    const base = Number(this.sesionesUsuariosBaseSegundos?.[usuarioId] || 0);
    if (!sesion) return Math.max(0, base);
    const elapsed = Number(sesion.elapsed_seconds || 0);
    if (sesion.activo && sesion.started_at) {
      const startedMs = new Date(sesion.started_at).getTime();
      const live = Math.floor((Date.now() - startedMs) / 1000);

      // Evitar doble conteo: tomar el mayor entre lo que reporta el backend
      // (`elapsed`) y el tiempo en curso (`live`). Esto previene sumar ambos
      // valores cuando el backend ya incluye el tiempo activo.
      const best = Math.max(elapsed, live);
      const descuento = this.calcularDescuentoDescanso(sesion.started_at, sesion.ended_at);
      return Math.max(0, base + best - descuento);
    }

    const descuento = this.calcularDescuentoDescanso(sesion.started_at, sesion.ended_at);
    return Math.max(0, base + elapsed - descuento);
  }

  get tiempoEstimadoPaqueteSegundosGeneral(): number {
    if (!Array.isArray(this.usuariosSeleccionadosGeneral) || this.usuariosSeleccionadosGeneral.length === 0) return 0;
    const maxMinutos = this.usuariosSeleccionadosGeneral.reduce((maxActual, u: any) => {
      const estimadoMin = this.obtenerTiempoProgramacionUsuario(u.id);
      return Math.max(maxActual, estimadoMin);
    }, 0);

    return Math.max(0, Math.round(maxMinutos * 60));
  }

  get detalleAcumuladoUsuarios(): Array<{ id: number; nombre: string; segundos: number; activo: boolean; inicio: string | null; fin: string | null }> {
    if (!Array.isArray(this.usuarios) || this.usuarios.length === 0) return [];

    return this.usuarios.map((u: any) => {
      const sesion = this.obtenerSesionUsuario(u.id);
      return {
        id: u.id,
        nombre: u.nombre,
        segundos: this.obtenerSegundosSesionUsuario(u.id),
        activo: Boolean(sesion?.activo),
        inicio: sesion?.started_at || null,
        fin: sesion?.ended_at || null
      };
    }).sort((a, b) => b.segundos - a.segundos);
  }

  formatearFechaSesion(valor: string | null | undefined): string {
    return valor ? new Date(valor).toLocaleString() : '-';
  }

  private iniciarSesionUsuarioRequest(usuarioId: number) {
    return this.http.post(`${this.baseUrl}/sesiones-usuario-paquete/iniciar`, {
      paquete_nombre: this.paqueteAnalistaNombre.trim(),
      usuario_id: usuarioId,
      modo: this.modoTrabajo
    });
  }

  private pausarSesionUsuarioRequest(usuarioId: number) {
    return this.http.post(`${this.baseUrl}/sesiones-usuario-paquete/pausar`, {
      paquete_nombre: this.paqueteAnalistaNombre.trim(),
      usuario_id: usuarioId,
      modo: this.modoTrabajo
    });
  }

  private finalizarSesionUsuarioRequest(usuarioId: number) {
    return this.http.post(`${this.baseUrl}/sesiones-usuario-paquete/finalizar`, {
      paquete_nombre: this.paqueteAnalistaNombre.trim(),
      usuario_id: usuarioId,
      modo: this.modoTrabajo
    });
  }

  private obtenerUsuariosObjetivoCronometros(): any[] {
    if (!this.paqueteAnalistaActivo) return [];
    if (this.modoTrabajo === 'GENERAL') return [...this.usuariosSeleccionadosGeneral];
    return Array.isArray(this.usuarios) ? [...this.usuarios] : [];
  }

  private obtenerSesionesObjetivoPaquete(): SesionUsuarioPaqueteGuardada[] {
    const usuariosObjetivo = this.obtenerUsuariosObjetivoCronometros();
    if (usuariosObjetivo.length > 0) {
      return usuariosObjetivo
        .map((u: any) => this.obtenerSesionUsuario(u.id))
        .filter((s): s is SesionUsuarioPaqueteGuardada => Boolean(s));
    }

    return Object.values(this.sesionesUsuarios || {}).filter((s): s is SesionUsuarioPaqueteGuardada => Boolean(s));
  }

  private estadoPaqueteDesdeGuardado(paquete?: PaqueteAnalistaGuardado | null): 'ACTIVO' | 'EN PROCESO' | 'ENTREGADO' | 'SIN ESTADO' {
    if (!paquete) return 'SIN ESTADO';
    const estadoGuardado = (paquete.estadoPaquete || '').toUpperCase();
    if (paquete.sesionFinIso || paquete.bloqueadoEdicion) return 'ENTREGADO';
    if (estadoGuardado === 'FINALIZADO' || estadoGuardado === 'ENTREGADO') return 'ENTREGADO';
    if (estadoGuardado === 'EN PROCESO') return paquete.corriendo ? 'ACTIVO' : 'EN PROCESO';
    if (paquete.corriendo) return 'ACTIVO';
    return 'SIN ESTADO';
  }

  estadoPaqueteGuardado(nombre: string): 'ACTIVO' | 'EN PROCESO' | 'ENTREGADO' | 'SIN ESTADO' {
    return this.estadoPaqueteDesdeGuardado(this.obtenerPaquetesGuardados()[nombre]);
  }

  claseEstadoPaqueteGuardado(nombre: string): 'status-chip-green' | 'status-chip-yellow' | 'status-chip-red' {
    const estado = this.estadoPaqueteGuardado(nombre);
    if (estado === 'ACTIVO') return 'status-chip-green';
    if (estado === 'EN PROCESO') return 'status-chip-yellow';
    return 'status-chip-red';
  }

  private aplicarEstadoLocalPaquete(paquete: PaqueteAnalistaGuardado) {
    this.sesionId = paquete.sesionId ?? null;
    this.sesionInicioIso = paquete.sesionInicioIso ?? null;
    this.sesionFinIso = paquete.sesionFinIso ?? null;
    this.sesionDuracionSegundos = Number(paquete.sesionDuracionSegundos || paquete.segundos || 0);
    this.corriendo = Boolean(paquete.corriendo);
    this.tiempoAcumuladoMs = Number(paquete.tiempoAcumuladoMs ?? ((paquete.segundos || 0) * 1000));
    this.inicioCronometroMs = paquete.inicioCronometroMs !== null && paquete.inicioCronometroMs !== undefined
      ? Number(paquete.inicioCronometroMs)
      : null;
    this.refrescarTiempoVisibleDesdeSesion();
    this.iniciarIntervaloSesion();
  }

  get estadoPaqueteActual(): 'SIN INICIAR' | 'ACTIVO' | 'EN PAUSA' | 'ENTREGADO' {
    if (this.paqueteBloqueadoEdicion || this.sesionFinIso) return 'ENTREGADO';
    const sesiones = this.obtenerSesionesObjetivoPaquete();
    if (!sesiones.length) return 'SIN INICIAR';
    if (sesiones.some((s) => Boolean(s.activo))) return 'ACTIVO';
    if (sesiones.some((s) => !s.activo && !s.finalizado && Boolean(s.ended_at))) return 'EN PAUSA';
    if (sesiones.every((s) => Boolean(s.finalizado))) return 'ENTREGADO';
    return 'EN PAUSA';
  }

  get estadoPaqueteMenuPrincipal(): 'SIN PAQUETE ACTIVO' | 'SIN INICIAR' | 'ACTIVO' | 'EN PAUSA' | 'ENTREGADO' {
    if (!this.paqueteAnalistaActivo) return 'SIN PAQUETE ACTIVO';
    return this.estadoPaqueteActual;
  }

  get statusOpcionesUsuariosEnVista(): Array<{ analista_id: number; nombre: string }> {
    const mapa = new Map<number, string>();
    this.statusPorAnalista.forEach((fila) => {
      if (fila.analista_id !== undefined && fila.analista_id !== null) {
        mapa.set(Number(fila.analista_id), String(fila.nombre || `Usuario ${fila.analista_id}`));
      }
    });
    return Array.from(mapa.entries())
      .map(([analista_id, nombre]) => ({ analista_id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  reiniciarPaqueteGuardado() {
    if (!this.paqueteAnalistaActivo || !this.paqueteBloqueadoEdicion) return;

    const confirmar = confirm(
      'Esto reiniciará el paquete actual para volver a hacerlo desde cero. ¿Deseas continuar?'
    );
    if (!confirmar) return;

    this.paqueteBloqueadoEdicion = false;
    this.unidadesLoteGeneralFijado = false;

    if (this.modoTrabajo === 'GENERAL') {
      this.idsSeleccionados = [];
      this.unidadesLoteGeneral = 0;
      this.modoRepartoGeneral = 'PROMEDIO';
      this.repartoFijado = false;
      this.participantesFijados = false;
      this.unidadesPorUsuarioGeneral = {};
      this.nombreLote = this.paqueteAnalistaNombre;
    } else {
      // Modo ESPECIFICO
      this.idsSeleccionadosEspecifico = [];
      this.participantesFijadosEspecifico = false;
      this.repartoFijadoEspecifico = false;
      this.modoRepartoEspecifico = 'PROMEDIO';
      this.unidadesPorUsuarioEspecifico = {};
      this.registroCantidades = this.crearMatrizVacia();
      this.nombrePaqueteEspecifico = this.paqueteAnalistaNombre;
    }

    this.limpiarIntervaloCronometro();
    this.detenerRefrescoUsuarios();
    this.segundos = 0;
    this.tiempoAcumuladoMs = 0;
    this.inicioCronometroMs = null;
    this.corriendo = false;
    this.sesionId = null;
    this.sesionInicioIso = null;
    this.sesionFinIso = null;
    this.sesionDuracionSegundos = 0;
    this.sesionesUsuarios = {};
    this.sesionesUsuariosBaseSegundos = {};
    this.guardarPaqueteActual();
    this.cdr.detectChanges();
  }

  private bloquearEdicionPaqueteActual() {
    this.paqueteBloqueadoEdicion = true;
    this.sesionFinIso = this.sesionFinIso || new Date().toISOString();
    this.guardarPaqueteActual();
  }

  get paqueteEntregadoEnUI(): boolean {
    return this.paqueteBloqueadoEdicion || this.estadoPaqueteActual === 'ENTREGADO' || Boolean(this.sesionFinIso);
  }

  get puedeIniciarTodosCronometros(): boolean {
    if (this.paqueteBloqueadoEdicion) return false;
    const usuarios = this.obtenerUsuariosObjetivoCronometros();
    return usuarios.some((u: any) => !this.sesionUsuarioActiva(u.id) && !this.sesionUsuarioFinalizada(u.id));
  }

  get puedePausarTodosCronometros(): boolean {
    if (this.paqueteBloqueadoEdicion) return false;
    const usuarios = this.obtenerUsuariosObjetivoCronometros();
    return usuarios.some((u: any) => this.sesionUsuarioActiva(u.id) && !this.sesionUsuarioFinalizada(u.id));
  }

  get puedeFinalizarTodosCronometros(): boolean {
    if (this.paqueteBloqueadoEdicion) return false;
    const usuarios = this.obtenerUsuariosObjetivoCronometros();
    return usuarios.some((u: any) => this.sesionUsuarioActiva(u.id) && !this.sesionUsuarioFinalizada(u.id));
  }

  iniciarTodosCronometros() {
    this.ejecutarAccionCronometrosEnLote('iniciar');
  }

  pausarTodosCronometros() {
    this.ejecutarAccionCronometrosEnLote('pausar');
  }

  finalizarTodosCronometros() {
    this.ejecutarAccionCronometrosEnLote('finalizar');
  }

  private ejecutarAccionCronometrosEnLote(accion: 'iniciar' | 'pausar' | 'finalizar') {
    if (this.paqueteBloqueadoEdicion) {
      alert('El paquete ya fue guardado y está bloqueado. Pulsa REINICIAR PAQUETE para volver a hacerlo.');
      return;
    }

    const nombre = this.paqueteAnalistaNombre.trim();
    if (!nombre) {
      alert('Define primero el nombre del paquete.');
      return;
    }

    const usuarios = this.obtenerUsuariosObjetivoCronometros();
    if (!usuarios.length) {
      alert('No hay usuarios disponibles para ejecutar esta acción.');
      return;
    }

    const candidatos = usuarios.filter((u: any) => {
      if (accion === 'iniciar') return !this.sesionUsuarioActiva(u.id) && !this.sesionUsuarioFinalizada(u.id);
      if (accion === 'pausar') return this.sesionUsuarioActiva(u.id) && !this.sesionUsuarioFinalizada(u.id);
      return this.sesionUsuarioActiva(u.id) && !this.sesionUsuarioFinalizada(u.id);
    });

    if (!candidatos.length) {
      const label = accion === 'iniciar' ? 'iniciar' : (accion === 'pausar' ? 'pausar' : 'finalizar');
      alert(`No hay cronómetros válidos para ${label}.`);
      return;
    }

    if (accion === 'finalizar') {
      const confirmar = confirm(`¿Seguro que deseas finalizar ${candidatos.length} cronómetros al mismo tiempo?`);
      if (!confirmar) return;
    }

    let completados = 0;
    let exitosos = 0;
    let fallidos = 0;

    const cerrarLote = () => {
      this.cargarSesionesUsuarios(nombre, this.modoTrabajo);
      this.iniciarRefrescoUsuarios();
      this.cdr.detectChanges();
      const verbo = accion === 'iniciar' ? 'iniciaron' : (accion === 'pausar' ? 'pausaron' : 'finalizaron');
      if (fallidos > 0) {
        alert(`Proceso terminado: ${exitosos} cronómetros se ${verbo} y ${fallidos} fallaron.`);
      } else {
        alert(`Proceso terminado: ${exitosos} cronómetros se ${verbo} correctamente.`);
      }
    };

    candidatos.forEach((u: any) => {
      const req = accion === 'iniciar'
        ? this.iniciarSesionUsuarioRequest(u.id)
        : (accion === 'pausar' ? this.pausarSesionUsuarioRequest(u.id) : this.finalizarSesionUsuarioRequest(u.id));

      req.subscribe({
        next: (res: any) => {
          if (res?.sesion) {
            this.sesionesUsuarios = {
              ...this.sesionesUsuarios,
              [u.id]: res.sesion
            };
          }
          exitosos += 1;
          completados += 1;
          if (completados === candidatos.length) cerrarLote();
        },
        error: () => {
          fallidos += 1;
          completados += 1;
          if (completados === candidatos.length) cerrarLote();
        }
      });
    });
  }

  iniciarSesionUsuario(usuario: any) {
    if (this.paqueteBloqueadoEdicion) {
      alert('El paquete está bloqueado para edición.');
      return;
    }

    const nombre = this.paqueteAnalistaNombre.trim();
    if (!nombre) {
      alert('Define primero el nombre del paquete.');
      return;
    }

    this.iniciarSesionUsuarioRequest(usuario.id).subscribe({
      next: (res: any) => {
        if (res?.sesion) {
          this.sesionesUsuarios = {
            ...this.sesionesUsuarios,
            [usuario.id]: res.sesion
          };
          if (!res?.reutilizada) {
            this.sesionesUsuariosBaseSegundos = {
              ...this.sesionesUsuariosBaseSegundos,
              [usuario.id]: Number(this.sesionesUsuariosBaseSegundos?.[usuario.id] || 0)
            };
          }
          this.iniciarRefrescoUsuarios();
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        const mensaje = err?.error?.message || 'No se pudo iniciar la sesión del usuario.';
        alert(mensaje);
      }
    });
  }

  finalizarSesionUsuario(usuario: any) {
    if (this.paqueteBloqueadoEdicion) {
      alert('El paquete está bloqueado para edición.');
      return;
    }

    const nombre = this.paqueteAnalistaNombre.trim();
    if (!nombre) {
      alert('Define primero el nombre del paquete.');
      return;
    }

    const confirmar = confirm(`¿Seguro que deseas finalizar el conteo de ${usuario.nombre}?`);
    if (!confirmar) return;

    this.finalizarSesionUsuarioRequest(usuario.id).subscribe({
      next: (res: any) => {
        if (res?.sesion) {
          this.sesionesUsuarios = {
            ...this.sesionesUsuarios,
            [usuario.id]: res.sesion
          };
          this.sesionesUsuariosBaseSegundos = {
            ...this.sesionesUsuariosBaseSegundos,
            [usuario.id]: Number(this.sesionesUsuariosBaseSegundos?.[usuario.id] || 0)
          };
          this.cargarSesionesUsuarios(nombre, this.modoTrabajo);
          this.iniciarRefrescoUsuarios();
          this.cdr.detectChanges();
        }
      },
      error: () => alert('No se pudo finalizar la sesión del usuario.')
    });
  }

  pausarSesionUsuario(usuario: any) {
    if (this.paqueteBloqueadoEdicion) {
      alert('El paquete está bloqueado para edición.');
      return;
    }

    const nombre = this.paqueteAnalistaNombre.trim();
    if (!nombre) {
      alert('Define primero el nombre del paquete.');
      return;
    }

    this.pausarSesionUsuarioRequest(usuario.id).subscribe({
      next: (res: any) => {
        if (res?.sesion) {
          this.sesionesUsuarios = {
            ...this.sesionesUsuarios,
            [usuario.id]: res.sesion
          };
          this.cargarSesionesUsuarios(nombre, this.modoTrabajo);
          this.iniciarRefrescoUsuarios();
          this.cdr.detectChanges();
        }
      },
      error: () => alert('No se pudo pausar la sesión del usuario.')
    });
  }

  private calcularSegundosDesdePaquete(paquete: PaqueteAnalistaGuardado): number {
    const acumuladoMs = Number(paquete.tiempoAcumuladoMs ?? ((paquete.segundos || 0) * 1000));
    if (paquete.corriendo && paquete.inicioCronometroMs) {
      return Math.floor((acumuladoMs + (Date.now() - Number(paquete.inicioCronometroMs))) / 1000);
    }
    return Math.floor(acumuladoMs / 1000);
  }

  private actualizarEstadoCronometroDesdePaquete(paquete: PaqueteAnalistaGuardado) {
    this.tiempoAcumuladoMs = Number(paquete.tiempoAcumuladoMs ?? ((paquete.segundos || 0) * 1000));
    this.inicioCronometroMs = null;
    this.corriendo = false;
    this.segundos = Math.floor(this.tiempoAcumuladoMs / 1000);
  }

  private pausarCronometroActual() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.corriendo && this.inicioCronometroMs !== null) {
      this.tiempoAcumuladoMs += Date.now() - this.inicioCronometroMs;
    }
    this.inicioCronometroMs = null;
    this.corriendo = false;
    this.segundos = Math.floor(this.tiempoAcumuladoMs / 1000);
  }

  private guardarPaqueteEnLocal(nombre: string, paquete: PaqueteAnalistaGuardado) {
    const paquetes = this.obtenerPaquetesGuardados();
    paquetes[nombre] = paquete;
    this.guardarPaquetesGuardados(paquetes);
    localStorage.setItem('paqueteAnalistaActivo', nombre);
  }

  private estadoCompartidoPaqueteActual(): 'SIN INICIAR' | 'EN PROCESO' | 'ENTREGADO' {
    if (this.sesionFinIso || this.paqueteBloqueadoEdicion) return 'ENTREGADO';
    if (this.paqueteAnalistaActivo) return 'EN PROCESO';
    return 'SIN INICIAR';
  }

  guardarPaqueteActual() {
    const paquete = this.capturarPaqueteActual();
    if (!paquete) return;

    this.guardarPaqueteEnLocal(paquete.paqueteAnalistaNombre, paquete);

    const datosBackend = {
      nombre: paquete.paqueteAnalistaNombre,
      tipo_paquete: 'GENERAL',
      configuracion: {
        ...paquete,
        paqueteAnalistaNombre: undefined,
        tipoPaquete: undefined,
        estadoPaquete: this.estadoCompartidoPaqueteActual()
      }
    };

    datosBackend.configuracion.bloqueadoEdicion = this.paqueteBloqueadoEdicion;

    this.http.post(`${this.baseUrl}/paquetes-analista`, datosBackend).subscribe({
      next: () => {
        console.log('Paquete sincronizado con el backend');
      },
      error: (err: any) => {
        console.warn('No se pudo sincronizar el paquete con backend:', err);
      }
    });
  }

  private guardarPaqueteEnBackend() {
    const paquete = this.capturarPaqueteActual();
    if (!paquete) return;
    const paqueteLocal = this.obtenerPaquetesGuardados()[paquete.paqueteAnalistaNombre];

    const datosBackend = {
      nombre: paquete.paqueteAnalistaNombre,
      tipo_paquete: 'GENERAL',
      expected_updated_at: paqueteLocal?.backendUpdatedAt || null,
      configuracion: {
        ...paquete,
        paqueteAnalistaNombre: undefined,
        tipoPaquete: undefined,
        estadoPaquete: this.estadoCompartidoPaqueteActual()
      }
    };

    this.http.post(`${this.baseUrl}/paquetes-analista`, datosBackend).subscribe({
      next: (res: any) => {
        const updatedAt = res?.updated_at || null;
        if (updatedAt) {
          const paquetes = this.obtenerPaquetesGuardados();
          const nombre = paquete.paqueteAnalistaNombre;
          if (paquetes[nombre]) {
            paquetes[nombre].backendUpdatedAt = updatedAt;
            this.guardarPaquetesGuardados(paquetes);
          }
        }
        console.log('Paquete guardado en el backend');
      },
      error: (err: any) => {
        if (err?.status === 409 && err?.error?.paquete) {
          alert(err?.error?.message || 'Otro usuario modificó este paquete. Se cargará la versión más reciente.');
          const paqueteServidor = this.convertirPaqueteBackendAPaqueteGuardado(err.error.paquete);
          const paquetes = this.obtenerPaquetesGuardados();
          paquetes[paqueteServidor.paqueteAnalistaNombre] = paqueteServidor;
          this.guardarPaquetesGuardados(paquetes);
          if (this.paqueteAnalistaNombre === paqueteServidor.paqueteAnalistaNombre) {
            this.aplicarPaqueteGuardado(paqueteServidor.paqueteAnalistaNombre, paqueteServidor, paqueteServidor.modoTrabajo);
            this.paqueteBloqueadoEdicion = false;
            this.cdr.detectChanges();
          }
          return;
        }
        console.warn('No se pudo guardar paquete en backend:', err);
      }
    });
  }

  private convertirPaqueteBackendAPaqueteGuardado(paquete: any): PaqueteAnalistaGuardado {
    const nombre = (paquete?.nombre || '').trim();
    const configuracion = paquete?.configuracion || {};
    const sesionFinIso = configuracion?.sesionFinIso ?? null;
    const bloqueadoEdicion = Boolean(configuracion?.bloqueadoEdicion);
    return {
      paqueteAnalistaNombre: nombre,
      tipoPaquete: 'GENERAL',
      backendUpdatedAt: paquete?.updated_at || null,
      estadoPaquete: (sesionFinIso || bloqueadoEdicion)
        ? 'ENTREGADO'
        : ((configuracion?.estadoPaquete || configuracion?.estado_paquete || 'SIN INICIAR') as any),
      sesionFinIso,
      bloqueadoEdicion,
      ...(configuracion || {})
    };
  }

  private aplicarPaqueteGuardado(nombre: string, paquete: PaqueteAnalistaGuardado, modoPreferido?: ModoTrabajo) {
    const tipo = this.normalizarTipoPaquete(paquete.tipoPaquete, paquete);
    const modoInicial: ModoTrabajo = 'GENERAL';

    this.paqueteAnalistaNombre = paquete.paqueteAnalistaNombre;
    this.paqueteAnalistaCantidadPromos = paquete.paqueteAnalistaCantidadPromos;
    this.nombreLote = paquete.nombreLote || paquete.paqueteAnalistaNombre;
    this.nombrePaqueteEspecifico = paquete.nombrePaqueteEspecifico || paquete.paqueteAnalistaNombre;
    this.modoTrabajo = modoInicial;
    this.nuevoPaqueteTipo = tipo;
    this.modoRepartoGeneral = paquete.modoRepartoGeneral === 'MANUAL' ? 'MANUAL' : 'PROMEDIO';
    this.repartoFijado = Boolean(paquete.repartoFijado ?? false);
    this.participantesFijados = Boolean(paquete.participantesFijados ?? false);
    this.idsSeleccionados = [...(paquete.idsSeleccionados || [])];
    this.unidadesLoteGeneral = Number(paquete.unidadesLoteGeneral ?? paquete.paqueteAnalistaCantidadPromos ?? 0);
    this.unidadesPorUsuarioGeneral = { ...(paquete.unidadesPorUsuarioGeneral || {}) };
    this.unidadesLoteGeneralFijado = Boolean(paquete.unidadesLoteGeneralFijado ?? (this.unidadesLoteGeneral > 0));
    this.tiposPromocionesSeleccionadas = Array.isArray(paquete.tiposPromocionesSeleccionadas)
      ? [...paquete.tiposPromocionesSeleccionadas]
      : this.promocionesDisponiblesGeneral.map((promocion: any) => promocion.id);
    this.tiposPromocionesFijadas = Boolean(paquete.tiposPromocionesFijadas ?? this.tiposPromocionesSeleccionadas.length > 0);
    // Modo Específico
    this.participantesFijadosEspecifico = Boolean(paquete.participantesFijadosEspecifico ?? false);
    this.repartoFijadoEspecifico = Boolean(paquete.repartoFijadoEspecifico ?? false);
    this.modoRepartoEspecifico = paquete.modoRepartoEspecifico === 'MANUAL' ? 'MANUAL' : 'PROMEDIO';
    this.idsSeleccionadosEspecifico = [...(paquete.idsSeleccionadosEspecifico || [])];
    this.unidadesPorUsuarioEspecifico = JSON.parse(JSON.stringify(paquete.unidadesPorUsuarioEspecifico || {}));
    this.registroCantidades = JSON.parse(JSON.stringify(paquete.registroCantidades || this.crearMatrizVacia()));
    const estadoPaqueteGuardado = String(paquete.estadoPaquete || '').toUpperCase();
    this.paqueteBloqueadoEdicion = Boolean(
      paquete.bloqueadoEdicion ||
      estadoPaqueteGuardado === 'FINALIZADO' ||
      estadoPaqueteGuardado === 'ENTREGADO' ||
      Boolean(paquete.sesionFinIso)
    );
    this.paqueteAnalistaActivo = true;
    this.cargarSesionPaquete(nombre, this.modoTrabajo, paquete);
    this.cargarSesionesUsuarios(nombre, this.modoTrabajo);
  }

  abrirPaqueteGuardado(nombre: string, modoPreferido?: ModoTrabajo) {
    if (this.paqueteAnalistaNombre.trim()) {
      this.guardarPaqueteActual();
    }

    this.limpiarIntervaloCronometro();
    this.detenerRefrescoUsuarios();

    const paquete = this.obtenerPaquetesGuardados()[nombre];
    if (!paquete) return;
    this.aplicarPaqueteGuardado(nombre, paquete, modoPreferido);
    this.cdr.detectChanges();
    localStorage.setItem('paqueteAnalistaActivo', nombre);
  }

  abrirPaqueteGuardadoEnModo(nombre: string, modo: ModoTrabajo) {
    const modoNorm = (modo === 'GENERAL') ? 'GENERAL' : 'GENERAL';
    this.abrirPaqueteGuardado(nombre, modoNorm);
  }

  cambiarModoTrabajo(modo: ModoTrabajo) {
    if (this.paqueteAnalistaActivo && this.nuevoPaqueteTipo !== modo) {
      alert(`Este paquete es de tipo ${this.nuevoPaqueteTipo}.`);
      return;
    }

    if (this.modoTrabajo === modo) return;
    this.modoTrabajo = modo;

    const nombre = this.paqueteAnalistaNombre.trim();
    if (!nombre) {
      this.sesionesUsuarios = {};
      this.sesionesUsuariosBaseSegundos = {};
      return;
    }

    this.cargarSesionPaquete(nombre, this.modoTrabajo, this.paqueteGuardado(nombre) || undefined);
    this.cargarSesionesUsuarios(nombre, this.modoTrabajo);
    this.guardarPaqueteActual();
  }

  seleccionarPaqueteAdmin(nombre: string) {
    const paquete = (nombre || '').trim();
    if (!paquete) return;
    localStorage.setItem('paqueteAnalistaActivo', paquete);
    this.abrirPaqueteGuardado(paquete);
    alert(`Paquete ${paquete} seleccionado como activo.`);
  }

  iniciarEdicionPaquete(nombre: string) {
    this.paqueteEditandoOriginal = nombre;
    this.paqueteEditandoNombre = nombre;
    this.paqueteEditandoTipo = 'GENERAL';
  }

  cancelarEdicionPaquete() {
    this.paqueteEditandoOriginal = null;
    this.paqueteEditandoNombre = '';
    this.paqueteEditandoTipo = 'GENERAL';
  }

  guardarEdicionPaquete() {
    const original = (this.paqueteEditandoOriginal || '').trim();
    const nuevo = (this.paqueteEditandoNombre || '').trim();
    if (!original) return;
    if (!nuevo) {
      alert('El nombre del paquete no puede estar vacío.');
      return;
    }

    const paquetes = this.obtenerPaquetesGuardados();
    if (!paquetes[original]) {
      this.cancelarEdicionPaquete();
      return;
    }

    if (original !== nuevo && paquetes[nuevo]) {
      alert('Ya existe un paquete con ese nombre.');
      return;
    }

    const tipo = 'GENERAL';
    const configuracion = {
      ...paquetes[original],
      paqueteAnalistaNombre: nuevo,
      nombreLote: nuevo,
      nombrePaqueteEspecifico: nuevo,
      tipoPaquete: tipo,
      modoTrabajo: tipo as ModoTrabajo
    };

    this.http.patch(`${this.baseUrl}/paquetes-analista/${encodeURIComponent(original)}`, {
      nombre: nuevo,
      tipo_paquete: tipo,
      expected_updated_at: paquetes[original].backendUpdatedAt || null,
      configuracion
    }).subscribe({
      next: (res: any) => {
        const paqueteServidor = this.convertirPaqueteBackendAPaqueteGuardado(res?.paquete || {
          nombre: nuevo,
          tipo_paquete: tipo,
          configuracion,
          updated_at: res?.updated_at || null
        });

        const paquetesActualizados = this.obtenerPaquetesGuardados();
        delete paquetesActualizados[original];
        paquetesActualizados[nuevo] = paqueteServidor;
        this.guardarPaquetesGuardados(paquetesActualizados);

        if (localStorage.getItem('paqueteAnalistaActivo') === original) {
          localStorage.setItem('paqueteAnalistaActivo', nuevo);
        }

        if (this.paqueteAnalistaNombre === original) {
          this.paqueteAnalistaNombre = nuevo;
          this.nombreLote = nuevo;
          this.nombrePaqueteEspecifico = nuevo;
          this.nuevoPaqueteTipo = tipo;
          this.modoTrabajo = tipo as ModoTrabajo;
          this.cargarSesionPaquete(nuevo, this.modoTrabajo, paqueteServidor);
          this.cargarSesionesUsuarios(nuevo, this.modoTrabajo);
        }

        this.cancelarEdicionPaquete();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        if (this.manejarNoAutorizadoAdmin(err)) return;
        alert(err?.error?.message || 'No se pudo actualizar el paquete en el backend.');
      }
    });
  }

  eliminarPaqueteAdmin(nombre: string) {
    const paquete = (nombre || '').trim();
    if (!paquete) return;

    const confirmado = confirm(`¿Eliminar el paquete ${paquete}?`);
    if (!confirmado) return;

    this.http.delete(`${this.baseUrl}/paquetes/${encodeURIComponent(paquete)}`, this.adminRequestOptions()).subscribe({
      next: (res: any) => {
        const aliasEliminados = Array.isArray(res?.alias_eliminados) ? res.alias_eliminados : [paquete];
        const paquetes = this.obtenerPaquetesGuardados();
        aliasEliminados.forEach((alias: string) => {
          if (paquetes[alias]) delete paquetes[alias];
        });
        this.guardarPaquetesGuardados(paquetes);

        if (aliasEliminados.includes(localStorage.getItem('paqueteAnalistaActivo') || '')) {
          localStorage.removeItem('paqueteAnalistaActivo');
        }

        if (aliasEliminados.includes(this.paqueteAnalistaNombre)) {
          this.limpiarPaqueteAnalista();
        }

        if (this.rolActual === 'dashboard') {
          this.cargarStatusOpciones();
          this.cargarStatusResumen();
        }
      },
      error: (err: any) => {
        if (this.manejarNoAutorizadoAdmin(err)) return;
        alert(err?.error?.message || 'No se pudo eliminar el paquete en base de datos.');
      }
    });
  }

  restaurarPaqueteActivo() {
    const nombreActivo = localStorage.getItem('paqueteAnalistaActivo');
    if (nombreActivo && this.obtenerPaquetesGuardados()[nombreActivo]) {
      this.abrirPaqueteGuardado(nombreActivo);
    }
  }

  // --- LÓGICA MODO GENERAL PLURAL ---
  toggleSeleccionAnalista(id: number) {
    if (this.paqueteBloqueadoEdicion || this.participantesFijados) return;
    const index = this.idsSeleccionados.indexOf(id);
    if (index > -1) this.idsSeleccionados.splice(index, 1);
    else this.idsSeleccionados.push(id);

    if (!this.idsSeleccionados.includes(id)) {
      delete this.unidadesPorUsuarioGeneral[id];
    } else if (this.unidadesPorUsuarioGeneral[id] === undefined) {
      this.unidadesPorUsuarioGeneral[id] = {};
    }

    if (this.modoRepartoGeneral === 'PROMEDIO') {
      this.recalcularRepartoPromedio();
    }

    this.guardarPaqueteActual();
  }

  fijarParticipantesGeneral() {
    if (this.paqueteBloqueadoEdicion) return;
    if (!Array.isArray(this.idsSeleccionados) || this.idsSeleccionados.length === 0) {
      alert('Selecciona al menos un participante antes de fijar.');
      return;
    }
    this.participantesFijados = true;
    if (this.modoRepartoGeneral === 'PROMEDIO') {
      this.recalcularRepartoPromedio();
    }
    this.guardarPaqueteActual();
  }

  editarParticipantesGeneral() {
    if (this.edicionGeneralBloqueada || this.paqueteEntregadoEnUI) {
      alert('No puedes editar los participantes porque el paquete ya está entregado o el conteo está en curso.');
      return;
    }

    this.participantesFijados = false;
    // Si estamos en modo PROMEDIO, recalcular reparto para actualizar valores al deseditar participantes
    if (this.modoRepartoGeneral === 'PROMEDIO') {
      this.recalcularRepartoPromedio();
    }
    this.guardarPaqueteActual();
  }

  get usuariosSeleccionadosGeneral(): any[] {
    return this.usuarios.filter((u: any) => this.idsSeleccionados.includes(u.id));
  }

  get conteoGeneralIniciado(): boolean {
    return this.usuariosSeleccionadosGeneral.some((u: any) => this.sesionUsuarioActiva(u.id));
  }

  get modoGeneralCompacto(): boolean {
    return this.participantesFijados && this.repartoFijado;
  }

  get mostrarEdicionGeneral(): boolean {
    return this.participantesFijados && this.repartoFijado && !this.conteoGeneralIniciado && !this.paqueteEntregadoEnUI;
  }

  get mostrarInicioConteoGeneral(): boolean {
    return this.participantesFijados && this.repartoFijado && !this.conteoGeneralIniciado && !this.flujoCronometrosGeneralCompleto && !this.paqueteEntregadoEnUI;
  }

  get mostrarEntregaGeneral(): boolean {
    return this.participantesFijados && this.repartoFijado && this.conteoGeneralIniciado && !this.paqueteEntregadoEnUI;
  }

  get edicionGeneralBloqueada(): boolean {
    return this.paqueteEntregadoEnUI || this.conteoGeneralIniciado;
  }

  get usuariosSeleccionadosEspecifico(): any[] {
    return this.usuarios.filter((u: any) => this.idsSeleccionadosEspecifico.includes(u.id));
  }

  obtenerUsuarioPorId(id: number): any {
    return this.usuarios.find((u: any) => u.id === id);
  }

  get totalAsignadoGeneral(): number {
    return this.idsSeleccionados.reduce((acc, id) => acc + this.obtenerPromosAsignadasGeneral(id), 0);
  }

  get segundosAcumuladosSeleccionadosGeneral(): number {
    const ahora = Date.now();
    if (!this._segundosAcumuladosSeleccionadosCache || (ahora - this._segundosAcumuladosSeleccionadosCache.ts) > 900) {
      if (!Array.isArray(this.idsSeleccionados) || this.idsSeleccionados.length === 0) {
        this._segundosAcumuladosSeleccionadosCache = { ts: ahora, val: 0 };
      } else {
        const val = this.idsSeleccionados.reduce((acc, id) => acc + this.obtenerSegundosSesionUsuario(id), 0);
        this._segundosAcumuladosSeleccionadosCache = { ts: ahora, val };
      }
    }
    return this._segundosAcumuladosSeleccionadosCache.val;
  }

  private _segundosAcumuladosSeleccionadosCache: { ts: number; val: number } | null = null;

  get promocionesRestantesGeneral(): number {
    return Math.max(0, Number(this.unidadesLoteGeneral || 0) - this.totalAsignadoGeneral);
  }

  get totalPromocionesGeneralFijado(): boolean {
    return this.unidadesLoteGeneralFijado && Number(this.unidadesLoteGeneral || 0) > 0;
  }

  toggleTotalPromocionesGeneralFijado() {
    if (this.paqueteBloqueadoEdicion) return;
    if (!Number(this.unidadesLoteGeneral || 0)) return;
    this.unidadesLoteGeneralFijado = !this.unidadesLoteGeneralFijado;
    this.guardarPaqueteActual();
  }

  get pasoGeneralParticipantesHabilitado(): boolean {
    return Number(this.paqueteAnalistaCantidadPromos || 0) > 0;
  }

  get pasoGeneralTiposHabilitado(): boolean {
    return this.participantesFijados && this.pasoGeneralParticipantesHabilitado;
  }

  get promocionesDisponiblesGeneral(): any[] {
    return Array.isArray(this.configuracionPromos) ? this.configuracionPromos : [];
  }

  get promocionesSeleccionadasGeneral(): any[] {
    const seleccionadas = new Set((this.tiposPromocionesSeleccionadas || []).map((valor) => Number(valor)));
    return this.promocionesDisponiblesGeneral.filter((promocion: any) => seleccionadas.has(Number(promocion.id)));
  }

  obtenerPromosAsignadasGeneral(usuarioId: number): number {
    return this.promocionesSeleccionadasGeneral.reduce((total, promo: any) => {
      return total + Number(this.unidadesPorUsuarioGeneral[usuarioId]?.[promo.id] || 0);
    }, 0);
  }

  obtenerTiempoProgramacionUsuario(usuarioId: number): number {
    // Retorna minutos programados para un usuario en base a las unidades asignadas por promo
    const u = this.usuarios?.find((usr: any) => usr.id === usuarioId) || null;
    if (!u) return 0;
    return this.promocionesSeleccionadasGeneral.reduce((acc: number, promo: any) => {
      const unidades = Number(this.unidadesPorUsuarioGeneral[usuarioId]?.[promo.id] || 0);
      const tiempoPromoMin = Number(u?.config_tiempos?.[promo.id] ?? promo.tiempo_minutos ?? 0);
      return acc + (unidades * tiempoPromoMin);
    }, 0);
  }

  obtenerDetalleTiempoUsuario(usuarioId: number): Array<{ promoId: number; promoNombre: string; unidades: number; tiempoMin: number; subtotalMin: number }> {
    const u = this.usuarios?.find((usr: any) => usr.id === usuarioId) || null;
    if (!u) return [];
    return this.promocionesSeleccionadasGeneral.map((promo: any) => {
      const unidades = Number(this.unidadesPorUsuarioGeneral[usuarioId]?.[promo.id] || 0);
      const tiempoPromoMin = Number(u?.config_tiempos?.[promo.id] ?? promo.tiempo_minutos ?? 0);
      return {
        promoId: promo.id,
        promoNombre: promo.nombre || String(promo.id),
        unidades,
        tiempoMin: tiempoPromoMin,
        subtotalMin: unidades * tiempoPromoMin
      };
    }).filter((d: any) => d.unidades > 0);
  }

  private inicializarMatrizRepartoGeneral() {
    this.idsSeleccionados.forEach((usuarioId) => {
      if (!this.unidadesPorUsuarioGeneral[usuarioId]) this.unidadesPorUsuarioGeneral[usuarioId] = {};
      this.promocionesSeleccionadasGeneral.forEach((promo: any) => {
        if (this.unidadesPorUsuarioGeneral[usuarioId][promo.id] === undefined) {
          this.unidadesPorUsuarioGeneral[usuarioId][promo.id] = 0;
        }
      });
    });
  }

  get pasoGeneralRepartoHabilitado(): boolean {
    return this.pasoGeneralTiposHabilitado && this.tiposPromocionesFijadas && this.idsSeleccionados.length > 0;
  }

  toggleTipoPromocionGeneral(promoId: number) {
    if (this.paqueteBloqueadoEdicion || this.tiposPromocionesFijadas) return;

    const id = Number(promoId);
    if (!Number.isFinite(id)) return;

    const index = this.tiposPromocionesSeleccionadas.indexOf(id);
    if (index > -1) {
      this.tiposPromocionesSeleccionadas.splice(index, 1);
    } else {
      this.tiposPromocionesSeleccionadas.push(id);
    }

    this.idsSeleccionados.forEach((usuarioId) => {
      if (!this.unidadesPorUsuarioGeneral[usuarioId]) this.unidadesPorUsuarioGeneral[usuarioId] = {};
      if (index > -1) delete this.unidadesPorUsuarioGeneral[usuarioId][id];
      else this.unidadesPorUsuarioGeneral[usuarioId][id] = 0;
    });

    this.guardarPaqueteActual();
  }

  fijarTiposPromocionesGeneral() {
    if (this.paqueteBloqueadoEdicion) return;
    if (!this.tiposPromocionesSeleccionadas.length) {
      alert('Selecciona al menos un tipo de promoción antes de fijar.');
      return;
    }

    this.tiposPromocionesFijadas = true;
  this.inicializarMatrizRepartoGeneral();
  if (this.modoRepartoGeneral === 'PROMEDIO') this.recalcularRepartoPromedio();
    this.guardarPaqueteActual();
  }

  editarTiposPromocionesGeneral() {
    if (this.paqueteBloqueadoEdicion || this.conteoGeneralIniciado) {
      alert('No puedes editar los tipos mientras el conteo está en curso o el paquete está bloqueado.');
      return;
    }

    this.tiposPromocionesFijadas = false;
    this.guardarPaqueteActual();
  }

  get estadoComparativoGeneral(): Array<{ id: number; nombre: string; promos: number; meta: number; real: number; delta: number }> {
    const ahora = Date.now();
    if (!this._estadoComparativoCache || (ahora - this._estadoComparativoCache.ts) > 900) {
      const result = this.usuariosSeleccionadosGeneral.map((u: any) => {
        const promos = this.obtenerPromosAsignadasGeneral(u.id);
        const meta = this.obtenerTiempoProgramacionUsuario(u.id);
        const real = this.obtenerSegundosSesionUsuario(u.id) / 60;
        const delta = real - meta;
        return { id: u.id, nombre: u.nombre, promos, meta, real, delta };
      });
      this._estadoComparativoCache = { ts: ahora, val: result };
    }
    return this._estadoComparativoCache.val;
  }

  private _estadoComparativoCache: { ts: number; val: Array<{ id: number; nombre: string; promos: number; meta: number; real: number; delta: number }> } | null = null;

  setModoRepartoGeneral(modo: 'PROMEDIO' | 'MANUAL') {
    if (this.paqueteBloqueadoEdicion || this.repartoFijado) return;
    this.modoRepartoGeneral = modo;
    if (modo === 'PROMEDIO') {
      this.recalcularRepartoPromedio();
    } else {
      // En MANUAL: reiniciar con 0 para que edite manualmente
      this.unidadesPorUsuarioGeneral = {};
      this.inicializarMatrizRepartoGeneral();
    }
    this.guardarPaqueteActual();
  }

  onUnidadesTotalesGeneralChange() {
    if (this.paqueteBloqueadoEdicion) return;
    let total = Number(this.unidadesLoteGeneral || 0);
    if (!Number.isFinite(total) || total < 0) total = 0;
    total = Math.floor(total);
    this.unidadesLoteGeneral = total;

    // AHORA: Siempre recalcula automáticamente (modo PROMEDIO fijo)
    this.recalcularRepartoPromedio();

    this.guardarPaqueteActual();
  }

  onUnidadesUsuarioGeneralChange(usuarioId: number, promocionId: number, valorRecibido: any) {
    if (this.paqueteBloqueadoEdicion || this.repartoFijado) return;
    if (!this.unidadesPorUsuarioGeneral[usuarioId]) this.unidadesPorUsuarioGeneral[usuarioId] = {};
    const valorAnterior = Number(this.unidadesPorUsuarioGeneral[usuarioId][promocionId] || 0);
    let valor = Number(valorRecibido || 0);
    if (!Number.isFinite(valor) || valor < 0) valor = 0;
    valor = Math.floor(valor);
    this.unidadesPorUsuarioGeneral[usuarioId][promocionId] = valor;

    if (this.modoRepartoGeneral !== 'MANUAL') return;

    const total = this.totalAsignadoGeneral;
    const totalObjetivo = Number(this.paqueteAnalistaCantidadPromos || this.unidadesLoteGeneral || 0);
    if (total > totalObjetivo) {
      const exceso = total - totalObjetivo;
      this.unidadesPorUsuarioGeneral[usuarioId][promocionId] = Math.max(0, valor - exceso);
    }
    this.guardarPaqueteActual();
  }

  fijarReportoGeneral() {
    if (this.paqueteBloqueadoEdicion) return;
    const total = this.totalAsignadoGeneral;
    const objetivo = Number(this.paqueteAnalistaCantidadPromos || 0);
    if (total > objetivo) {
      alert(`No se puede fijar. Has asignado ${total} promociones, pero el paquete permite ${objetivo}. Reduce las asignaciones antes de continuar.`);
      return;
    }
    if (total < objetivo) {
      alert('No se puede fijar. Todas las promociones deben estar asignadas.');
      return;
    }
    // La distribución solo debe validarse por el total del lote: cada promoción puede aparecer en 0
    // para algunos usuarios siempre que la suma total del paquete esté completa.
    this.repartoFijado = true;
    this.guardarPaqueteActual();
  }

  editarRepartoGeneral() {
    if (this.edicionGeneralBloqueada || this.paqueteEntregadoEnUI) {
      alert('No puedes editar el reparto porque el paquete ya está entregado o el conteo está en curso.');
      return;
    }

    this.repartoFijado = false;
    // Al des-fijar el reparto, si el modo es automático (PROMEDIO) recalculamos inmediatamente
    if (this.modoRepartoGeneral === 'PROMEDIO') {
      this.recalcularRepartoPromedio();
    }
    this.guardarPaqueteActual();
  }

  // El editor inline/modal de tipos fue eliminado; use `irAPaso2Tipos()` para editar tipos en el flujo del paquete.

  irAPaso2Tipos() {
    // Mantener rol actual (analista). Intentar abrir el Paso 2 del flujo del paquete.
    if (this.modoTrabajo === 'GENERAL') {
      if (!this.participantesFijados) {
        alert('Primero fija participantes en el Paso 1 antes de editar los tipos.');
        return;
      }
      // Des-fijar los tipos para permitir edición en Paso 2
      if (this.paqueteBloqueadoEdicion || this.conteoGeneralIniciado) {
        alert('No puedes editar los tipos mientras el paquete está bloqueado o el conteo está en curso.');
        return;
      }
      this.tiposPromocionesFijadas = false;
      this.guardarPaqueteActual();
      // Scroll suave hacia el Paso 2
      setTimeout(() => {
        const el = document.getElementById('analista-paso-2');
        if (el && typeof el.scrollIntoView === 'function') {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
        }
      }, 80);
      return;
    }

    // Fallback: si no es GENERAL, intentar mostrar aviso y no cambiar de rol
    alert('Ir al Paso 2 sólo está disponible en el modo GENERAL. Cambia a modo general para editar los tipos del paquete.');
  }

  // --- MODO ESPECÍFICO (ANÁLOGO AL GENERAL) ---
  
  toggleUsuarioEspecifico(userId: number) {
    if (this.paqueteBloqueadoEdicion || this.participantesFijadosEspecifico) return;
    const index = this.idsSeleccionadosEspecifico.indexOf(userId);
    if (index > -1) {
      this.idsSeleccionadosEspecifico.splice(index, 1);
      delete this.unidadesPorUsuarioEspecifico[userId];
    } else {
      this.idsSeleccionadosEspecifico.push(userId);
      this.unidadesPorUsuarioEspecifico[userId] = {};
      this.configuracionPromos.forEach((p: any) => {
        this.unidadesPorUsuarioEspecifico[userId][p.id] = 0;
      });
    }
    this.guardarPaqueteActual();
  }

  fijarParticipantesEspecifico() {
    if (this.paqueteBloqueadoEdicion) return;
    if (!Array.isArray(this.idsSeleccionadosEspecifico) || this.idsSeleccionadosEspecifico.length === 0) {
      alert('Selecciona al menos un analista antes de fijar.');
      return;
    }
    this.participantesFijadosEspecifico = true;
    // Inicializar modo reparto si no estaba
    if (this.modoRepartoEspecifico !== 'MANUAL' && this.modoRepartoEspecifico !== 'PROMEDIO') {
      this.modoRepartoEspecifico = 'PROMEDIO';
    }
    // Inicializar matriz de reparto si está vacía
    if (!Object.keys(this.unidadesPorUsuarioEspecifico).length) {
      this.recalcularRepartoPromedioEspecifico();
    }
    this.guardarPaqueteActual();
  }

  setModoRepartoEspecifico(modo: 'PROMEDIO' | 'MANUAL') {
    if (this.paqueteBloqueadoEdicion || this.repartoFijadoEspecifico) return;
    this.modoRepartoEspecifico = modo;
    if (modo === 'PROMEDIO') {
      this.recalcularRepartoPromedioEspecifico();
    } else {
      // En MANUAL: reiniciar con 0 para que edite manualmente
      this.idsSeleccionadosEspecifico.forEach((id) => {
        this.unidadesPorUsuarioEspecifico[id] = {};
        this.configuracionPromos.forEach((p: any) => {
          this.unidadesPorUsuarioEspecifico[id][p.id] = 0;
        });
      });
    }
    this.guardarPaqueteActual();
  }

  get conteoEspecificoIniciado(): boolean {
    return this.usuariosSeleccionadosEspecifico.some((u: any) => this.sesionUsuarioActiva(u.id));
  }

  get flujoCronometrosEspecificoCompleto(): boolean {
    if (!Array.isArray(this.idsSeleccionadosEspecifico) || this.idsSeleccionadosEspecifico.length === 0) return false;
    return this.idsSeleccionadosEspecifico.every((id) => {
      const sesion = this.obtenerSesionUsuario(id);
      return Boolean(sesion?.started_at) && Boolean(sesion?.ended_at) && Boolean(sesion?.finalizado);
    });
  }

  get mostrarInicioConteoEspecifico(): boolean {
    return this.participantesFijadosEspecifico && this.repartoFijadoEspecifico && !this.conteoEspecificoIniciado && !this.flujoCronometrosEspecificoCompleto && !this.paqueteEntregadoEnUI;
  }

  get mostrarEdicionEspecifico(): boolean {
    return this.participantesFijadosEspecifico && this.repartoFijadoEspecifico && !this.conteoEspecificoIniciado && !this.paqueteEntregadoEnUI;
  }

  get edicionEspecificoBloqueada(): boolean {
    return this.paqueteEntregadoEnUI || this.conteoEspecificoIniciado;
  }

  editarParticipantesEspecifico() {
    if (this.edicionEspecificoBloqueada || this.paqueteEntregadoEnUI) {
      alert('No puedes editar los participantes porque el paquete ya está entregado o el conteo está en curso.');
      return;
    }

    this.participantesFijadosEspecifico = false;
    this.repartoFijadoEspecifico = false;
    this.guardarPaqueteActual();
  }

  editarRepartoEspecifico() {
    if (this.edicionEspecificoBloqueada || this.paqueteEntregadoEnUI) {
      alert('No puedes editar el reparto porque el paquete ya está entregado o el conteo está en curso.');
      return;
    }

    this.repartoFijadoEspecifico = false;
    this.guardarPaqueteActual();
  }

  actualizarDistribucionEspecifica(usuarioId: number, promocionId: number, valor: any) {
    if (this.paqueteBloqueadoEdicion || this.repartoFijadoEspecifico) return;

    if (!this.unidadesPorUsuarioEspecifico[usuarioId]) {
      this.unidadesPorUsuarioEspecifico[usuarioId] = {};
    }

    const cantidadAnterior = Number(this.unidadesPorUsuarioEspecifico[usuarioId]?.[promocionId] || 0);
    let cantidadNueva = Number(valor || 0);
    if (!Number.isFinite(cantidadNueva) || cantidadNueva < 0) cantidadNueva = 0;
    cantidadNueva = Math.floor(cantidadNueva);

    this.unidadesPorUsuarioEspecifico[usuarioId][promocionId] = cantidadNueva;

    const totalObjetivo = Math.max(0, Math.floor(Number(this.paqueteAnalistaCantidadPromos || 0)));
    if (totalObjetivo > 0 && this.totalAsignadoEspecifico > totalObjetivo) {
      this.unidadesPorUsuarioEspecifico[usuarioId][promocionId] = cantidadAnterior;
      alert(`Te excediste. Solo puedes asignar ${totalObjetivo} promociones en total.`);
      return;
    }

    this.guardarPaqueteActual();
  }

  private recalcularRepartoPromedioEspecifico() {
    const cantidad = this.idsSeleccionadosEspecifico.length;
    if (cantidad === 0) return;

    const totalPromos = this.configuracionPromos.length;
    const totalObjetivo = Math.max(0, Math.floor(Number(this.paqueteAnalistaCantidadPromos || 0)));

    this.idsSeleccionadosEspecifico.forEach((id) => {
      this.unidadesPorUsuarioEspecifico[id] = {};
      this.configuracionPromos.forEach((p: any) => {
        this.unidadesPorUsuarioEspecifico[id][p.id] = 0;
      });
    });

    if (totalPromos === 0 || totalObjetivo === 0) return;

    let restantes = totalObjetivo;
    let indice = 0;
    while (restantes > 0) {
      const userId = this.idsSeleccionadosEspecifico[indice % cantidad];
      const promo = this.configuracionPromos[Math.floor(indice / cantidad) % totalPromos];
      this.unidadesPorUsuarioEspecifico[userId][promo.id] = (this.unidadesPorUsuarioEspecifico[userId][promo.id] || 0) + 1;
      restantes--;
      indice++;
    }
  }

  get totalAsignadoEspecifico(): number {
    if (!Array.isArray(this.idsSeleccionadosEspecifico) || !Array.isArray(this.configuracionPromos)) return 0;

    return this.idsSeleccionadosEspecifico.reduce((total, userId) => {
      return total + this.configuracionPromos.reduce((subtotal: number, promo: any) => {
        return subtotal + Number(this.unidadesPorUsuarioEspecifico[userId]?.[promo.id] || 0);
      }, 0);
    }, 0);
  }

  get promocionesRestantesEspecifico(): number {
    return Math.max(0, Number(this.paqueteAnalistaCantidadPromos || 0) - this.totalAsignadoEspecifico);
  }

  fijarRepartoEspecifico() {
    if (this.paqueteBloqueadoEdicion) return;
    const totalObjetivo = Math.max(0, Math.floor(Number(this.paqueteAnalistaCantidadPromos || 0)));

    if (totalObjetivo <= 0) {
      alert('Define primero cuántas promociones tendrá el paquete.');
      return;
    }

    if (this.totalAsignadoEspecifico !== totalObjetivo) {
      alert(`No se puede fijar. Debes asignar ${totalObjetivo} promociones en total antes de guardar.`);
      return;
    }

    this.repartoFijadoEspecifico = true;
    this.guardarPaqueteActual();
  }

  private recalcularRepartoPromedio() {
    const cantidad = this.idsSeleccionados.length;
    this.unidadesPorUsuarioGeneral = {};

    if (cantidad === 0) return;

    const promociones = this.promocionesSeleccionadasGeneral;
    const total = Math.max(0, Math.floor(Number(this.paqueteAnalistaCantidadPromos || this.unidadesLoteGeneral || 0)));
    this.inicializarMatrizRepartoGeneral();
    if (promociones.length === 0 || total === 0) return;

    let restantes = total;
    let indice = 0;
    while (restantes > 0) {
      const usuarioId = this.idsSeleccionados[indice % cantidad];
      const promo = promociones[Math.floor(indice / cantidad) % promociones.length];
      this.unidadesPorUsuarioGeneral[usuarioId][promo.id]++;
      restantes--;
      indice++;
    }
  }

  get metaGeneralPlural(): number {
    if (this.idsSeleccionados.length === 0) return 0;
    return this.idsSeleccionados.reduce((acc, id) => {
      return acc + this.obtenerTiempoProgramacionUsuario(id);
    }, 0);
  }

  get flujoCronometrosGeneralCompleto(): boolean {
    if (!Array.isArray(this.idsSeleccionados) || this.idsSeleccionados.length === 0) return false;
    return this.idsSeleccionados.every((id) => {
      const sesion = this.obtenerSesionUsuario(id);
      return Boolean(sesion?.started_at) && Boolean(sesion?.ended_at) && Boolean(sesion?.finalizado);
    });
  }

  private calcularRendimientoConSigno(metaMin: number, realMin: number): number {
    const meta = Number(metaMin || 0);
    const real = Number(realMin || 0);
    if (real <= 0) return meta > 0 ? 100 : 0;
    const raw = ((meta - real) / real) * 100;
    const clamped = Math.max(-100, Math.min(100, raw));
    return clamped;
  }

  iniciarSesionPaquete() {
    const nombre = this.paqueteAnalistaNombre.trim();
    if (!nombre) {
      alert('Define el nombre del paquete antes de iniciar la sesión.');
      return;
    }

    this.iniciarSesionBackend(nombre).subscribe({
      next: (res: any) => {
        this.paqueteAnalistaActivo = true;
        this.aplicarSesionRespuesta(res?.sesion || null);
        this.guardarPaqueteActual();
        this.cdr.detectChanges();
      },
      error: () => alert('No se pudo iniciar la sesión del paquete.')
    });
  }

  finalizarSesionPaquete() {
    const nombre = this.paqueteAnalistaNombre.trim();
    if (!nombre) {
      alert('Define el nombre del paquete antes de finalizar la sesión.');
      return;
    }

    const confirmar = confirm(`¿Seguro que deseas finalizar el conteo del paquete ${nombre}?`);
    if (!confirmar) return;

    this.finalizarSesionBackend(nombre).subscribe({
      next: (res: any) => {
        this.aplicarSesionRespuesta(res?.sesion || null);
        this.guardarPaqueteActual();
        this.cdr.detectChanges();
      },
      error: () => alert('No se pudo finalizar la sesión del paquete.')
    });
  }

  activarPaqueteAnalista(tipo: ModoTrabajo, nombre: string, cantidadPromos: number | null) {
    const nombreLimpio = (nombre || '').trim();
    const cantidad = Number(cantidadPromos || 0);

    if (!nombreLimpio) {
      alert('Debes ingresar el nombre del paquete antes de continuar.');
      return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      alert('Debes indicar cuántas promociones tendrá el paquete.');
      return;
    }

    const confirmar = confirm(
      `Vas a crear el paquete ${nombreLimpio} con ${cantidad} promociones.\n\n` +
      'Ese dato quedará fijo dentro del paquete y no podrá editarse desde el flujo interno.\n\n' +
      '¿Deseas continuar?'
    );
    if (!confirmar) return;

    this.nuevoPaqueteTipo = 'GENERAL';
    this.paqueteAnalistaNombre = nombreLimpio;
    this.modoTrabajo = 'GENERAL';
    this.nombreLote = nombreLimpio;
    this.nombrePaqueteEspecifico = nombreLimpio;
    this.modoRepartoGeneral = 'PROMEDIO';
    this.unidadesPorUsuarioGeneral = {};
    this.paqueteAnalistaCantidadPromos = cantidad;
    this.unidadesLoteGeneral = cantidad;
    this.unidadesLoteGeneralFijado = true;
    this.tiposPromocionesSeleccionadas = this.promocionesDisponiblesGeneral.map((promocion: any) => promocion.id);
    this.tiposPromocionesFijadas = false;
    this.paqueteAnalistaActivo = true;
    if (!Object.keys(this.registroCantidades || {}).length) {
      this.registroCantidades = this.crearMatrizVacia();
    }
    this.limpiarIntervaloCronometro();
    this.detenerRefrescoUsuarios();
    this.corriendo = false;
    this.tiempoAcumuladoMs = 0;
    this.inicioCronometroMs = null;
    this.sesionId = null;
    this.sesionInicioIso = null;
    this.sesionFinIso = null;
    this.sesionDuracionSegundos = 0;
    this.sesionesUsuarios = {};
    this.sesionesUsuariosBaseSegundos = {};
    this.paqueteBloqueadoEdicion = false;
    this.unidadesLoteGeneralFijado = false;
    this.participantesFijados = false;
    this.guardarPaqueteActual();
  }

  limpiarPaqueteAnalista() {
    this.guardarPaqueteActual();
    this.limpiarIntervaloCronometro();
    this.detenerRefrescoUsuarios();
    this.paqueteAnalistaNombre = '';
    this.paqueteAnalistaCantidadPromos = null;
    this.nuevoPaqueteGeneralNombre = '';
    this.nuevoPaqueteGeneralCantidadPromos = 0;
    this.nuevoPaqueteEspecificoNombre = '';
    this.nuevoPaqueteEspecificoCantidadPromos = 0;
    this.nuevoPaqueteTipo = 'GENERAL';
    this.paqueteAnalistaActivo = false;
    this.nombreLote = '';
    this.nombrePaqueteEspecifico = '';
    this.modoTrabajo = 'GENERAL';
    this.idsSeleccionados = [];
    this.modoRepartoGeneral = 'PROMEDIO';
    this.repartoFijado = false;
    this.participantesFijados = false;
    this.unidadesPorUsuarioGeneral = {};
    this.unidadesLoteGeneral = 0;
    this.unidadesLoteGeneralFijado = false;
    this.tiposPromocionesSeleccionadas = [];
    this.tiposPromocionesFijadas = false;
    // Modo Específico
    this.idsSeleccionadosEspecifico = [];
    this.participantesFijadosEspecifico = false;
    this.repartoFijadoEspecifico = false;
    this.modoRepartoEspecifico = 'PROMEDIO';
    this.unidadesPorUsuarioEspecifico = {};
    this.segundos = 0;
    this.tiempoAcumuladoMs = 0;
    this.inicioCronometroMs = null;
    this.corriendo = false;
    this.sesionId = null;
    this.sesionInicioIso = null;
    this.sesionFinIso = null;
    this.sesionDuracionSegundos = 0;
    this.sesionesUsuarios = {};
    this.sesionesUsuariosBaseSegundos = {};
    this.paqueteBloqueadoEdicion = false;
    this.registroCantidades = this.crearMatrizVacia();
    localStorage.removeItem('paqueteAnalistaActivo');
  }

  volverASeleccionPaquetes() {
    this.limpiarPaqueteAnalista();
  }

  finalizarLoteGeneral() {
    if (this.paqueteBloqueadoEdicion) {
      alert('El paquete ya está guardado y bloqueado. Usa REINICIAR PAQUETE para volver a hacerlo.');
      return;
    }

    if (!this.paqueteAnalistaActivo || !this.nombreLote.trim()) {
      alert('Ingresa el nombre del paquete general antes de guardar.');
      return;
    }

    if (this.idsSeleccionados.length === 0) {
      alert('Selecciona al menos un analista para guardar el lote.');
      return;
    }

    if (!this.flujoCronometrosGeneralCompleto) {
      alert('Para guardar el lote, cada analista seleccionado debe completar el flujo: INICIAR y luego FINALIZAR su cronómetro.');
      return;
    }

    if (!this.repartoFijado) {
      alert('Primero debes fijar el reparto de promociones.');
      return;
    }

    const totalDeclarado = Number(this.unidadesLoteGeneral || 0);

    let totalParaGuardar = totalDeclarado;

    const tiemposRealesPorUsuario: any = {};
    const tiemposMetaPorUsuario: any = {};
    const unidadesPorUsuario: any = {};

    this.idsSeleccionados.forEach((id) => {
      const usuario = this.usuarios.find((u: any) => u.id === id);
      const unidades = this.obtenerPromosAsignadasGeneral(id);
      unidadesPorUsuario[id] = unidades;
      tiemposMetaPorUsuario[id] = this.obtenerTiempoProgramacionUsuario(id);
      tiemposRealesPorUsuario[id] = this.obtenerSegundosSesionUsuario(id) / 60;
    });

    const tiempoRealTotalMin = this.idsSeleccionados.reduce((acc, id) => acc + (tiemposRealesPorUsuario[id] || 0), 0);

    const data = {
      analista_ids: this.idsSeleccionados,
      nombre_paquete: this.nombreLote,
      modo: 'GENERAL',
      unidades_general: totalParaGuardar,
      tiempo_meta: this.metaGeneralPlural,
      tiempo_real: tiempoRealTotalMin,
      unidades_por_usuario: unidadesPorUsuario,
      tiempos_meta_por_usuario: tiemposMetaPorUsuario,
      tiempos_reales_por_usuario: tiemposRealesPorUsuario
    };
    this.http.post(`${this.baseUrl}/guardar-reporte-plural`, data).subscribe((res: any) => {
      alert(`Guardado con éxito. Rendimiento Grupal: ${res.rendimiento}%`);
      this.bloquearEdicionPaqueteActual();
      this.guardarPaqueteEnBackend();
    });
  }

  guardarMatrizEspecifica() {
    alert('El modo ESPECIFICO ha sido eliminado. No es posible guardar paquetes específicos.');
    return;
  }

  resetLote() {
    this.idsSeleccionados = [];
    this.modoRepartoGeneral = 'PROMEDIO';
    this.unidadesPorUsuarioGeneral = {};
    this.unidadesLoteGeneral = 0;
    this.unidadesLoteGeneralFijado = false;
    this.nombreLote = '';
    this.segundos = 0;
    this.tiempoAcumuladoMs = 0;
    this.inicioCronometroMs = null;
    this.limpiarIntervaloCronometro();
    this.guardarPaqueteActual();
  }

  // --- LÓGICA ORIGINAL (MATRIZ) ---
  calcularTiempoPromo(uId: number, p: any): number {
    const cant = Number(this.registroCantidades[uId]?.[p.id] || 0);
    const u = this.usuarios?.find(user => user.id === uId);
    return cant * Number(u?.config_tiempos?.[p.id] || 0);
  }

  calcularTiempoUsuario(u: any): number {
    return this.configuracionPromos.reduce((acc, p) => acc + this.calcularTiempoPromo(u.id, p), 0);
  }

  get sumaGeneralGlobal(): number {
    return this.usuarios?.reduce((acc, u) => acc + this.calcularTiempoUsuario(u), 0) || 0;
  }

  // --- ADMIN & OTROS ---
  setRol(rol: any) { 
    // Cambiar de rol no navega a otra app: solo reconfigura la vista activa.
    if (rol === 'admin') {
      this.rolActual = 'admin';
      localStorage.setItem('rolActual', 'admin');
      this.detenerSincronizacionStatus();
      // Al abrir el panel admin, asegurarnos de cargar los tipos disponibles
      try { this.cargarTiposPromocion(); } catch (e) { /* ignore */ }
      this.cdr.detectChanges();
      return;
    }

    this.rolActual = rol;
    localStorage.setItem('rolActual', rol);
    if (rol === 'dashboard') {
      this.cargarStatusOpciones();
      this.cargarStatusResumen();
      this.iniciarSincronizacionStatus();
    } else {
      this.detenerSincronizacionStatus();
    }
  }

  cargarStatusOpciones() {
    this.ultimaCargaStatusMs = Date.now();
    this.http.get(`${this.baseUrl}/status/opciones`).subscribe({
      next: (res: any) => {
        const opcionesBackend = Array.isArray(res?.paquetes) ? res.paquetes : [];
        const mapa = new Map<string, StatusPaqueteOpcion>();

        opcionesBackend.forEach((p: any) => {
          if (p?.nombre) {
            mapa.set(p.nombre, {
              nombre: p.nombre,
              fecha_creacion: p.fecha_creacion || null,
              estado_paquete: p.estado_paquete || 'ENTREGADO'
            });
          }
        });

        this.statusOpcionesPaquetes = Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        if (!this.statusSeleccionarTodos) {
          const disponibles = new Set(this.statusOpcionesPaquetes.map((p) => p.nombre));
          this.statusPaquetesSeleccionados = this.statusPaquetesSeleccionados.filter((p) => disponibles.has(p));
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.statusOpcionesPaquetes = [];
        this.cdr.detectChanges();
      }
    });
  }

  toggleStatusPaquete(paquete: string) {
    if (this.statusSeleccionarTodos) {
      this.statusSeleccionarTodos = false;
      this.statusTipoEstadistica = 'PAQUETE';
      this.statusPaquetesSeleccionados = [];
    }

    const idx = this.statusPaquetesSeleccionados.indexOf(paquete);
    if (idx >= 0) {
      this.statusPaquetesSeleccionados.splice(idx, 1);
    } else {
      this.statusPaquetesSeleccionados.push(paquete);
    }
    this.statusUsuarioIndividualId = null;
  }

  toggleStatusPaquetesPanel() {
    if (this.statusTipoEstadistica !== 'PAQUETE') return;
    this.statusPaquetesDesplegado = !this.statusPaquetesDesplegado;
  }

  seleccionarStatusPaquete(paquete: string) {
    const nombre = (paquete || '').trim();
    if (!nombre) return;
    this.statusSeleccionarTodos = false;
    this.statusTipoEstadistica = 'PAQUETE';
    this.statusPaquetesSeleccionados = [nombre];
    this.statusUsuarioIndividualId = null;
    this.statusPaquetesDesplegado = false;
    this.cargarStatusResumen();
  }


  // Cargar solo tipos de promoción (antes cargábamos categorías y promociones)
  cargarTiposPromocion() {
    const headers = { 'X-Admin-Token': this.adminToken || '' };
    this.http.get(`${this.baseUrl}/admin/tipos-promocion`, { headers }).subscribe({
      next: (res: any) => {
        this.tiposPromocion = Array.isArray(res?.data) ? res.data : [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        // Si la llamada admin falla (ej. 401), intentar cargar desde el endpoint público /data
        if (this.manejarNoAutorizadoAdmin(err)) {
          // manejarNoAutorizadoAdmin ya cierra sesión y notifica, pero intentamos mostrar tipos públicamente
        }
        this.tiposPromocion = [];
        this.http.get(`${this.baseUrl}/data`).subscribe({
          next: (res2: any) => {
            const tipos = Array.isArray(res2?.tipos) ? res2.tipos : (res2?.promos || []);
            // normalizar a la forma esperada por la UI
            this.tiposPromocion = tipos.map((t: any) => ({
              id: t.id,
              nombre: t.nombre || t.name || '',
              tiempo_minutos: Number(t.tiempo_minutos || t.tiempo_min || 0),
              created_at: t.created_at,
              updated_at: t.updated_at
            }));
            this.cdr.detectChanges();
          },
          error: () => {
            this.tiposPromocion = [];
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  // --- Tipos de Promocion (nuevo) ---
  nuevaPromocionNombre: string = '';
  nuevaPromocionTiempo: number = 0;
  tiposPromocion: any[] = [];
  tiposEditando: { [key: number]: boolean } = {};

  crearTipoPromocion() {
    const nombre = (this.nuevaPromocionNombre || '').trim();
    // Solo enviar nombre al crear; el tiempo se edita posteriormente.
    const tiempo = 0;
    if (!nombre) {
      alert('El nombre del tipo es requerido');
      return;
    }

    const proceedCreate = () => {
      const headers = { 'X-Admin-Token': this.adminToken || '' };
      const data = { nombre };
      this.http.post(`${this.baseUrl}/admin/tipos-promocion`, data, { headers }).subscribe({
        next: () => {
          this.nuevaPromocionNombre = '';
          this.nuevaPromocionTiempo = 0;
          this.cargarTiposPromocion();
          alert('Tipo creado exitosamente');
        },
        error: (err) => {
          if (this.manejarNoAutorizadoAdmin(err)) {
            alert('Tu sesión expiró. Vuelve a intentar crear el tipo después de iniciar sesión.');
            return;
          }
          alert('Error: ' + (err?.error?.message || 'No se pudo crear el tipo'));
          // Aunque la creación falló (p. ej. porque ya existe), forzamos
          // una recarga de tipos para reflejar el estado real del backend.
          this.cargarTiposPromocion();
        }
      });
    };

    if (this.adminAutenticado) {
      proceedCreate();
      return;
    }

    // Pedido interactivo: solicitar contraseña al crear si no hay sesión.
    const pwd = prompt('Ingresa la contraseña de administrador para crear el tipo:');
    if (!pwd) {
      alert('Operación cancelada. No se creó el tipo.');
      return;
    }

    this.http.post(`${this.baseUrl}/admin/login`, { password: pwd }).subscribe({
      next: (res: any) => {
        const token = String(res?.token || '');
        if (!token) {
          alert('No se pudo iniciar sesión como admin.');
          return;
        }
        this.adminToken = token;
        sessionStorage.setItem('adminToken', token);
        proceedCreate();
      },
      error: (err: any) => {
        alert('Error de autenticación: ' + (err?.error?.message || 'No se pudo iniciar sesión'));
      }
    });
  }

  actualizarTipoPromocion(tipo: any) {
    if (!this.adminAutenticado) {
      alert('Debes iniciar sesión como administrador para editar tipos.');
      return;
    }

    const nombre = (tipo.nombre || '').trim();
    if (!nombre) {
      alert('El nombre no puede estar vacío');
      return;
    }
    const headers = { 'X-Admin-Token': this.adminToken || '' };
    const data = { nombre, tiempo_minutos: tipo.tiempo_minutos || 0 };
    this.http.put(`${this.baseUrl}/admin/tipos-promocion/${tipo.id}`, data, { headers }).subscribe({
      next: () => {
        this.tiposEditando[tipo.id] = false;
        this.cargarTiposPromocion();
        alert('Tipo actualizado');
      },
      error: (err) => alert('Error: ' + (err?.error?.message || 'No se pudo actualizar'))
    });
  }

  eliminarTipoPromocion(tipo: any) {
    if (!this.adminAutenticado) {
      alert('Debes iniciar sesión como administrador para eliminar tipos.');
      return;
    }

    if (!confirm(`¿Eliminar el tipo "${tipo.nombre}"?`)) return;
    const headers = { 'X-Admin-Token': this.adminToken || '' };
    this.http.delete(`${this.baseUrl}/admin/tipos-promocion/${tipo.id}`, { headers }).subscribe({
      next: () => {
        this.cargarTiposPromocion();
        alert('Tipo eliminado');
      },
      error: (err) => alert('Error: ' + (err?.error?.message || 'No se pudo eliminar'))
    });
  }

  

  setStatusTodosPaquetes(valor: boolean) {
    this.statusSeleccionarTodos = valor;
    this.statusTipoEstadistica = valor ? 'TODO' : 'PAQUETE';
    if (valor) {
      this.statusPaquetesSeleccionados = [];
      this.statusPaquetesDesplegado = false;
    } else {
      this.statusPaquetesDesplegado = true;
    }
    this.statusUsuarioIndividualId = null;
  }

  setStatusTipoEstadistica(tipo: 'TODO' | 'PAQUETE') {
    this.statusTipoEstadistica = tipo;
    this.onStatusTipoEstadisticaChange();
    this.cargarStatusResumen();
  }

  onStatusTipoEstadisticaChange() {
    const esTodo = this.statusTipoEstadistica === 'TODO';
    this.statusSeleccionarTodos = esTodo;
    if (esTodo) {
      this.statusPaquetesSeleccionados = [];
      this.statusUsuarioIndividualId = null;
      this.statusPaquetesDesplegado = false;
      return;
    }

    this.statusPaquetesDesplegado = false;
    this.statusPaquetesSeleccionados = [];
    this.statusUsuarioIndividualId = null;
  }

  get statusPaqueteSeleccionado(): string | null {
    return this.statusPaquetesSeleccionados.length ? this.statusPaquetesSeleccionados[0] : null;
  }

  get statusPaquetesBasicosVista(): StatusPaqueteBasico[] {
    const mapa = new Map<string, StatusPaqueteBasico>();
    const modoFiltro = this.statusTipoEstadistica === 'TODO' ? this.statusFiltroModo : 'ALL';
    const nombreFiltro = (this.statusTipoEstadistica === 'PAQUETE' ? this.statusFiltroNombre : '').trim().toLowerCase();

    this.statusOpcionesPaquetes.forEach((p) => {
      mapa.set(p.nombre, {
        nombre: p.nombre,
        fecha_creacion: p.fecha_creacion || null,
        estado_paquete: p.estado_paquete || 'SIN ESTADO',
        meta_total: 0,
        real_total: 0,
        rendimiento: 0
      });
    });

    this.statusPorPaquete.forEach((fila) => {
      if (modoFiltro !== 'ALL' && fila.modo !== modoFiltro) return;
      const nombre = (fila.nombre_paquete || '').trim();
      if (!nombre) return;

      const base = mapa.get(nombre) || {
        nombre,
        fecha_creacion: fila.fecha_creacion || null,
        estado_paquete: fila.estado_paquete || 'SIN ESTADO',
        meta_total: 0,
        real_total: 0,
        rendimiento: 0
      };

      base.meta_total += Number(fila.meta_total || 0);
      base.real_total += Number(fila.real_total || 0);
      base.estado_paquete = fila.estado_paquete || base.estado_paquete;
      base.fecha_creacion = base.fecha_creacion || fila.fecha_creacion || null;
      mapa.set(nombre, base);
    });

    return Array.from(mapa.values())
      .filter((item) => !nombreFiltro || item.nombre.toLowerCase().includes(nombreFiltro))
      .map((item) => {
        const rendimiento = item.real_total > 0 ? ((item.meta_total - item.real_total) / item.real_total) * 100 : 0;
        return {
          ...item,
          meta_total: Math.round(item.meta_total * 100) / 100,
          real_total: Math.round(item.real_total * 100) / 100,
          rendimiento: Math.round(rendimiento * 100) / 100
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  get statusFilasPaqueteSeleccionado(): StatusFila[] {
    const seleccionado = this.statusPaqueteSeleccionado;
    if (!seleccionado) return [];
    const modoFiltro = this.statusTipoEstadistica === 'TODO' ? this.statusFiltroModo : 'ALL';
    return this.statusPorPaquete.filter((fila) => {
      if ((fila.nombre_paquete || '').trim() !== seleccionado) return false;
      if (modoFiltro !== 'ALL' && fila.modo !== modoFiltro) return false;
      return true;
    });
  }

  get puedeFiltrarUsuarioIndividualStatus(): boolean {
    return !this.statusSeleccionarTodos && this.statusPaquetesSeleccionados.length === 1;
  }

  get statusPorAnalistaVista(): StatusFila[] {
    if (!this.puedeFiltrarUsuarioIndividualStatus || !this.statusUsuarioIndividualId) {
      return this.statusPorAnalista;
    }
    return this.statusPorAnalista.filter((fila) => Number(fila.analista_id) === Number(this.statusUsuarioIndividualId));
  }

  cargarStatusResumen() {
    // El dashboard público siempre trabaja sobre resultados agregados del backend.
    this.ultimaCargaStatusMs = Date.now();
    this.statusCargando = true;
    this.cdr.detectChanges();

    const paquetesParam = this.statusSeleccionarTodos
      ? 'ALL'
      : (this.statusPaquetesSeleccionados.length ? this.statusPaquetesSeleccionados.join(',') : 'ALL');

    const params: any = {
      paquetes: paquetesParam,
      modo: this.statusFiltroModo
    };

    if (this.puedeFiltrarUsuarioIndividualStatus && this.statusUsuarioIndividualId !== null) {
      params.analista_id = this.statusUsuarioIndividualId;
    }

    if ((this.statusFiltroNombre || '').trim()) params.nombre = this.statusFiltroNombre.trim();

    this.http.get(`${this.baseUrl}/status/resumen`, { params }).subscribe({
      next: (res: any) => {
        this.statusResumenGlobal = res?.resumen_global || null;
        const filasBackend = Array.isArray(res?.por_paquete) ? res.por_paquete : [];
        const mapaFilas = new Map<string, StatusFila>();

        filasBackend.forEach((fila: StatusFila) => {
          const clave = `${fila.nombre_paquete || ''}__${fila.modo || ''}`;
          mapaFilas.set(clave, fila);
        });

        this.statusPorPaquete = Array.from(mapaFilas.values());
        this.statusPorAnalista = Array.isArray(res?.por_analista) ? res.por_analista : [];
        if (this.statusTipoEstadistica === 'PAQUETE') {
          const filtroNombre = (this.statusFiltroNombre || '').trim().toLowerCase();
          if (filtroNombre) {
            const seleccionActual = (this.statusPaqueteSeleccionado || '').toLowerCase();
            const coincideSeleccion = !seleccionActual || seleccionActual.includes(filtroNombre);
            if (!coincideSeleccion) {
              this.statusPaquetesSeleccionados = [];
            }
          }
        }
        if (this.statusUsuarioIndividualId !== null) {
          const existe = this.statusPorAnalista.some((fila) => Number(fila.analista_id) === Number(this.statusUsuarioIndividualId));
          if (!existe) {
            this.statusUsuarioIndividualId = null;
          }
        }
        this.statusCargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.statusResumenGlobal = null;
        this.statusPorPaquete = [];
        this.statusPorAnalista = [];
        this.statusCargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  validarYGuardarTiempo(u: any, pId: number) {
    this.http.post(`${this.baseUrl}/configurar-tiempo`, { 
      usuario_id: u.id, promocion_id: pId, minutos: u.config_tiempos[pId] 
    }, this.adminRequestOptions()).subscribe({
      error: (err: any) => {
        this.manejarNoAutorizadoAdmin(err);
      }
    });
  }

  validarYGuardarTiempoGeneral(u: any) {
    // Eliminado: ahora los tiempos generales por usuario no se gestionan desde el panel.
  }

  iniciarEdicionUsuario(u: any) {
    this.usuarioEditando = {
      id: u.id,
      nombre: u.nombre
    };
  }

  cancelarEdicionUsuario() {
    this.usuarioEditando = null;
  }

  guardarEdicionUsuario() {
    if (!this.usuarioEditando) return;
    this.http.put(`${this.baseUrl}/usuarios/${this.usuarioEditando.id}`, {
      nombre: this.usuarioEditando.nombre
    }, this.adminRequestOptions()).subscribe({
      next: () => {
        this.usuarioEditando = null;
        this.cargarDatos();
      },
      error: (err: any) => {
        if (this.manejarNoAutorizadoAdmin(err)) return;
        alert(err?.error?.message || 'No se pudo guardar la edición del usuario.');
      }
    });
  }

  eliminarUsuario(u: any) {
    const confirmado = confirm(`¿Eliminar a ${u.nombre}? Esta acción también quitará sus reportes.`);
    if (!confirmado) return;

    this.http.delete(`${this.baseUrl}/usuarios/${u.id}`, this.adminRequestOptions()).subscribe({
      next: () => {
        this.idsSeleccionados = this.idsSeleccionados.filter((id) => id !== u.id);
        delete this.unidadesPorUsuarioGeneral[u.id];
        delete this.sesionesUsuarios[u.id];
        delete this.sesionesUsuariosBaseSegundos[u.id];

      if (this.usuarioEditando?.id === u.id) {
        this.usuarioEditando = null;
      }
      this.cargarDatos();
      if (this.rolActual === 'dashboard') {
        this.cargarStatusOpciones();
        this.cargarStatusResumen();
      }
      },
      error: (err: any) => {
        if (this.manejarNoAutorizadoAdmin(err)) return;
        alert(err?.error?.message || 'No se pudo eliminar el usuario en base de datos.');
      }
    });
  }

  agregarUsuario() {
    this.http.post(`${this.baseUrl}/usuarios`, { nombre: this.nuevoUsuario }, this.adminRequestOptions()).subscribe({
      next: () => {
        this.nuevoUsuario = '';
        this.cargarDatos();
      },
      error: (err: any) => {
        if (this.manejarNoAutorizadoAdmin(err)) return;
        alert(err?.error?.message || 'No se pudo crear el usuario.');
      }
    });
  }

  guardarDatos() {
    localStorage.setItem('registroPromos', JSON.stringify(this.registroCantidades));
    this.guardarPaqueteActual();
  }
  
  objectKeys(obj: any) { return Object.keys(obj); }
  horasDesdeMinutos(v: any): number { return Math.max(0, Number(v || 0) / 60); }
  private minutosDesdeHoras(v: any): number { return Math.max(0, Number(v || 0) * 60); }
  formatearHorasDesdeSegundos(s: number): string { return this.formatearCrono(Math.max(0, Number(s || 0))); }
  formatearCrono(s: number) { return new Date(s * 1000).toISOString().substr(11, 8); }

  // Nota: la gestión de tiempos generales por usuario fue removida del panel.

  // Actualiza tiempo promo desde entrada en MINUTOS (sin conversión)
  actualizarTiempoPromoMinutos(u: any, pId: number, minutos: any) {
    if (!u) return;
    if (!u.config_tiempos) u.config_tiempos = {};
    u.config_tiempos[pId] = Math.max(0, Number(minutos || 0));
  }

  guardandoTiempos: boolean = false;

  guardarTiemposPromocionesTodos() {
    if (!this.adminAutenticado) {
      alert('Debes iniciar sesión como administrador para guardar tiempos.');
      return;
    }
    if (!confirm('¿Guardar todos los tiempos por promoción para todos los analistas?')) return;

    const tipos = Array.isArray(this.tiposPromocion) ? this.tiposPromocion : [];
    if (!tipos.length) {
      alert('No hay tipos de promoción para guardar.');
      return;
    }

    this.guardandoTiempos = true;
    const tareas: Promise<void>[] = [];

    this.usuarios.forEach((u: any) => {
      tipos.forEach((promo: any) => {
        const minutos = u.config_tiempos && u.config_tiempos[promo.id] ? Number(u.config_tiempos[promo.id]) : 0;
        const prom = new Promise<void>((resolve) => {
          this.http.post(`${this.baseUrl}/configurar-tiempo`, { usuario_id: u.id, promocion_id: promo.id, minutos }, this.adminRequestOptions()).subscribe({
            next: () => resolve(),
            error: () => resolve()
          });
        });
        tareas.push(prom);
      });
    });

    Promise.all(tareas).then(() => {
      this.guardandoTiempos = false;
      alert('Tiempos guardados');
    }).catch(() => {
      this.guardandoTiempos = false;
      alert('Finalizado con errores en algunas peticiones.');
    });
  }

  // DEPRECATED: funciones de horas eliminadas ya que no usamos tiempo_general.

  // DEPRECATED - Mantener para compatibilidad si es necesario
  actualizarTiempoPromoHoras(u: any, pId: number, horas: any) {
    if (!u) return;
    if (!u.config_tiempos) u.config_tiempos = {};
    u.config_tiempos[pId] = this.minutosDesdeHoras(horas);
  }

  get promosAgrupadas() {
    const grupos: any = {};
    this.configuracionPromos.forEach(p => {
      if (!grupos[p.categoria]) grupos[p.categoria] = [];
      grupos[p.categoria].push(p);
    });
    return grupos;
  }

  trackByPaqueteNombre(index: number, item: any): string {
    return item?.nombre || index;
  }

  trackByPaqueteModo(index: number, item: any): string {
    return (item?.nombre_paquete || '') + '|' + (item?.modo || '');
  }

  trackByAnalistaId(index: number, item: any): string | number {
    return item?.analista_id ?? item?.nombre ?? index;
  }
}