# WhatsApp Task to Notion

<p align="center">
  <img src="icons/icon.svg" width="128" height="128" alt="Logo">
</p>

<p align="center">
  <strong>Crea tareas en Notion directamente desde WhatsApp Web</strong>
</p>

---

## ✨ Características

- 📝 **Captura rápida** - Botón integrado en WhatsApp Web para crear tareas
- 🎯 **Formulario completo** - Título, descripción, fecha, prioridad y más
- 🔗 **Integración con Notion** - Conecta tu workspace y selecciona la base de datos
- 🌙 **Tema oscuro** - Diseño que se integra perfectamente con WhatsApp Web
- ⚡ **Rápido** - Crea tareas en menos de 15 segundos

## 📦 Instalación

### Desde el código fuente (desarrollo)

1. Clona o descarga este repositorio
2. Abre Chrome y ve a `chrome://extensions/`
3. Activa el **Modo desarrollador** (esquina superior derecha)
4. Haz clic en **Cargar descomprimida**
5. Selecciona la carpeta del proyecto

### Configuración de Notion

Esta extensión usa **Internal Integration** de Notion (NO OAuth). Es más simple y no requiere configuración en código:

1. Ve a [Notion Integrations](https://www.notion.so/my-integrations)
2. Crea una nueva integración (tipo **Internal**)
3. Copia el **Internal Integration Token** (formato: `secret_xxx...`)
4. Comparte tus bases de datos con la integración:
   - Abre cada base de datos en Notion
   - Menú "..." → "Connections" → Conecta tu integración
5. En la extensión, ingresa el token en el popup

📖 **Guía completa**: Ver [SETUP.md](./SETUP.md) para instrucciones detalladas.

## 🚀 Uso

1. **Conecta con Notion**
   - Haz clic en el ícono de la extensión
   - Ingresa tu **Internal Integration Token** (obténlo en [my-integrations](https://www.notion.so/my-integrations))
   - Presiona "Conectar con Notion"
   - ✅ Verifica que aparezcan tus bases de datos

2. **Crea una tarea**
   - Abre [WhatsApp Web](https://web.whatsapp.com)
   - Escribe un mensaje o selecciona una conversación
   - Haz clic en el botón ☑️ junto al campo de mensaje
   - Completa el formulario y presiona "Crear tarea"

## 📁 Estructura del Proyecto

```
├── manifest.json           # Configuración de la extensión
├── background/
│   └── background.js       # Service worker: Internal Integration Token y API
├── content/
│   ├── content.js          # Script inyectado en WhatsApp
│   └── content.css         # Estilos del sidebar
├── popup/
│   ├── popup.html          # UI de configuración (token input)
│   ├── popup.css           # Estilos del popup
│   └── popup.js            # Lógica del popup
├── utils/
│   └── notion-api.js       # Wrapper para la API de Notion
├── SETUP.md                # Guía completa de configuración
└── NOTION_API_EXAMPLES.md  # Ejemplos de código
├── icons/
│   └── icon.svg            # Ícono de la extensión
└── README.md
```

## 🎨 Personalización

### Colores

Los colores siguen el tema de WhatsApp. Puedes modificarlos en `content/content.css`:

```css
:root {
  --wtn-primary: #00a884;         /* Verde principal */
  --wtn-bg-dark: #111b21;         /* Fondo oscuro */
  --wtn-bg-card: #1f2c34;         /* Fondo de tarjetas */
  --wtn-text: #e9edef;            /* Texto principal */
}
```

### Campos del formulario

Puedes agregar o quitar campos editando el HTML en `content/content.js` dentro de la función `getSidebarHTML()`.

## 🔒 Seguridad y Privacidad

- ✅ Los mensajes solo se procesan localmente
- ✅ No hay servidor intermediario
- ✅ El token de Notion se almacena encriptado por Chrome
- ✅ Solo se envía a Notion lo que el usuario confirma

## 🛠️ Desarrollo

### Requisitos

- Chrome 88+ (Manifest V3)
- Cuenta de Notion con permisos de desarrollador

### Debugging

1. Abre `chrome://extensions/`
2. En tu extensión, haz clic en "Service Worker" para ver logs del background
3. En WhatsApp Web, abre DevTools (F12) para ver logs del content script

## 📋 Roadmap

- [x] MVP - Captura básica y creación de tareas
- [x] Internal Integration con Notion (2024-2025)
- [x] Formulario con campos esenciales
- [x] Manejo dinámico de propiedades de base de datos
- [x] Agregar contenido a páginas existentes
- [ ] Captura desde mensaje existente (click derecho)
- [ ] Plantillas de tareas predefinidas
- [ ] Atajos de teclado
- [ ] Soporte para múltiples workspaces

## ⚠️ Limitaciones conocidas

- WhatsApp Web puede cambiar su interfaz, lo que puede romper los selectores DOM
- La API de Notion tiene rate limits (~3 peticiones/segundo)
- El bot solo ve bases de datos que compartas explícitamente
- Con Internal Integration no puedes obtener lista de usuarios del workspace
- Compatible con cuenta Notion Free (sin límites adicionales)

## 📄 Licencia

MIT License - Usa y modifica libremente.

---

<p align="center">
  Hecho con ❤️ para productividad
</p>

