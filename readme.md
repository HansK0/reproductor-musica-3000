# 🎵 Reproductor de Musica 3000

Reproductor de música de escritorio, local y sin conexión, construido con Electron. Escanea tu propia biblioteca de archivos de audio y los reproduce sin depender de streaming, cuentas ni servicios externos.

---

## 📋 Tabla de contenidos

- [Qué hace](#-qué-hace)
- [Cómo funciona](#-cómo-funciona)
- [Recursos usados](#-recursos-usados)
- [Estructura de carpetas](#-estructura-de-carpetas)
- [Instalación y uso](#-instalación-y-uso)
- [Contribuciones](#-contribuciones)

---

## ✨ Qué hace

- Escanea carpetas o archivos individuales de tu equipo y arma una biblioteca local.
- Reproduce, pausa, avanza, retrocede, con modo aleatorio y repetición.
- Recuerda tu última sesión (canción, volumen, modo de reproducción) al reabrir la app.
- Permite eliminar canciones de la biblioteca desde un menú contextual.
- Muestra notificaciones nativas del sistema cuando cambia la canción y la app no está en foco.

---

## ⚙️ Cómo funciona

El proyecto sigue el modelo de seguridad de tres capas recomendado por Electron — separar quién tiene acceso a qué, en vez de darle todo el poder a la interfaz.

```
┌─────────────┐        IPC        ┌─────────────┐     contextBridge    ┌──────────────┐
│   main.js   │ ◄───────────────► │ preload.js  │ ◄──────────────────► │  renderer.js │
│ (Node full) │                   │  (puente)   │                      │  (sandbox)   │
└─────────────┘                   └─────────────┘                      └──────────────┘
     │
     ├── Acceso al sistema de archivos (escaneo de biblioteca)
     ├── electron-store (persistencia de config/última sesión)
     └── Ventanas, notificaciones, thumbar de Windows
```

- **`main.js`** es el único lugar con acceso completo a Node.js: lee/escribe archivos, escanea carpetas de música, guarda configuración en disco, crea ventanas.
- **`preload.js`** expone únicamente las funciones puntuales que la interfaz necesita (vía `contextBridge`), básicamente el puente que permite la conexión entre la interfaz y la instancia de Node.
- **`renderer.js`** corre en un contexto aislado (sandbox). Todo lo que necesita del sistema lo pide a través de `window.electronAPI`, que por debajo viaja como mensajes IPC hacia `main.js`.

---


## 📦 Recursos usados

| Recurso | Versión | Uso en el proyecto | Por qué este recurso |
|---|---|---|---|
| [`music-metadata`](https://www.npmjs.com/package/music-metadata#ioptions-interface) | `^X.X.X` | Extraer metadata de archivos de audio (por ahora solo duración) | Soporta múltiples formatos (mp3, m4a, flac...) sin depender de un binario externo |
| [`electron-store`](https://github.com/sindresorhus/electron-store/blob/v8.2.0/readme.md) | `8.2.0` (fija) | Persistencia de configuración y última sesión en `.json` | Esta es la última versión compatible con CommonJS |
| [Lucide](https://lucide.dev/) | SVG embebidos | Íconos de la interfaz | Se embebe como SVG inline, funcionando offline (configuración por defecto: `stroke="currentColor"`, `stroke-width="2"`, `24x24`, `color:#fff`) |

(icono actual sacado de https://icon-icons.com/es/authors/29-chrisbanks2)

---

## 🗂️ Estructura de carpetas

```
proyecto/
├── main.js                # Proceso principal: ventanas, IPC, store, escaneo de archivos
├── preload.js             # Puente seguro main ↔ renderer (contextBridge)
├── /renderer              # Lógica de interfaz (HTML, CSS, JS)
├── /assets                # Íconos de la app (.ico, .icns, .png para distintas plataformas)
└── package.json
```

---

## 🚀 Instalación y uso

### Requisitos
- [Node.js](https://nodejs.org/) 18 o superior
- npm

### Setup

```bash
git clone https://github.com/HansK0/reproductor-musica-3000.git
cd reproductor-musica-3000
npm install
```

### Desarrollo

```bash
npm run dev
```
---

## 🤝 Contribuciones

¡Toda contribución es bienvenida! Ya sea un fix pequeño, una idea nueva, o mejorar la documentación.

### Cómo empezar

1. Haz un **fork** del repositorio y clónalo localmente.
2. Crea una rama descriptiva para tu cambio:
   ```bash
   git checkout -b feature/nombre-de-tu-cambio
   ```
3. Instala dependencias y corre la app en modo desarrollo (`npm install && npm run dev`) para probar tus cambios en vivo.
4. Sigue las convenciones ya usadas en el proyecto (ver abajo) antes de abrir tu Pull Request.
5. Haz commits claros y atómicos — un commit, un cambio lógico. Se recomienda el formato [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.), aunque no es obligatorio todavía.
6. Abre un Pull Request explicando **qué** cambia y **por qué** — no hace falta que sea extenso, pero sí claro.

---

### Convenciones del proyecto

- **Naming:** camelCase, en inglés, para variables y funciones (`currentSongRow`, `updateTotalTime`). El texto visible para el usuario final (mensajes, botones) se mantiene en español.
- **Separación de capas:** cualquier operación que toque el sistema de archivos o `electron-store` vive en `main.js`, expuesta vía `preload.js`. El renderer nunca debe hacer `require()` de una librería de Node directamente — si necesitas algo del sistema desde la interfaz, expón una función nueva en el preload.
- **Colores e íconos:** los colores están centralizados como variables CSS en `:root` — evita hardcodear un color hex suelto en una regla nueva. Los íconos siguen el estilo Lucide por defecto (ver tabla de dependencias arriba).

---

### Reportar un bug

Abre un [issue](../../issues/new) incluyendo: pasos para reproducirlo, qué esperabas que pasara vs. qué pasó realmente, tu sistema operativo, y capturas o logs de consola si aplica.
