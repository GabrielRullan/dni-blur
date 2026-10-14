# ProtegeDNI 🛡️🇪🇸
> **Filtro y anonimizador de DNI español que protege tus datos personales de forma 100% local en tu navegador.**

Diseñado siguiendo las recomendaciones oficiales de seguridad de la **Agencia Española de Protección de Datos (AEPD)** y de la **Policía Nacional** para la cesión de copias del Documento Nacional de Identidad.

🌐 **Demo online en Firebase:** [https://dni-blur.web.app](https://dni-blur.web.app) (o [https://dni-blur.firebaseapp.com](https://dni-blur.firebaseapp.com))

---

## 🔒 100% En tu dispositivo (Zero Data Collection)

- **Ninguna imagen sale de tu navegador:** Todo el renderizado, pixelado, conversión a escala de grises y marcas de agua se ejecutan en memoria mediante la API estándar de **HTML5 Canvas**.
- **Sin servidores backend:** Funciona completamente offline tras cargarse.
- **Limpieza de metadatos:** Al descargar o copiar la imagen procesada generada por Canvas, se eliminan automáticamente todos los metadatos EXIF, fecha de captura y geolocalización GPS incrustados en la foto original de la cámara.

---

## ✨ Características principales

### 1. Ofuscación de datos sensibles
- **3 Modos de ocultación:** Pixelado adaptativo, Desenfoque (Blur) y Bloque negro absoluto.
- **Plantillas rápidas para DNI 3.0 y 4.0:**
  - **Anverso:** Firma manuscrita, Código numérico CAN (6 dígitos), Nº de Soporte / IDESP, Fecha de validez, Fecha de nacimiento, Foto secundaria.
  - **Reverso:** Código MRZ (3 líneas de lectura óptica inferior), Domicilio completo, Nombre de los padres, Lugar de nacimiento.
  - **Botón de 1 clic AEPD:** Aplica de golpe la combinación crítica (*Firma + CAN + Nº Soporte*) para evitar trámites bancarios o suplantación en préstamos online.
- **Edición manual interactiva:** Haz clic y arrastra sobre cualquier parte de la imagen para crear recuadros de censura personalizados; redimensiona y mueve los recuadros existentes con las guías interactivas.

### 2. Filtro Blanco y Negro (B&W)
- Convierte el documento a escala de grises perceptual (fórmula ITU-R BT.601).
- Ajustes finos de **Contraste** y **Brillo**.
- Invalida el uso del documento como copia en color para contrataciones de servicios financieros no autorizados.

### 3. Marca de agua de finalidad (Watermark)
- Permite especificar el destinatario o propósito exclusivo de la copia (ej: `USO EXCLUSIVO ALQUILER PISO`, `CHECK-IN HOTEL`, `CONTRATO LABORAL`).
- Incorpora opcionalmente la fecha del día actual.
- **3 Disposiciones:** Mosaico diagonal repetitivo, Sello cruzado central y Franjas superior/inferior.
- Personalización de color (rojo seguridad, azul oficial, negro, blanco), opacidad y tamaño de fuente.

### 4. Exportación y compatibilidad
- Descarga en formatos **JPG** (ligero) o **PNG** (calidad nítida sin artefactos).
- Botón **Copiar imagen** directo al portapapeles (`navigator.clipboard`).
- Herramienta de rotación de imagen de 90° en 90°.
- Drag & Drop de fotos y opción de pegar imágenes con `Ctrl+V`.
- DNI simulado sintético integrado para probar la herramienta de inmediato sin subir un documento real.

---

## 🚀 Despliegue en Firebase Hosting

Para desplegar este proyecto en Firebase Hosting:

```bash
# 1. Iniciar sesión en Firebase (si no lo estás)
firebase login

# 2. Desplegar en el proyecto configurado
firebase deploy --only hosting
```

El proyecto incluye el archivo `firebase.json` configurado para servir la raíz del repositorio con cabeceras de seguridad web (`X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`).

---

## 🛠️ Tecnologías utilizadas

- **HTML5 Canvas API:** Manipulación directa de pixeles en memoria del cliente.
- **CSS3 Moderno:** Variables CSS, diseño responsive adaptable a escritorio y dispositivos móviles.
- **JavaScript estándar (ES6+):** Sin dependencias de compilación ni librerías externas pesadas.

---

## 📄 Licencia

MIT License — Libre para uso personal y comercial.
