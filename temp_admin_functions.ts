  // --- GESTIÓN DE CATEGORÍAS Y PROMOCIONES ---

  cargarCategoriasYPromociones() {
    const headers = { 'X-Admin-Token': this.tokenAdminActual || '' };
    
    this.http.get(`${this.baseUrl}/admin/categorias-promociones`, { headers }).subscribe({
      next: (res: any) => {
        this.categorias = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.categorias = [];
      }
    });

    this.http.get(`${this.baseUrl}/admin/promociones`, { headers }).subscribe({
      next: (res: any) => {
        this.promociones = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.promociones = [];
      }
    });
  }

  crearCategoria() {
    const nombre = (this.nuevaCategoriaNombre || '').trim();
    if (!nombre) {
      alert('El nombre de la categoría es requerido');
      return;
    }

    const headers = { 'X-Admin-Token': this.tokenAdminActual || '' };
    const data = {
      nombre,
      descripcion: this.nuevaCategoriaDescripcion
    };

    this.http.post(`${this.baseUrl}/admin/categorias-promociones`, data, { headers }).subscribe({
      next: () => {
        this.nuevaCategoriaNombre = '';
        this.nuevaCategoriaDescripcion = '';
        this.cargarCategoriasYPromociones();
        alert('Categoría creada exitosamente');
      },
      error: (err) => alert('Error: ' + (err?.error?.message || 'No se pudo crear la categoría'))
    });
  }

  actualizarCategoria(categoria: any) {
    const nombre = (categoria.nombre || '').trim();
    if (!nombre) {
      alert('El nombre no puede estar vacío');
      return;
    }

    const headers = { 'X-Admin-Token': this.tokenAdminActual || '' };
    const data = {
      nombre,
      descripcion: categoria.descripcion
    };

    this.http.put(`${this.baseUrl}/admin/categorias-promociones/${categoria.id}`, data, { headers }).subscribe({
      next: () => {
        this.categoriasEditando[categoria.id] = false;
        this.cargarCategoriasYPromociones();
        alert('Categoría actualizada');
      },
      error: (err) => alert('Error: ' + (err?.error?.message || 'No se pudo actualizar'))
    });
  }

  eliminarCategoria(categoria: any) {
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;

    const headers = { 'X-Admin-Token': this.tokenAdminActual || '' };
    this.http.delete(`${this.baseUrl}/admin/categorias-promociones/${categoria.id}`, { headers }).subscribe({
      next: () => {
        this.cargarCategoriasYPromociones();
        alert('Categoría eliminada');
      },
      error: (err) => alert('Error: ' + (err?.error?.message || 'No se pudo eliminar'))
    });
  }

  crearPromocion() {
    const nombre = (this.nuevaPromocionNombre || '').trim();
    if (!nombre) {
      alert('El nombre de la promoción es requerido');
      return;
    }

    const headers = { 'X-Admin-Token': this.tokenAdminActual || '' };
    const data = {
      nombre,
      categoria_id: this.nuevaPromocionCategoria?.id || null,
      categoria: this.nuevaPromocionCategoria?.nombre || ''
    };

    this.http.post(`${this.baseUrl}/admin/promociones`, data, { headers }).subscribe({
      next: () => {
        this.nuevaPromocionNombre = '';
        this.nuevaPromocionCategoria = null;
        this.cargarCategoriasYPromociones();
        alert('Promoción creada exitosamente');
      },
      error: (err) => alert('Error: ' + (err?.error?.message || 'No se pudo crear la promoción'))
    });
  }

  actualizarPromocion(promo: any) {
    const nombre = (promo.nombre || '').trim();
    if (!nombre) {
      alert('El nombre no puede estar vacío');
      return;
    }

    const headers = { 'X-Admin-Token': this.tokenAdminActual || '' };
    const data = {
      nombre,
      categoria_id: promo.categoria_id || null
    };

    this.http.put(`${this.baseUrl}/admin/promociones/${promo.id}`, data, { headers }).subscribe({
      next: () => {
        this.promocionesEditando[promo.id] = false;
        this.cargarCategoriasYPromociones();
        alert('Promoción actualizada');
      },
      error: (err) => alert('Error: ' + (err?.error?.message || 'No se pudo actualizar'))
    });
  }

  eliminarPromocion(promo: any) {
    if (!confirm(`¿Eliminar la promoción "${promo.nombre}"?`)) return;

    const headers = { 'X-Admin-Token': this.tokenAdminActual || '' };
    this.http.delete(`${this.baseUrl}/admin/promociones/${promo.id}`, { headers }).subscribe({
      next: () => {
        this.cargarCategoriasYPromociones();
        alert('Promoción eliminada');
      },
      error: (err) => alert('Error: ' + (err?.error?.message || 'No se pudo eliminar'))
    });
  }
}
