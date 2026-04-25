
# 🚀 Guía del Proyecto: CBD RAG (Intelligence Layer)

Bienvenido a la documentación oficial de **CBD RAG**. Este documento está dividido en dos partes: una guía técnica para la puesta en marcha y un manual operativo para usuarios finales.

---

## 🛠️ Manual de Instalación

Este apartado detalla los pasos necesarios para instalar, configurar y ejecutar el proyecto en un entorno local. La aplicación utiliza **Docker**, lo que garantiza que las dependencias sean consistentes en cualquier sistema operativo.

### 1. Requisitos Previos
Asegúrate de tener instalados los siguientes componentes:
* **Git:** Para el control de versiones y clonación.
* **Docker Desktop:** Para gestionar y ejecutar los contenedores de los microservicios.

### 2. Clonación del Repositorio
Abre una terminal (ej. en Visual Studio Code) y ejecuta los siguientes comandos:

```bash
# Clonar el proyecto
git clone https://github.com/pabpergas/CBD.git

# Acceder al directorio
cd CBD

# Abrir en el editor (opcional)
code .
```

### 3. Configuración del Entorno (API Keys) 🔑
El sistema utiliza un enfoque híbrido de IA: **Google Gemini** para procesamiento multimodal y **Fireworks AI** para razonamiento avanzado.

1.  Crea un archivo llamado `.env` en la raíz del proyecto.
2.  Copia el contenido de `.env.example` en él.
3.  Completa las siguientes claves:

#### **A. Google API Key**
* Ve a [Google AI Studio](https://aistudio.google.com/).
* Pulsa en **"Get API key"** -> **"Create API key"**.
* Copia y pega la clave en `GOOGLE_API_KEY` y `GOOGLE_GENERATIVE_AI_API_KEY`.

#### **B. Fireworks API Key**
* Regístrate en [fireworks.ai](https://fireworks.ai/).
* Entra en **Settings** -> **API Keys**.
* Crea una nueva clave y pégala en `FIREWORKS_API_KEY`.

### 4. Despliegue con Docker Compose 🐳
El proyecto se compone de **4 microservicios** que se levantan simultáneamente:

* **`client`**: Frontend en React (Node Alpine).
* **`server`**: Backend en Node.js (Express) que orquesta el flujo RAG.
* **`python-worker`**: Motor en Python 3.12 para generación de documentos y gráficas.
* **`qdrant`**: Base de datos vectorial para el almacenamiento de información.

**Comando de ejecución:**
```bash
docker compose up --build
```

Una vez finalizado, accede a la aplicación en:
👉 **[http://localhost:5173/](http://localhost:5173/)**

---

## 📖 Manual de Usuario

Aprende a interactuar con el asistente de IA para extraer información, generar documentos y cruzar referencias entre contextos.

### 1. Gestión de Notebooks 📓
Los **Notebooks** son espacios de trabajo aislados.
* **Crear:** En el menú lateral izquierdo, haz clic en `+ Nuevo chat`, asigna un nombre y pulsa `Crear`.
* **Navegar:** Selecciona cualquier cuaderno en la lista de `Conversaciones recientes` para activarlo.

### 2. Ingesta de Datos: Gestión de Fuentes 📥
Sube archivos para que la IA aprenda de ellos (PDF, audio, imágenes o texto).

* **Opción A (Botón):** En la sección `Sources` (abajo a la izquierda), haz clic en `GESTIONAR` y selecciona tus archivos.
* **Opción B (Drag & Drop):** Arrastra archivos directamente sobre el chat central. Verás un mensaje que dice: *"Suelta archivos para añadir fuentes"*.
* **Eliminar:** Haz clic en el icono de la **papelera roja** junto al nombre del archivo para borrarlo de la base de datos vectorial.

> ⏳ *Observarás una barra de progreso mientras el sistema genera los "embeddings" (representación matemática) de tus documentos.*

### 3. Interacción Básica: El Chat RAG 💬
* **Preguntar:** Escribe tu consulta en la barra inferior.
* **Razonamiento:** El sistema mostrará una burbuja de `Pensando...`. Ahí puedes ver el proceso lógico de la IA.
* **Citas:** El asistente incluirá menciones automáticas a los archivos de origen en sus respuestas.

### 4. Funciones Avanzadas 🧠

#### **Auditoría de Fuentes (Panel de Inteligencia)**
Para verificar la veracidad, haz clic en el botón morado (ej: `✨ 3 fuentes consultadas`) bajo la respuesta.
* Se abrirá un panel derecho con los **fragmentos exactos** recuperados y su **porcentaje de similitud**.

#### **Referencias Cruzadas (`@` Tool Calling)**
Consulta otros notebooks sin salir del actual:
1.  Escribe el símbolo **`@`** en el chat.
2.  Selecciona el notebook de la lista desplegable.
3.  Haz tu pregunta (ej: *"¿Cómo aplica lo que hablamos en @Proyecto_Final a estos documentos?"*).

#### **Generación y Descarga de Artefactos 📊**
Pide a la IA que cree archivos reales (gráficas, tablas, PDFs).
* **Petición:** *"Genera un PDF con una tabla comparativa de mis fuentes"*.
* **Visualización:** El archivo aparecerá como una **Tarjeta de Artefacto** en el chat.
* **Vista Previa:** Haz clic en la tarjeta para abrir el visor integrado (PDF o imagen).
* **Descarga:** Haz clic en el botón `Abrir` para guardar el archivo en tu ordenador.

---
