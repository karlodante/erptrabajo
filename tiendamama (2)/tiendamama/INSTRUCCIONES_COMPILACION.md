# Instrucciones para Compilar TiendaMama Lácteos

Este documento explica cómo generar un nuevo instalador .exe después de hacer cambios en el código.

## ⚠️ IMPORTANTE: Backup de Datos Antes de Desinstalar

**Si desinstalas la versión actual, perderás todos tus datos (productos, ventas, etc.)** porque se guardan en localStorage del navegador interno.

### Pasos para hacer backup antes de actualizar:

1. **Abre la versión actual de TiendaMama**
2. **Ve a Inventario**
3. **Click en el botón "Backup"** (icono de descarga)
4. **Click en "Descargar backup"**
5. **Guarda el archivo .json** en un lugar seguro (ej: Escritorio)

### Pasos para restaurar después de actualizar:

1. **Instala la nueva versión**
2. **Abre la aplicación**
3. **Ve a Inventario**
4. **Click en el botón "Backup"**
5. **Click en "Importar datos"**
6. **Selecciona el archivo .json** que guardaste
7. **Click en "Restaurar backup"**

## Requisitos Previos

- Node.js 18+ instalado
- Python 3.11+ instalado
- Acceso a internet para instalar dependencias

## Pasos para Compilar

### 1. Instalar Dependencias del Proyecto

Desde la raíz del proyecto (tiendamama):

```bash
# Instalar dependencias del frontend
cd frontend
npm install

# Instalar dependencias del desktop (Electron)
cd ../desktop
npm install

# Crear entorno virtual de Python e instalar dependencias del backend
cd ../.venv
python -m venv .venv
# En Windows:
.venv\Scripts\activate
# En Linux/Mac:
source .venv/bin/activate

# Instalar dependencias del backend
cd ../backend
pip install -r requirements.txt
```

### 2. Compilar el Backend (Python/FastAPI)

Desde la carpeta `desktop`:

```bash
cd desktop
node build-backend.js
```

Este script:
- Instala PyInstaller si no está instalado
- Compila el backend Python en un ejecutable standalone
- Guarda el resultado en `desktop/python-dist/`

### 3. Compilar el Frontend (Vue.js)

Desde la carpeta `frontend`:

```bash
cd frontend
npm run build
```

Esto genera los archivos compilados en `frontend/dist/`.

### 4. Generar el Instalador .exe

Desde la carpeta `desktop`:

```bash
cd desktop
npm run dist
```

Esto genera:
- Un instalador NSIS: `desktop/dist/TiendaMama-Setup-0.1.0-x64.exe`
- Una versión portable: `desktop/dist/TiendaMama-Portable-0.1.0-x64.exe`

## Desarrollo Rápido

Si solo quieres probar los cambios sin generar un .exe completo:

```bash
# Desde la carpeta desktop
cd desktop
npm run dev:all
```

Esto inicia:
- El servidor de desarrollo del frontend (Vite) en http://127.0.0.1:5173
- El backend FastAPI en http://127.0.0.1:8765
- La aplicación Electron en modo desarrollo

## Cambios Realizados en esta Versión

### 1. Decimales Arreglados en Todo el Sistema
- **Problema**: Los precios se equivocaban en las ventas
- **Solución**: Cálculos con `parseFloat()` y `toFixed(2)` en todo el sistema
- **Archivos modificados**:
  - `frontend/src/stores/pos.js` - Cálculos de precios y ventas

### 2. Modal para Editar Producto Completo
- **Problema**: No se podía editar el producto completo
- **Solución**: Modal completo para editar todos los campos del producto
- **Archivos modificados**:
  - `frontend/src/views/InventarioView.vue` - Modal de edición completa
  - `frontend/src/stores/inventario.js` - Función `actualizarProducto`

### 3. Lectura Mejorada con Pistola de Código de Barras
- **Problema**: La pistola no funcionaba bien
- **Solución**: Detección automática de escaneo vs entrada manual
- **Archivos modificados**:
  - `frontend/src/views/CajaView.vue` - Mejor manejo de escaneo

### 4. Sistema de Backup/Restore
- **Problema**: Al desinstalar se perdían los datos
- **Solución**: Sistema para exportar/importar datos en JSON
- **Archivos modificados**:
  - `frontend/src/api/localDb.js` - Funciones `exportarDatos` e `importarDatos`
  - `frontend/src/views/InventarioView.vue` - Modal de backup en Inventario

## Notas Importantes

- El proyecto usa PostgreSQL en producción, pero puede funcionar con SQLite para desarrollo
- El backend está configurado para usar `Numeric(12, 2)` para precios, lo que permite hasta 2 decimales
- El frontend usa `step="0.01"` en los inputs numéricos para permitir decimales
- Los cambios en el código fuente no afectan al .exe instalado hasta que se recompile
- **SIEMPRE haz backup antes de desinstalar**

## Solución de Problemas

### Error: "No se encontró .venv"
Solución: Crea el entorno virtual de Python:
```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r backend/requirements.txt
```

### Error: "Module not found"
Solución: Instala las dependencias de Node.js:
```bash
cd frontend && npm install
cd ../desktop && npm install
```

### Error al compilar el backend
Solución: Asegúrate de tener Python 3.11+ y que las dependencias estén instaladas en el venv.

## Archivos Modificados

1. `frontend/src/stores/inventario.js` - Funciones para actualizar producto
2. `frontend/src/stores/pos.js` - Cálculos de decimales en ventas
3. `frontend/src/views/InventarioView.vue` - Modal de edición y backup
4. `frontend/src/views/CajaView.vue` - Mejor escaneo de código de barras
5. `frontend/src/api/localDb.js` - Sistema de backup/restore
