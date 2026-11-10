import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Sesion } from "@/modulos/sesion/dominio/Sesion";

export class AlmacenSeguro {
  private memoria = new Map<string, string>();
  async leer(clave: string) {
    return Platform.OS === "web"
      ? (this.memoria.get(clave) ?? null)
      : SecureStore.getItemAsync(clave);
  }
  async guardar(clave: string, valor: string) {
    if (Platform.OS === "web") this.memoria.set(clave, valor);
    else
      await SecureStore.setItemAsync(clave, valor, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
  }
  async eliminar(clave: string) {
    this.memoria.delete(clave);
    if (Platform.OS !== "web") await SecureStore.deleteItemAsync(clave);
  }
  async sesion(): Promise<Sesion | null> {
    const valor = await this.leer("hortyfru.sesion");
    if (!valor) return null;
    try {
      const datos = JSON.parse(valor) as Sesion;
      if (
        !datos.usuario ||
        !Number.isSafeInteger(datos.usuario.id) ||
        typeof datos.usuario.nombre !== "string" ||
        typeof datos.credencial !== "string" ||
        typeof datos.servidor !== "string" ||
        !Number.isFinite(Date.parse(datos.venceEn))
      )
        throw Error();
      return datos;
    } catch {
      await this.eliminar("hortyfru.sesion");
      return null;
    }
  }
}
