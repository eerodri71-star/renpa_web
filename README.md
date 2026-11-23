
# Visor territorial de la Red de Espacios Naturales Protegidos de Andalucía (RENPA)

Herramienta digital de consulta y análisis territorial de los espacios naturales protegidos de Andalucía y su relación con los términos municipales.

Desarrollada como apoyo a las actuaciones de planificación, seguimiento y dinamización socioeconómica de los espacios naturales protegidos de Andalucía.

## Acceso a la herramienta

**[Abrir visor web RENPA](https://eerodri71-star.github.io/renpa_web/)**

**[Acceder a la aplicación móvil RENPA](https://eerodri71-star.github.io/renpa_movil/)**

## 1. Descripción del proyecto

El visor permite consultar las relaciones territoriales entre los municipios andaluces y los espacios naturales protegidos, facilitando el acceso a información geográfica sin necesidad de utilizar programas especializados de Sistemas de Información Geográfica (SIG).

La herramienta integra información cartográfica y resultados de análisis espacial previamente procesados, ofreciendo una interfaz de consulta accesible desde el navegador.

Su ámbito territorial comprende las ocho provincias de Andalucía.

El proyecto cuenta con tres componentes diferenciados:

- **Buscador administrativo:** herramienta interna de consulta, revisión y gestión de incidencias cartográficas.
- **Visor web público:** aplicación de consulta territorial accesible desde cualquier navegador.
- **Aplicación móvil:** versión adaptada a dispositivos móviles, instalable como aplicación web progresiva (PWA).

Las dos aplicaciones públicas comparten un sistema de actualización de correcciones cartográficas.

## 2. Funcionalidades principales

### 2.1. Consulta por municipio

Permite seleccionar un municipio andaluz y conocer:

- Los espacios naturales protegidos relacionados con su término municipal.
- Las figuras de protección correspondientes.
- La superficie de intersección, expresada en hectáreas.
- El porcentaje de superficie municipal incluido en cada espacio.
- El porcentaje de superficie del espacio situado dentro del municipio.
- La representación cartográfica de las relaciones territoriales.

### 2.2. Consulta por espacio natural

Permite seleccionar un espacio protegido y consultar:

- Los municipios con los que presenta intersección territorial.
- La provincia a la que pertenece cada municipio.
- Las superficies y porcentajes asociados a cada relación.
- Su distribución territorial mediante un mapa interactivo.

Las diferentes figuras de protección se mantienen diferenciadas para evitar confundir designaciones que pueden coincidir espacialmente.

### 2.3. Visor cartográfico

La herramienta incorpora un mapa interactivo que permite:

- Visualizar los límites municipales.
- Representar los espacios naturales protegidos.
- Identificar las distintas figuras de protección.
- Consultar la información territorial de los elementos representados.
- Activar y desactivar capas de información.
- Examinar las relaciones espaciales entre municipios y espacios protegidos.

### 2.4. Identificación de posibles errores geométricos

El visor distingue relaciones territoriales de escasa superficie que pueden deberse a desajustes entre las capas cartográficas originales.

Estos casos se identifican mediante avisos de revisión.

La clasificación se basa en el porcentaje de superficie municipal afectada, no en el porcentaje que representa el municipio respecto a la superficie total del espacio protegido.

Se distinguen tres categorías:

| Clasificación | Criterio | Interpretación |
|---|---|---|
| RUIDO | ≤ 0,01 % de la superficie municipal | Posible desajuste geométrico |
| REVISAR | > 0,01 % y ≤ 0,10 % | Solape reducido pendiente de comprobación |
| CLARO | > 0,10 % | Relación no señalada por su tamaño reducido |

La presencia de un aviso no implica necesariamente que exista un error, ya que algunos solapes de superficie reducida pueden ser reales.

## 3. Información geográfica

La herramienta utiliza información cartográfica de los espacios naturales protegidos de Andalucía, procedente de la Red de Información Ambiental de Andalucía (REDIAM).

Se contemplan diferentes grupos de figuras de protección:

- Espacios Naturales Protegidos.
- Red Natura 2000 (ZEC y ZEPA).
- Reservas de la Biosfera.
- Zonas Especialmente Protegidas de Importancia para el Mediterráneo (ZEPIM).

La información se relaciona espacialmente con los límites de los términos municipales de Andalucía.

Los resultados se almacenan en archivos independientes que permiten realizar las consultas sin ejecutar nuevamente los cálculos espaciales.

## 4. Correcciones cartográficas

Durante la revisión de los resultados pueden identificarse relaciones incorrectas originadas por pequeños desajustes entre geometrías.

También pueden detectarse solapes inicialmente señalados como dudosos que, tras su comprobación, resultan ser correctos.

Para gestionar estas situaciones existe una versión administrativa independiente que permite registrar:

- Exclusiones de relaciones incorrectas.
- Restauraciones de relaciones previamente excluidas.
- Confirmaciones de solapes pequeños reales.
- Retiradas de confirmaciones.

Las modificaciones se registran en archivos internos que conservan el historial de actuaciones.

**La versión web pública es exclusivamente consultiva y no permite modificar los datos ni gestionar incidencias.**

## 5. Actualización de las correcciones

Las correcciones validadas se publican mediante un archivo JSON independiente, alojado en un repositorio compartido.

**[Repositorio de correcciones RENPA](https://github.com/eerodri71-star/renpa_datos)**

Archivo de consulta:

`https://eerodri71-star.github.io/renpa_datos/correcciones.json`

El procedimiento de actualización consiste en:

1. Registrar y guardar las correcciones desde la herramienta administrativa.
2. Generar el archivo `correcciones.json` mediante la función de exportación.
3. Sustituir el archivo existente en el repositorio `renpa_datos`.
4. Esperar a que GitHub Pages publique la actualización.
5. Acceder nuevamente al visor público para cargar las correcciones disponibles.

El archivo publicado contiene únicamente las relaciones excluidas y los solapes confirmados que se encuentran vigentes.

No incluye nombres de usuarios, motivos de revisión ni historiales internos.

Este mecanismo permite que la versión web pública y la aplicación móvil utilicen una misma fuente de correcciones.

## 6. Estructura del proyecto

Los principales archivos y directorios de la aplicación son:

    renpa_web/
    │
    ├── index.html
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── public.js
    ├── data/
    │   ├── RENPA_datos.js
    │   └── RENPA_geo.js
    ├── assets/
    │   └── cabecera.png
    ├── config-publicacion.js
    ├── cargar-correcciones.js
    ├── correcciones-iniciales.js
    └── README.md

### Descripción de los archivos

| Archivo | Función |
|---|---|
| `index.html` | Estructura principal de la aplicación |
| `css/styles.css` | Diseño y estilos de la interfaz |
| `js/public.js` | Lógica de búsqueda, consulta y representación cartográfica |
| `data/RENPA_datos.js` | Información de relaciones territoriales |
| `data/RENPA_geo.js` | Geometrías utilizadas por el visor |
| `config-publicacion.js` | Configuración de la dirección de las correcciones públicas |
| `cargar-correcciones.js` | Descarga y aplicación de las correcciones compartidas |
| `correcciones-iniciales.js` | Correcciones incluidas como respaldo |

## 7. Tecnologías utilizadas

La aplicación está desarrollada con tecnologías web:

- HTML5.
- CSS3.
- JavaScript.
- GeoJSON para la representación de información geográfica.
- GitHub Pages para la publicación.

Los datos territoriales se encuentran previamente procesados, por lo que las consultas no requieren una base de datos externa.

## 8. Relación con la aplicación móvil

El proyecto cuenta con una aplicación web progresiva (PWA), disponible en:

**[Aplicación móvil RENPA](https://eerodri71-star.github.io/renpa_movil/)**

Esta versión está adaptada a dispositivos móviles y puede añadirse a la pantalla de inicio del teléfono.

Comparte las funcionalidades principales de consulta territorial y utiliza el mismo archivo público de correcciones.

Además, incorpora mecanismos de almacenamiento local que permiten consultar los datos previamente descargados sin conexión a Internet.

La disponibilidad de cartografía de fondo puede depender de la conexión.

## 9. Mantenimiento

Se distinguen dos tipos de actualización:

### Actualización de correcciones

Se realiza sustituyendo `correcciones.json` en el repositorio `renpa_datos`.

No requiere modificar los archivos principales del visor.

### Actualización de datos cartográficos

Requiere regenerar y sustituir los archivos de datos y geometrías correspondientes, así como comprobar la compatibilidad de las correcciones existentes.

Las modificaciones de código o diseño deben publicarse en los repositorios de las aplicaciones afectadas.

## 10. Consideraciones de uso

Los resultados proceden del análisis espacial de las capas cartográficas utilizadas y están sujetos a su escala, precisión y fecha de actualización.

La coincidencia territorial de varias figuras de protección puede producir superposiciones, por lo que sus porcentajes no deben sumarse directamente.

La información tiene carácter técnico y orientativo y no sustituye a la cartografía oficial ni a los instrumentos normativos de delimitación de los espacios naturales protegidos.

---

**Proyecto:** Herramienta digital de consulta y análisis territorial de la RENPA.

**Ámbito:** Comunidad Autónoma de Andalucía.

**Contexto:** Actuaciones de dinamización socioeconómica de espacios naturales protegidos. Expediente 2023/038. Programa FEDER Andalucía 2021-2027.
