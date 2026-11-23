# RENPA WEB v2 · Consulta pública y gestión local

## Abrir en VS Code
1. Descomprime `RENPA_WEB_v2.zip`.
2. Abre la carpeta `RENPA_WEB_v2` desde VS Code.
3. Abre `index.html` y pulsa **Go Live** para consultar la aplicación pública.
4. Para trabajar con las herramientas de edición, abre `admin.html` mediante Live Server, **solo en un entorno local autorizado**.

## Separación de funciones
- `index.html` + `js/public.js`: **solo consulta**, sin botones ni funciones de edición.
- `admin.html` + `js/admin.js`: edición local heredada, con selección manual de archivos JS.
- `data/`: datos y registros originales, sin modificar.
- `css/styles.css`: diseño renovado y adaptable.

**Aviso de seguridad:** `admin.html` no es una zona privada protegida por contraseña. Es un prototipo de gestión local. No debe publicarse ni distribuirse externamente. Para que exista una zona privada real se necesita servidor, autenticación, autorización y almacenamiento centralizado.

## ZIP público
`RENPA_PUBLICA_v2.zip` contiene únicamente la interfaz y el código de consulta, además de los datos necesarios. Los registros de incidencias y confirmaciones incluidos en el paquete público se reducen a `clave` y `accion`, evitando difundir nombres, fechas y motivos internos. La versión interna conserva los historiales completos.

## Clasificación de solapes
La clasificación visual se basa únicamente en `pct_municipio`:
- ≤ 0,01 %: ruido / posible error.
- > 0,01 % y ≤ 0,10 %: revisar.
- > 0,10 %: claro.
Los datos originales no se sobrescriben.

## Precaución
Las ediciones locales solo afectan al archivo seleccionado. No existe sincronización entre equipos. Antes de modificar, conserva copias de `RENPA_exclusiones.js` y `RENPA_solapes_confirmados.js`.
