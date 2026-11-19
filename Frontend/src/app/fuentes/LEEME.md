# Outfit local

Los archivos WOFF2 variables de Outfit se conservan dentro del proyecto. El
tema y los gráficos usan la familia `Outfit`, declarada en `../fuentes.css`.
La disposición principal importa esa hoja global directamente.
No se consulta Google Fonts durante el arranque o la compilación.

- `outfit-latino-variable.woff2`: caracteres latinos, incluidos los acentos y
  la ñ que se utilizan en español.
- `outfit-latino-ampliado-variable.woff2`: caracteres latinos ampliados.
- Ambos archivos conservan los grosores variables de 100 a 900, sin modificar
  los binarios descargados previamente por la compilación de Next.js.

La compilación emite estos recursos bajo `/_next/static/media/` con su huella
de contenido. El acceso público reutiliza los recursos estáticos permitidos de
Next; no necesita nuevas rutas en la pasarela HTTPS.

Autoría: The Outfit Project Authors, 2021.
Origen: Google Fonts, familia Outfit, https://github.com/google/fonts/tree/main/ofl/outfit.
Licencia: SIL Open Font License 1.1, incluida en `OFL.txt`.
