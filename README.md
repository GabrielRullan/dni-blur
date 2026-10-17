# ProtegeDNI 🛡️🇪🇸
> **Filtro y anonimizador de DNI español que protege tus datos personales de forma 100% local en tu navegador.**

Diseñado siguiendo las recomendaciones oficiales de seguridad de la **Agencia Española de Protección de Datos (AEPD)** y de la **Policía Nacional** para la cesión de copias del Documento Nacional de Identidad.

🌐 **Demo online en Firebase Hosting:** [https://dni-blur.web.app](https://dni-blur.web.app) (o [https://dni-blur.firebaseapp.com](https://dni-blur.firebaseapp.com))  
📦 **Repositorio en GitHub:** [https://github.com/GabrielRullan/dni-blur](https://github.com/GabrielRullan/dni-blur)

---

## 🔒 100% En tu dispositivo (Zero Data Collection)

- **Ninguna imagen sale de tu navegador:** Todo el renderizado, pixelado, conversión a escala de grises y marcas de agua se ejecutan en memoria mediante la API estándar de **HTML5 Canvas**.
- **Sin servidores backend:** Funciona completamente offline tras cargarse.
- **Limpieza de metadatos:** Al descargar o copiar la imagen procesada generada por Canvas, se eliminan automáticamente todos los metadatos EXIF, fecha de captura y geolocalización GPS incrustados en la foto original de la cámara.

---

## ✨ Características y Funcionalidades

### 1. Modos de Uso: Fácil / Sencillo vs. Avanzado
- **Modo Fácil (por defecto):** Flujo guiado en 3 pasos con lenguaje claro y ergonomía táctil móvil (*mobile-first*). Aplica por defecto **pixelado seguro**, convierte automáticamente a **blanco y negro** para invalidar copias a color y añade la **marca de agua de uso**. No satura al usuario con opciones técnicas innecesarias.
- **Modo Avanzado:** Desbloquea ajustes finos:
  - Estilos de ocultación: Pixelado, Desenfoque (Blur) o Bloque negro.
  - Slider de intensidad de ocultación.
  - Ajustes de Contraste y Brillo en el filtro B&W.
  - Estilos de marca de agua (Mosaico, Sello, Franjas), opacidad, escala y colores (rojo, azul, negro, blanco).

### 2. Ofuscación de Datos Sensibles con Toggle y Presets
- **Comportamiento Toggle:** Hacer clic en un botón de zona (*Firma*, *CAN*, *Soporte*, etc.) lo activa/añade; hacer clic nuevamente lo elimina y desmarca visualmente (con indicador `✓`).
- **Botón 1-Clic AEPD:** Aplica o retira de golpe los tres elementos críticos recomendados por la AEPD y la Policía Nacional (*Firma + Código CAN + Nº de Soporte*).
- **Plantillas DNI (Anverso y Reverso):**
  - **Anverso:** Firma manuscrita, Código CAN (6 dígitos), Nº de Soporte / IDESP, Fecha de validez, Fecha de nacimiento, Foto secundaria.
  - **Reverso:** Código MRZ (3 líneas de lectura mecánica), Domicilio, Nombre de padres, Lugar de nacimiento.
- **Edición Manual Interactiva:** Arrastra sobre la imagen para crear cajas de censura arbitrarias; selecciona cualquier caja para moverla, cambiar su tamaño con los tiradores de las esquinas o eliminarla (`Supr` / botón borrar).

### 3. Calibración por 2 Esquinas (Anchor Alignment)
- Botón **🎯 Ajustar esquinas del DNI**: Permite tocar la esquina superior izquierda y la inferior derecha del documento en fotos tomadas con márgenes, fondos o perspectiva, recalculando y posicionando con precisión todas las plantillas.

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

### 6. Guía Explicativa de Privacidad (Modal Mobile-First)
- Botón **"¿Qué anonimizar?"** e iconos `ℹ️` junto a cada campo.
- Explica de forma pedagógica y con niveles de riesgo (Crítico, Medio, Recomendado) por qué se debe proteger cada dato:
  - *Nº de Soporte / IDESP:* Clave exigida por Hacienda, Seguridad Social y bancos para altas fraudulentas.
  - *Firma Manuscrita:* Evita calcados o vectorización en contratos y créditos.
  - *Código CAN:* Bloquea accesos no autorizados por NFC a los certificados del DNI electrónico.
  - *Código MRZ:* Recuerda que el reverso repite en texto plano el DNI y el número de soporte.
  - *Domicilio y Padres:* Protección física y de preguntas de seguridad bancarias.

### 7. Animación Interactiva Explicativa
- **Tutorial animado en código web:** Simulación interactiva paso a paso accesible desde el botón superior o desde [`animation.html`](file:///c:/Users/gabri/Documents/anony/animation.html) que ilustra los peligros de enviar un DNI sin proteger (préstamos online fraudulentos, suplantación) y enseña a usar la herramienta en 7 pasos clave.

### 8. Marca de Agua de Finalidad
- Impide la reutilización de la copia para fines no autorizados (ej: `USO EXCLUSIVO ALQUILER DE VIVIENDA`, `CHECK-IN HOTEL`, `TRÁMITE BANCARIO`).
- Fecha automática del día actual.
- Disposiciones: Mosaico diagonal repetitivo, Sello central o Franjas.

### 9. Exportación y Demos Integradas
- Descarga en formatos **JPG** (ligero) o **PNG** (calidad nítida sin artefactos).
- Botón **Copiar imagen** directo al portapapeles (`navigator.clipboard`).
- Drag & Drop de fotos y opción de pegar imágenes con `Ctrl+V`.
- **Demos reales integradas:** Permite probar al instante con las muestras reales de anverso y reverso (documento espécimen de Carmen).

---

## 🚀 Despliegue en Firebase Hosting

Para desplegar actualizaciones en Firebase Hosting:

```bash
# 1. Iniciar sesión en Firebase (si no lo estás)
firebase login

# 2. Desplegar en el proyecto configurado
firebase deploy --only hosting
```

El proyecto incluye:
- `firebase.json`: Configurado con reglas de hosting y cabeceras de seguridad HTTP (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`).
- `.firebaserc`: Vinculado al proyecto `dni-blur`.

---

## 🛠️ Tecnologías y Arquitectura

- **Zero Dependencies / Vanilla Web:** Sin bundlers ni frameworks pesados (Vanilla JS ES6+, CSS3 moderno, HTML5 semántico).
- **HTML5 Canvas 2D:** Procesado de imagen y manipulación de píxeles 100% en memoria en el dispositivo del usuario.
- **Diseño Mobile-First:** Adaptado a pantallas táctiles de teléfonos móviles y escritorios.

---

## 📄 Licencia

MIT License — Libre para uso personal y comercial.
