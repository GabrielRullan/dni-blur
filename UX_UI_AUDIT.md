# Informe Integral de Auditoría UX/UI, Usabilidad y Ergonomía Táctil
**Proyecto:** ProtegeDNI (`https://dni.balears.tech` / `c:\Users\gabri\Documents\dni-blur`)  
**Fecha de Auditoría:** 16 de octubre de 2026  
**Versión:** 1.0.0 (Línea Base para Hitos M0–M4)  
**Alcance:** Auditoría no técnica de usabilidad, arquitectura de información, matriz de lenguaje claro, ergonomía táctil en viewport móvil (375×812) y plan de acción estructurado.

---

## 1. Resumen Ejecutivo y Arquetipo de Usuario No Técnico

### 1.1 Resumen Ejecutivo
ProtegeDNI posee una base de ingeniería y privacidad del más alto nivel: ejecución **100% en el navegador web** del usuario mediante la API de HTML5 Canvas en memoria RAM local, eliminación nativa de metadatos de cámara (EXIF/GPS) al regenerar el lienzo, unión de dos caras (Anverso + Reverso en hoja única 2 en 1) y ausencia total de peticiones a servidores externos, CDNs o paquetes de telemetría de terceros.

Sin embargo, la evaluación forense desde los ojos de una persona sin conocimientos informáticos ni jurídicos revela que **la experiencia de usuario actual ("Modo Sencillo") presenta severas barreras de entrada, desorientación espacial, lenguaje policial intimidante y fallos críticos de ergonomía táctil en teléfonos móviles**.

En lugar de una herramienta directa y lineal para resolver un trámite cotidiano en 30 segundos, el usuario se encuentra con un panel atiborrado de mandos propios de un software de edición gráfica profesional, numeración informática ("Paso 0"), siglas crípticas (`EXIF`, `CAN`, `MRZ`, `IDESP`), alertas modales bloqueantes y tiradores táctiles microscópicos en pantallas táctiles.

### 1.2 Persona y Escenario de Uso Real
* **Nombre ficticio:** María, 42 años.
* **Perfil:** Administrativa comercial, usuaria habitual de WhatsApp, banca móvil y correo electrónico, pero sin formación técnica en programación, diseño gráfico ni derecho de protección de datos.
* **Escenario habitual:**
  1. María encuentra un piso de alquiler vacacional o de larga estancia.
  2. El propietario o la agencia inmobiliaria le envía un mensaje por WhatsApp: *"Para redactar el contrato y reservarte la fecha, envíame una foto del DNI por delante y por detrás"*.
  3. En otros momentos, este mismo requerimiento se lo pide la recepción de un hotel rural antes de llegar, la empresa de alquiler de un vehículo o un departamento de recursos humanos para un contrato temporal.
* **Estado emocional:**
  - **Prisa y estrés:** Desea cerrar el trámite de inmediato antes de que otra persona reserve el piso.
  - **Miedo a estafas de identidad:** Ha visto en televisión que mafias abren cuentas bancarias o piden microcréditos a nombre de terceros con una simple fotocopia de su DNI.
  - **Incertidumbre técnica:** María no sabe qué partes del DNI son indispensables para el casero (su nombre y número de documento) y cuáles representan un peligro letal si caen en malas manos (número de soporte/IDESP, clave CAN y código MRZ del reverso).

---

## 2. Fricciones de Usabilidad y Sobrecarga Cognitiva

### 2.1 Puntos de Fricción Identificados

| Componente / Área | Ubicación en Código | Fricción Identificada | Impacto Psicológico en el Usuario |
|---|---|---|---|
| **Pila de Pasos Desfasada** | `index.html:242, 374, 508` | Numeración de secciones como `Paso 0`, `Paso 1`, `Paso 2 / 3`. | Desconcierto. Los usuarios comunes cuentan desde 1. Ver un "Paso 0" transmite la sensación de que falta una configuración preliminar o que la web está en fase de pruebas interna. |
| **Confusión de Botones de Subida** | `index.html:154, 256, 273, 291` | Coexisten 3 zonas distintas para cargar fotos: en el lienzo vacío, en las tarjetas de ranura Anverso/Reverso y un botón general "Subir imagen(es)". | Fatiga de decisión: el usuario vacila sin saber si debe pulsar "Subir Anverso", "Subir Reverso" o el botón general, y teme romper el proceso si no lo hace en un orden concreto. |
| **Herramientas de Geometría Intrusivas** | `index.html:349–366` | En pleno "Paso 0", se muestran controles de "Calibrar esquinas (2 puntos)" y un deslizador de ángulo de inclinación (-15° a +15°). | Sobrecarga de microgestión: se le pide al usuario calibrar coordenadas de tarjeta antes incluso de haber tapado sus datos confidenciales. |
| **Duplicación de Pestañas de Cara** | `index.html:92–104, 244–252, 260–288` | Selector de cara (Anverso, Reverso, Ambos) replicado simultáneamente en la barra superior del lienzo, en el panel lateral y en las tarjetas de ranura. | Pérdida de control espacial: el usuario no distingue si al pulsar una pestaña está cambiando de foto, borrando la anterior o cambiando la vista de descarga. |
| **Filtro Blanco y Negro sin Explicación** | `index.html:474–503`, `app.js:285` | En Modo Sencillo, la sección de Blanco y Negro se oculta por CSS (`.advanced-only`), pero el filtro se aplica por código de forma forzosa (`state.bwEnabled = true`). | Falta de transparencia: la foto del usuario se transforma en blanco y negro sin que entienda por qué ni cómo desactivarlo si necesita color. |
| **Alertas Modales Nativas del Navegador** | `app.js:500, 760, 783, 810, 1121, 2337, 2433` | Llamadas a `alert('Carga primero una imagen de DNI.')` ante clics en herramientas sin imagen. | Sensación de error informático y software obsoleto; bloquea el hilo principal y requiere pulsar "Aceptar" del sistema operativo. |
| **Ubicación Desconectada del Botón de Descarga** | `index.html:209–234` | La barra de exportación (`#btn-download` y selector de formato JPG/PNG) está colocada bajo el lienzo a la izquierda, mientras que el usuario finaliza su tarea configurando la marca de agua abajo a la derecha. | El usuario que llega al final del formulario busca instintivamente el botón "Descargar" al pie del panel y no lo encuentra sin recorrer la pantalla en sentido inverso. |
| **Peligro Desatendido en el Reverso (MRZ)** | `index.html:423–425`, `app.js:255` | El botón de censura AEPD (`#btn-auto-aepd`) en el anverso no advierte con la suficiente fuerza del reverso. | Falsa sensación de seguridad: usuarios que censuran el anverso envían el reverso descubierto, donde las 3 líneas de lectura mecánica (`<<<`) revelan su DNI y número de soporte íntegros. |

---

## 3. Matriz Exhaustiva de Copywriting en Lenguaje Claro (25+ Elementos)

La siguiente matriz documenta la transformación integral de las expresiones intimidantes, burocráticas o en inglés hacia un español cotidiano, empático y explicativo. Cada fila incluye la ubicación exacta, el análisis del problema, el texto sustituto y la pista visual o tooltip asociado:

| Nº | Cadena Actual | Ubicación (Archivo y Línea) | Fricción Identificada | Texto Propuesto (Español Cercano) | Pista Visual / Tooltip Explicativo (*Qué se tapa y por qué te protege*) |
|---|---|---|---|---|---|
| **1** | `ProtegeDNI — Anonimizador de DNI Español (100% Local)` | `index.html:6` (title) | "Anonimizador" y "100% Local" son fríos y tecnicistas. | `ProtegeDNI — Oculta datos sensibles de tu DNI de forma segura y privada` | *"Tus fotos se procesan en tu propio teléfono u ordenador sin enviarse a ningún servidor."* |
| **2** | `<span class="version-tag">Local</span>` | `index.html:22` | "Local" se confunde con policía local o comercio de barrio. | `🔒 100% Privado` | *"Tus fotos nunca salen de este navegador ni viajan por internet."* |
| **3** | `Privacidad y anonimización de DNI según AEPD y Policía Nacional` | `index.html:24` | Lenguaje formal y burocrático; "anonimización" no es cotidiano. | `Protege tu DNI antes de enviarlo para un alquiler, hotel o trámite online (Recomendado por Policía y AEPD)` | Pone en el centro el caso de uso real de la gente (alquiler, hotel) y aporta respaldo oficial tranquilizador. |
| **4** | `Modo: [Sencillo \| Avanzado]` | `index.html:32–36` | No anticipa la diferencia de experiencia entre ambos modos. | `[⚡ Modo Fácil (Recomendado) \| ⚙️ Modo Personalizado]` | *"Modo Fácil: 3 pasos automáticos para el 99% de los casos. Modo Personalizado: control manual de recorte, ángulo y filtros."* |
| **5** | `¿Qué anonimizar?` | `index.html:46` | Verbo abstracto e intimidante. | `¿Qué datos debo tapar?` | Icono `🛡️`. *"Aprende en 1 minuto qué datos de tu tarjeta pueden usar los estafadores y cuáles sí puedes enseñar."* |
| **6** | `100% en dispositivo` (píldora cabecera) | `index.html:51`, `styles.css:1173` | En móviles el texto se oculta (`display: none`), dejando solo un punto verde. | `🟢 Seguro: No sube nada a internet` (siempre visible en móvil) | *"Tus fotos se procesan en la memoria de tu móvil. Nadie, ni nosotros, puede verlas ni guardarlas jamás."* |
| **7** | `Paso 1 de 2: Toca la esquina superior izquierda del DNI` | `index.html:59–60` | Concepto de calibración matemático que asusta al usuario. | `Alineación de tarjeta: Toca la esquina superior izquierda de tu DNI` | *"Si tu foto salió torcida o con mesa alrededor, marca 2 esquinas para colocar las zonas protegidas en su sitio exacto."* |
| **8** | `DNI Oficial (85.6 × 53.98 mm)` | `index.html:74`, `app.js:2761` | Medidas en milímetros innecesarias para usuarios comunes. | `Tamaño DNI estándar (Proporción oficial)` | *"Ajusta el marco de recorte a la proporción exacta de la tarjeta física del DNI."* |
| **9** | `🪪 Anverso \| 🔄 Reverso \| 📄 Unión (2 en 1)` | `index.html:95, 98, 101` | "Unión (2 en 1)" resulta ambiguo sobre el resultado final. | `🪪 Delante (Anverso) \| 🔄 Detrás (Reverso) \| 📄 Ambas caras juntas (1 sola foto)` | *"Crea una sola imagen con la cara delantera y trasera juntas, lista para enviar en un único mensaje de WhatsApp."* |
| **10** | `Sin rastro EXIF/GPS: Limpia metadatos automáticamente.` | `index.html:197, 211` | El usuario medio desconoce qué es EXIF o qué son metadatos. | `🛡️ Ubicación GPS y datos de cámara eliminados` | *"Las cámaras graban en la foto la dirección GPS exacta de tu casa y la fecha. ProtegeDNI la borra por completo al exportar."* |
| **11** | `Seleccionar foto(s) de DNI` | `index.html:161` | Genérico, no menciona la posibilidad de hacer foto con la cámara. | `📸 Elegir foto del DNI (o hacer foto con la cámara)` | Permite captura directa en móviles (`capture="environment"`) o selección en galería. |
| **12** | `Paso 0: Documento y Caras` | `index.html:242–243` | Comenzar en "Paso 0" genera rechazo y sensación de desorden. | `Paso 1: Sube tu DNI (1 o 2 caras)` | Guía secuencial natural humana: Paso 1, Paso 2, Paso 3. |
| **13** | `✨ Aplicar recomendados AEPD (Firma + CAN + Soporte)` | `index.html:380` | Si el usuario está en el reverso, este texto confunde porque no menciona MRZ. | `✨ Proteger datos clave automáticamente (Recomendado Policía/AEPD)` | En el Anverso tapa Firma, CAN y Soporte. En el Reverso tapa el código de lectura MRZ y el Domicilio. |
| **14** | `Código CAN` (chip anverso) | `index.html:400`, `app.js:248` | Sigla técnica incomprensible (suena a "canino"). | `Clave CAN (6 números abajo a la derecha)` | Resalta los 6 dígitos inferiores. *"Es la clave para leer el chip digital del DNI. Al taparlo, nadie podrá escanear tu tarjeta a distancia."* |
| **15** | `Nº Soporte` / `IDESP` (chip anverso) | `index.html:404`, `app.js:249` | Confusión con servicio de soporte técnico o sigla policial opaca. | `Número de la tarjeta física (Soporte / IDESP)` | Código de 9 caracteres arriba a la derecha. *"Dato crítico que piden bancos y financieras para conceder créditos online. ¡No lo envíes para un alquiler!"* |
| **16** | `MRZ (Inferior)` (chip reverso) | `index.html:424`, `app.js:255` | Sigla técnica de control de pasaportes. | `Líneas de lectura <<< (Abajo al dorso)` | 3 líneas de caracteres `<<<`. *"¡Peligro! Aunque tapes el anverso, estas líneas contienen tu DNI y soporte en texto plano. ¡Tápalo siempre!"* |
| **17** | `Foto sec.` (chip anverso) | `index.html:416`, `app.js:252` | Abreviatura extraña (parece "foto seca" o "foto secreta"). | `Foto secundaria pequeña (fantasma)` | Miniatura translúcida de la cara. *"Evita que usen tu retrato para manipular o falsificar documentos digitales."* |
| **18** | `Padres` (chip reverso) | `index.html:432`, `app.js:257` | Escueto; no explica la relevancia de protegerlo. | `Nombre de tus padres (Reverso)` | *"Muchos servicios y bancos usan el nombre de soltera de la madre como pregunta secreta de seguridad."* |
| **19** | `Domicilio` (chip reverso) | `index.html:428`, `app.js:256` | El usuario duda si la agencia inmobiliaria necesita ver su casa actual. | `Dirección de tu casa (Domicilio)` | *"Protege tu intimidad familiar. Salvo para empadronamiento o contrato formal cerrado, nadie necesita saber dónde vives."* |
| **20** | `Estilo de censura (Avanzado)` | `index.html:455` | Connotación negativa y punitiva de la palabra censura. | `Estilo de ocultación: [Pixelado \| Borroso \| Barra Negra]` | *"Elige cómo prefieres que se cubran las zonas confidenciales de tu documento."* |
| **21** | `Filtro Blanco y Negro` | `index.html:477`, `app.js:285` | No explica el beneficio de seguridad de eliminar el color. | `Convertir a blanco y negro (Recomendado para invalidar copias a color)` | *"La Policía aconseja enviar copias en blanco y negro para que nadie pueda imprimirlas a color y suplantar tu identidad."* |
| **22** | `Marca de agua de uso` / `Destino o motivo de la copia` | `index.html:509, 518` | Nombre técnico de artes gráficas ("marca de agua"). | `Paso 2: ¿Para qué vas a entregar este DNI? (Texto protector)` | Campo claro: *"Escribe el motivo (ej: Solo para alquilar piso en Calle Mayor 12)"*. |
| **23** | `COPIA VÁLIDA SOLO PARA VERIFICACIÓN` (texto por defecto) | `index.html:524` | Demasiado genérico; facilita el fraude si el documento se filtra. | Sugerencia contextual: `SOLO PARA ALQUILER PISO CALLE MAYOR` con botones rápidos: `🏠 Alquiler`, `🏨 Hotel`, `💼 Trabajo`, `🏦 Banco`. | *"Al indicar el destinatario exacto, si la imagen se filtra, nadie más podrá reutilizarla legalmente para otro fin."* |
| **24** | `alert('Carga primero una imagen de DNI.')` | `app.js:810, etc.` | Diálogo nativo bloqueante que parece un cuelgue del navegador. | Notificación fluida en página (Toast/Banner accesible): `ℹ️ Primero sube una foto de tu DNI para poder protegerla.` | Sin ventanas modales molestas; guía la atención hacia la zona de subida. |
| **25** | `Copiar` / `Descargar` (Export Bar) | `index.html:223, 231` | Desconectado del final del formulario; confuso para usuarios móviles. | `Paso 3: Descargar mi DNI protegido` (botón principal destacado) y `📋 Copiar para WhatsApp` | *"¡Listo! Tu documento ya está protegido con marca de agua y zonas sensibles tapadas."* |
| **26** | `Verificación KYC / Prevención de Blanqueo` | `README.md`, `animation.html` | Siglas financieras complejas (*Know Your Customer*). | `Verificación de identidad bancaria y financiera (KYC)` | *"Proceso legal que los bancos usan para confirmar que eres tú y no un estafador abriendo préstamos a tu nombre."* |

---

## 4. Arquitectura de Flujo Guiado en 3 Pasos (Modo Sencillo)

Para transformar ProtegeDNI en una herramienta que cualquier ciudadano pueda usar en menos de un minuto sin manual de instrucciones, el **Modo Fácil** (`appMode === 'simple'`) reestructura la pantalla en 3 pasos lineales:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PASO 1: SUBE TU DNI                                                    │
│ ┌──────────────────────────────────┐  ┌──────────────────────────────┐ │
│ │ 📸 Subir 1 cara (Anverso)        │  │ 📄 Subir 2 caras (Anverso +  │ │
│ │                                  │  │    Reverso juntos 2-en-1)    │ │
│ └──────────────────────────────────┘  └──────────────────────────────┘ │
│ [ ✨ Probar con DNI de ejemplo ]                                       │
│ [ ✓ Anverso cargado ]  [ + Añadir reverso ]  [ 🔄 Girar foto si está ]  │
│                                              [    de lado (90°)     ]  │
└────────────────────────────────────────────────────────────────────────┘
                                    ⬇️
┌────────────────────────────────────────────────────────────────────────┐
│ PASO 2: ¿PARA QUÉ VAS A ENTREGAR ESTE DNI?                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│ │ 🏠 Alquiler  │ │ 🏨 Hotel     │ │ 💼 Trabajo   │ │ 🏦 Trámite      │ │
│ │   de piso    │ │   o viaje    │ │   o empleo   │ │    bancario     │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
│ Texto sobre la imagen: [ SOLO PARA ALQUILER PISO CALLE MAYOR 12      ] │
│ ☑️ Añadir fecha de hoy (16/10/2026) para que no la usen en el futuro    │
│                                                                        │
│ 🛡️ Protección de seguridad oficial activada (Policía y AEPD):         │
│ ✓ Firma oculta           ✓ Clave CAN oculta (chip)                     │
│ ✓ Nº de tarjeta oculto   ✓ Blanco y negro aplicado                     │
│ (Si añades reverso, se tapan automáticamente las líneas MRZ y el domicilio)│
│ [ ⚙️ Ver o ajustar datos tapados a mano ]                               │
└────────────────────────────────────────────────────────────────────────┘
                                    ⬇️
┌────────────────────────────────────────────────────────────────────────┐
│ PASO 3: DESCARGAR O COMPARTIR TU DNI PROTEGIDO                         │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 📥 DESCARGAR MI DNI PROTEGIDO (Imagen JPG)                         │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ 📋 Copiar para pegar en WhatsApp o Correo                          │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ 🔒 100% Privado: Procesado en tu teléfono. Tu foto nunca viaja a internet.│
│ 🛡️ Ubicación GPS y datos de cámara eliminados por completo.           │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Aislamiento Estricto de Herramientas al Modo Avanzado
Las herramientas de precisión matemática quedan completamente ocultas en el Modo Fácil y se activan al pulsar `⚙️ Modo Personalizado`:
1. **Calibración de esquinas por 2 puntos** (`#calibration-bar`): para usuarios con fotos muy distorsionadas en perspectiva.
2. **Enderezado micrométrico de inclinación (-15° a +15°)** (`#straighten-slider`): sustituido en Modo Fácil por un simple botón de rotación a 90°.
3. **Barras de recorte con reglas de tercios y ratios libres**: el Modo Fácil aplica automáticamente la proporción del DNI.
4. **Paleta cromática de marca de agua y opacidad**: el Modo Fácil fija un rojo de seguridad al 38% de opacidad en mosaico diagonal repetido (imposible de recortar por un estafador).
5. **Estilos de censura alternativos y curvas de brillo/contraste**: el Modo Fácil fija pixelado estándar y blanco y negro recomendado.

---

## 5. Auditoría Forense de Ergonomía Táctil Móvil (Viewport 375×812)

La auditoría en viewport móvil estándar (`375px × 812px`, correspondiente a dispositivos como iPhone SE / X / 13 mini y pantallas Android compactas) demostró que la versión original no respeta los estándares internacionales de accesibilidad táctil (Apple Human Interface Guidelines y WCAG 2.5.5 / 2.5.8 de 44×44 px de área táctil).

### 5.1 Tabla de Medición Real de Elementos Interactivos

| Componente Evaluado | Selector CSS | Ancho Medido | Alto Medido | Mínimo Exigido | Diagnóstico | Fricción Táctil Detectada |
|---|---|---|---|---|---|---|
| **Selector de Modo: Sencillo** | `#btn-mode-simple` | 71.6 px | **20.9 px** | 44 × 44 px | **FALLO CRÍTICO** | El pulgar pulsa accidentalmente el modo avanzado. |
| **Selector de Modo: Avanzado** | `#btn-mode-advanced` | 71.6 px | **20.9 px** | 44 × 44 px | **FALLO CRÍTICO** | Altura inferior al 50% del área recomendada. |
| **Botón Guía Animada** | `#btn-open-animation` | 34.0 px | **30.8 px** | 44 × 44 px | **FALLO** | Muy pequeño para pulsación cómoda en marcha. |
| **Pestañas de Cara (Toolbar)** | `.face-tab-btn` | ~66 px | **26.2 px** | 44 × 44 px | **FALLO** | Se tocan con dificultad al alternar vistas. |
| **Botón Recortar (Toolbar)** | `#btn-crop-toggle` | 89.7 px | **27.2 px** | 44 × 44 px | **FALLO** | Altura estrecha y apelmazada. |
| **Botones Girar Izq / Der** | `#btn-rotate-left/right` | **32.4 px** | **28.2 px** | 44 × 44 px | **FALLO DOBLE** | Anchura y altura bajo mínimos; además sufren corte por overflow. |
| **Casilla de Guías** | `#show-guides` | **14.0 px** | **14.0 px** | 44 × 44 px | **FALLO CRÍTICO** | Inviable de pulsar sin hacer zoom con dos dedos. |
| **Botones Subir en Slots** | `#btn-label-front/back` | 302.2 px | **26.7 px** | 44 × 44 px | **FALLO** | El disparador principal de subida es una franja de apenas 26px. |
| **Pestañas Anverso/Reverso (Card 1)**| `.side-tabs .tab-btn` | 61 px | **17.8 px** | 44 × 44 px | **FALLO EXTREMO** | 17.8px es impracticable para cualquier pulgar adulto. |
| **Fichas de Datos (Chips)** | `.chip-btn` | 157.9 px | **33.8 px** | 44 × 44 px | **FALLO** | 10px por debajo del umbral ergonómico. |
| **Icono Info dentro del Chip** | `.chip-info` | **14.0 px** | **14.0 px** | 44 × 44 px | **FALLO CRÍTICO** | Al intentar tocar `ℹ️` para ver la explicación, se activa o desactiva la censura por error. |
| **Etiquetas Rápidas de Agua** | `.tag-btn` | 46–60 px | **21.0 px** | 44 × 44 px | **FALLO CRÍTICO** | Las opciones "Alquiler", "Hotel", "Trabajo" tienen solo 21px de alto. |
| **Casilla de Fecha** | `#wm-include-date` | **14.0 px** | **14.0 px** | 44 × 44 px | **FALLO CRÍTICO** | Casilla diminuta de 14px. |
| **Interruptor Watermark** | `.toggle-switch` | **36.0 px** | **20.0 px** | 44 × 44 px | **FALLO** | El switch no llega ni a la mitad del objetivo mínimo. |
| **Botón Primario Descargar** | `#btn-download` | 168.0 px | **42.2 px** | 44 × 44 px | **MEJORABLE** | Rozando el mínimo (42.2px); debe tener al menos 48–52px para destacar. |

### 5.2 Desbordamiento Horizontal y Recorte Oculto en Móvil
* **Causa técnica:** En `styles.css:735–758`, `.stage-toolbar` utiliza `display: flex; justify-content: space-between;` sin permitir el salto de línea (`flex-wrap: nowrap`).
* **Efecto medido en 375px:**
  - En vista de una sola cara, el contenedor `.stage-quick-actions` se desplaza hacia la derecha alcanzando `right: 459.8px` (85px fuera de pantalla).
  - En vista de Unión (2 en 1), el contenedor se desplaza hasta `right: 541.2px` (166px fuera de pantalla).
  - Dado que el contenedor padre `.stage-area` tiene `overflow: hidden;` (`styles.css:731`), **los botones de rotación (`#btn-rotate-left`, `#btn-rotate-right`), la casilla de guías y el botón de recorte en unión quedan totalmente invisibles e inaccesibles en móviles**.
  - Aunque `scrollWidth` no marque scroll horizontal en el `body`, los controles están literalmente cercenados fuera del encuadre.

### 5.3 El Fallo Matemático de Escala en el Lienzo Táctil
En `app.js:1836, 1926`, el tamaño del tirador y la tolerancia de detección de toque están definidos como constantes fijas en píxeles del lienzo (*canvas buffer*):
```javascript
const HANDLE_SIZE = 12;      // 12 píxeles de canvas
const tol = HANDLE_SIZE + 6; // 18 píxeles de canvas
```
Al convertir las coordenadas con `getCanvasCoords`:
$$\text{scaleX} = \frac{\text{canvas.width}}{\text{rect.width}}$$

* En una foto real sacada con la cámara de un smartphone moderno (12 MP, resolución $4032 \times 3024$), mostrada en un móvil de 375 px (ancho visible del lienzo de ~343 px):
  $$\text{scaleX} = \frac{4032}{343} \approx 11.76$$
* El tamaño físico real en la pantalla del teléfono es:
  $$\text{Tamaño del tirador en pantalla} = \frac{12}{11.76} = \mathbf{1.02\text{ px de pantalla}}$$
  $$\text{Tolerancia para el dedo en pantalla} = \frac{18}{11.76} = \mathbf{1.53\text{ px de pantalla}}$$
* **Conclusión destructiva:** Con una tolerancia de 1.5 píxeles de pantalla, es fisiológicamente imposible que una persona humana agarre o ajuste una caja con el dedo. El usuario cree que la aplicación no responde o se ha quedado congelada.
* **Solución requerida:** La tolerancia y el radio visual de los tiradores deben calcularse multiplicando los píxeles de pantalla por `scaleX` (mínimo 24px de pantalla de radio de contacto táctil).

### 5.4 Ausencia de `setPointerCapture`
Cuando el usuario intenta mover o redimensionar una caja cerca del borde del lienzo en un móvil, el dedo se desliza unos milímetros hacia el exterior (el visor o la barra de herramientas). Al no estar implementado `e.target.setPointerCapture(e.pointerId)`, el navegador corta el evento `pointermove` y la caja queda "atascada" a mitad de arrastre.

### 5.5 Fallo de Carga Inicial de la Demo de Anverso
* **Causa técnica (`app.js:328–329` y `1202–1230`):** En el arranque de la aplicación, `state.currentSide` se inicializa como `'front'`. Al pulsar el botón de demo frontal (`#btn-demo-front`), se invoca `switchSide('front')` al terminar de cargar la imagen. La función `switchSide` contiene una cláusula de guarda inicial:
  ```javascript
  if (state.currentSide === newSide) return;
  ```
  Al ser idénticos, la función retorna inmediatamente sin actualizar `state.img = s.img` ni llamar a `render()`.
* **Impacto:** Si un usuario recién llegado pulsa "Anverso Demo", la pantalla no hace nada. Solo funciona si pulsa antes "Reverso Demo" y luego vuelve al anverso.

---

## 6. Plan de Acción y Hoja de Ruta Priorizada de Implementación

Para asegurar una ejecución impecable sin regresiones y con verificación forense estricta, el trabajo se estructura en los hitos oficiales del proyecto (`PROJECT.md`):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ M0: Infraestructura de Pruebas E2E y Auditoría (ESTE DOCUMENTO)             │
│ - UX_UI_AUDIT.md + PROJECT.md en raíz                                       │
│ - test_e2e.js (Zero dependencias, Node 24 native WebSocket + Chrome CDP)    │
│ - TEST_INFRA.md + TEST_READY.md + Ejecución de línea base                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ M1: Matriz de Lenguaje Claro y Pistas Visuales Reaseguradoras               │
│ - Aplicación de los 25+ términos sustitutos en index.html, app.js, styles   │
│ - Separación física de los botones de información ℹ️ en chips               │
│ - Mantenimiento de la píldora de confianza visible en móviles               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ M2: Arquitectura del Flujo Guiado en 3 Pasos (Modo Fácil)                   │
│ - Reestructuración de la vista por defecto en 3 pasos lineales              │
│ - Subida limpia de 1 cara o 2 caras (conmutación automática a Unión 2 en 1) │
│ - Fichas de uso rápido (Alquiler, Hotel, Empleo, Banco) con fecha opcional  │
│ - Reubicación prominente del botón de descarga y copia al portapapeles      │
│ - Aislamiento estricto de controles secundarios en Modo Personalizado       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ M3: Ergonomía Táctil Móvil y Ajuste de Escala en el Lienzo                  │
│ - min-height: 44px en todos los botones, fichas, pestañas y controles       │
│ - Envoltura limpia de la barra del lienzo (flex-wrap) eliminando el overflow│
│ - Tiradores y tolerancia táctil dependientes de la escala de pantalla (>=24px)│
│ - Incorporación de setPointerCapture / releasePointerCapture en canvas      │
│ - Corrección del fallo de recarga en loadDemoSide                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ M4: Pase Completo de Pruebas E2E, Blindaje Adversarial y Auditoría Forense  │
│ - 100% tests E2E superados en headless Chrome                               │
│ - Pruebas de estrés y preservación de invariantes R5 (0 dependencias)       │
│ - Aprobación por 2 Revisores, 2 Retadores y 1 Auditor Forense               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Criterios de Aceptación y Medición de Éxito

1. **Comprensión sin Manual:** Cualquier usuario no técnico comprende inmediatamente qué hace la aplicación en sus primeros 5 segundos de interacción con la pantalla de inicio.
2. **Cero Siglas Opacas en la Ruta Principal:** `EXIF`, `CAN`, `MRZ`, `IDESP` y `Ofuscación` desaparecen de los botones primarios o van siempre acompañados de su significado práctico y visual.
3. **Ergonomía Táctil Certificada:** El 100% de los elementos interactivos en viewport móvil `375×812` miden al menos `44px` de altura y anchura efectivas de toque.
4. **Cero Desbordamiento:** `document.documentElement.scrollWidth <= window.innerWidth` en todos los estados del ciclo de vida de la aplicación.
5. **Manipulación Táctil en Lienzo de Alta Resolución:** En fotos de cámara de 12 a 48 megapíxeles, las cajas de censura se pueden mover y redimensionar con la yema del dedo con una tolerancia de toque en pantalla de al menos 24px físicos.
6. **Integridad y Privacidad (R5):** Cero dependencias externas en tiempo de ejecución, cero conexiones de red y procesamiento 100% cliente en local.
