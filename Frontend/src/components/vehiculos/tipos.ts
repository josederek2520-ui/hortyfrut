export interface Vehiculo {
  id: number;
  placa: string;
  tipo: string;
  marca: string;
  capacidad_kg: string | null;
  imagen: string | null;
  activo: boolean;
  creado_en: string;
  responsable_nombre: string;
  version: string;
}
