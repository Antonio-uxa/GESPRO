import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-panel.component.html'
})
export class AdminPanelComponent {
  // Recibe el componente raíz como host para reutilizar toda su lógica sin duplicarla.
  @Input({ required: true }) host: any;
}
