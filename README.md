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

### 4. Encuadre, Recorte y Giro Inteligente
- **Recorte interactivo (Cropping):** Marco visual con regla de tercios y tiradores para eliminar el fondo de la mesa o bordes sobrantes.
  - Proporción fija **DNI Oficial (85.6 × 53.98 mm, ISO/IEC 7810 ID-1)**, **1:1 Cuadrado** o **Libre**.
  - Conservación no destructiva de la foto original con botón **Restaurar original**.
- **Rotación bidireccional:** Giro 90° horario (↻) y antihorario (↺) con **transformación matemática automática de las zonas censuradas** (las cajas de censura nunca se desalinean al girar).
- **Enderezar foto (Giro fino):** Deslizador de inclinación de -15° a +15° para corregir fotos de móvil tomadas con ligera perspectiva.

### 5. Unión 2 en 1 de Anverso y Reverso (Documento Unificado)
- **Subida dual simultánea o por caras:** Sube las dos fotos a la vez (seleccionando ambas o arrastrándolas) o cárgalas por separado en sus ranuras correspondientes.
- **Edición independiente por cara:** Aplica censura específica al Anverso (Firma, CAN, Soporte) y al Reverso (MRZ, Domicilio) sin que una interfiera con la otra.
- **Unión automática en una sola imagen:**
  - **Disposición Vertical:** Anverso arriba y Reverso abajo (formato estándar de fotocopia oficial).
  - **Disposición Horizontal:** Lado a lado.
  - Normalización de proporciones oficiales ISO/IEC 7810 ID-1 y márgenes limpios.
- **Seguridad unificada:** Aplica el filtro en blanco y negro y la marca de agua cruzada con fecha sobre el folio unificado completo.
- **Descarga directa:** Descarga en JPG o PNG un único archivo listo para enviar (`DNI_Completo_Anverso_y_Reverso_...`).

### 6. Animación interactiva explicativa
- **Tutorial animado en código web:** Simulación interactiva paso a paso accesible desde el botón superior o desde `animation.html` que ilustra los peligros de enviar un DNI sin proteger (préstamos online fraudulentos, suplantación) y enseña a usar la herramienta en 7 pasos clave.

### 7. Exportación y compatibilidad
- Descarga en formatos **JPG** (ligero) o **PNG** (calidad nítida sin artefactos).
- Botón **Copiar imagen** directo al portapapeles (`navigator.clipboard`).
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
