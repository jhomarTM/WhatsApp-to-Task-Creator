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

Antes de usar la extensión, necesitas configurar una integración de Notion:

1. Ve a [Notion Developers](https://developers.notion.com/)
2. Crea una nueva integración (New integration)
3. Copia el **Client ID** y **Client Secret**
4. Configura la **Redirect URI** con: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
5. Edita `background/background.js` y actualiza:

```javascript
const NOTION_CONFIG = {
  clientId: 'TU_CLIENT_ID',
  clientSecret: 'TU_CLIENT_SECRET',
  // ...
};
```

6. En el `manifest.json`, actualiza el campo `oauth2.client_id`

### Obtener el Extension ID

1. Carga la extensión en Chrome
2. Ve a `chrome://extensions/`
3. Copia el ID que aparece debajo del nombre de la extensión
4. Actualiza la Redirect URI en Notion y en `manifest.json`

## 🚀 Uso

1. **Conecta con Notion**
   - Haz clic en el ícono de la extensión
   - Presiona "Conectar con Notion"
   - Autoriza el acceso a tu workspace

2. **Crea una tarea**
   - Abre [WhatsApp Web](https://web.whatsapp.com)
   - Escribe un mensaje o selecciona una conversación
   - Haz clic en el botón ☑️ junto al campo de mensaje
   - Completa el formulario y presiona "Crear tarea"

## 📁 Estructura del Proyecto

```
├── manifest.json           # Configuración de la extensión
├── background/
│   └── background.js       # Service worker: OAuth y API
├── content/
│   ├── content.js          # Script inyectado en WhatsApp
│   └── content.css         # Estilos del sidebar
├── popup/
│   ├── popup.html          # UI de configuración
│   ├── popup.css           # Estilos del popup
│   └── popup.js            # Lógica del popup
├── utils/
│   └── notion-api.js       # Wrapper para la API de Notion
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
- [x] OAuth con Notion
- [x] Formulario con campos esenciales
- [ ] Captura desde mensaje existente (click derecho)
- [ ] Plantillas de tareas predefinidas
- [ ] Atajos de teclado
- [ ] Soporte para múltiples workspaces

## ⚠️ Limitaciones conocidas

- WhatsApp Web puede cambiar su interfaz, lo que puede romper los selectores DOM
- La API de Notion tiene rate limits (3 peticiones/segundo aprox.)
- El OAuth token expira y puede requerir reconexión

## 📄 Licencia

MIT License - Usa y modifica libremente.

---

<p align="center">
  Hecho con ❤️ para productividad
</p>

