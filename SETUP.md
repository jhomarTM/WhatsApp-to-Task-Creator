# 🔧 Guía de Configuración - WhatsApp Task to Notion

## Paso 1: Crear una Integración en Notion

1. Ve a [Notion Developers](https://www.notion.so/my-integrations)
2. Haz clic en **"+ New integration"**
3. Completa los campos:
   - **Name:** WhatsApp Task Creator
   - **Associated workspace:** Selecciona tu workspace
   - **Type:** Public integration (para OAuth)
4. Haz clic en **"Submit"**

## Paso 2: Configurar OAuth

1. En la página de tu integración, ve a la pestaña **"Distribution"**
2. Activa **"Public integration"**
3. Completa la información requerida:
   - **Company name:** Tu nombre o empresa
   - **Website:** Cualquier URL válida
   - **Tagline:** "Crear tareas desde WhatsApp"
   - **Privacy policy:** Puedes usar cualquier URL
   - **Terms of use:** Puedes usar cualquier URL
4. En **"OAuth Redirect URIs"**, agrega:
   ```
   https://YOUR_EXTENSION_ID.chromiumapp.org/
   ```
   (El ID lo obtendrás después de cargar la extensión)

## Paso 3: Cargar la Extensión en Chrome

1. Abre Chrome y ve a: `chrome://extensions/`
2. Activa el **"Modo desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta del proyecto
5. **Copia el ID de la extensión** que aparece debajo del nombre

## Paso 4: Actualizar Configuración

### En Notion:
1. Vuelve a [tu integración](https://www.notion.so/my-integrations)
2. Actualiza el **Redirect URI** con tu Extension ID:
   ```
   https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/
   ```

### En el código:
1. Abre `background/background.js`
2. Actualiza la configuración:

```javascript
const NOTION_CONFIG = {
  clientId: 'TU_CLIENT_ID_DE_NOTION',
  clientSecret: 'TU_CLIENT_SECRET_DE_NOTION',
  // ...
};
```

3. Abre `manifest.json`
4. Actualiza el `client_id` en la sección `oauth2`:

```json
"oauth2": {
  "client_id": "TU_CLIENT_ID_DE_NOTION",
  "scopes": []
}
```

## Paso 5: Recargar la Extensión

1. Ve a `chrome://extensions/`
2. Haz clic en el ícono de recarga de tu extensión
3. ¡Listo!

## Paso 6: Probar

1. Abre [WhatsApp Web](https://web.whatsapp.com)
2. Haz clic en el ícono de la extensión en la barra de herramientas
3. Conecta tu cuenta de Notion
4. Escribe un mensaje y haz clic en el botón ☑️ para crear una tarea

---

## 🔑 Obtener Credenciales de Notion

### Client ID
1. En tu integración de Notion
2. Pestaña **"Configuration"**
3. Sección **"OAuth Client ID"**

### Client Secret
1. En tu integración de Notion
2. Pestaña **"Secrets"**
3. **"Internal Integration Secret"** (para testing)
4. O genera un **"OAuth client secret"** para producción

---

## ❓ Troubleshooting

### Error: "redirect_uri mismatch"
- Verifica que el Redirect URI en Notion coincida exactamente con:
  `https://TU_EXTENSION_ID.chromiumapp.org/`
- No olvides la barra final `/`

### Error: "Invalid client_id"
- Verifica que el Client ID esté correctamente copiado
- Asegúrate de que la integración sea pública

### El botón no aparece en WhatsApp
- Recarga la página de WhatsApp Web
- Verifica que la extensión esté activada
- Revisa la consola del navegador (F12) por errores

### Error al crear tarea
- Asegúrate de que la integración tenga acceso a la base de datos
- En Notion, abre la base de datos → ... → Connections → Añade tu integración

