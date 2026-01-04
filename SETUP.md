# 🔧 Guía de Configuración - WhatsApp Task to Notion

## Arquitectura de la Integración

Esta extensión usa **Internal Integration** de Notion (NO OAuth), que es el método recomendado para integraciones privadas/de uso interno.

### Características principales:

- ✅ **Internal Integration Token**: Autenticación simple con token `secret_xxx`
- ✅ **Compatible con cuenta Notion Free**: No requiere plan de pago
- ✅ **Privada**: Solo funciona con tu workspace
- ✅ **Segura**: Token almacenado localmente en Chrome
- ✅ **Sin OAuth**: No requiere client_id, client_secret ni redirect_uri

### Cómo funciona Notion API (2024-2025):

1. **El bot solo ve lo que compartes**: No tiene acceso global al workspace
2. **Debes compartir explícitamente**: Cada base de datos debe ser compartida con la integración
3. **Token permanente**: El Internal Integration Token no expira (a menos que lo revoques)
4. **Sin acceso a usuarios**: Con Internal Integration no puedes obtener lista de usuarios del workspace

---

## Paso 1: Crear Internal Integration en Notion

1. Ve a [Notion Integrations](https://www.notion.so/my-integrations)
2. Haz clic en **"+ New integration"**
3. Completa los campos:
   - **Name**: `WhatsApp Task Creator` (o el nombre que prefieras)
   - **Associated workspace**: Selecciona tu workspace
   - **Type**: **Internal** (NO Public)
4. Haz clic en **"Submit"**

### ⚠️ IMPORTANTE: Tipo Internal vs Public

- **Internal**: Para uso personal/privado. NO requiere OAuth. Usa token `secret_xxx`
- **Public**: Para integraciones públicas multi-usuario. Requiere OAuth y configuración adicional

**Esta extensión usa Internal Integration.**

---

## Paso 2: Obtener el Internal Integration Token

1. En la página de tu integración recién creada
2. Ve a la pestaña **"Secrets"**
3. Copia el **"Internal Integration Token"**
   - Formato: `secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - ⚠️ **Mantén este token seguro**. No lo compartas públicamente.

---

## Paso 3: Compartir Bases de Datos con la Integración

**CRÍTICO**: El bot solo puede acceder a bases de datos que compartas explícitamente.

### Para cada base de datos que quieras usar:

1. Abre la base de datos en Notion
2. Haz clic en **"..."** (menú) en la esquina superior derecha
3. Selecciona **"Connections"** o **"Add connections"**
4. Busca tu integración (`WhatsApp Task Creator`)
5. Haz clic para conectarla
6. ✅ La base de datos ahora es accesible para la integración

### Verificar acceso:

- Si la base de datos está compartida, aparecerá en la lista cuando uses la extensión
- Si no aparece, verifica que la hayas compartido correctamente

---

## Paso 4: Cargar la Extensión en Chrome

1. Abre Chrome y ve a: `chrome://extensions/`
2. Activa el **"Modo desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta del proyecto
5. ✅ La extensión debería aparecer en tu lista

---

## Paso 5: Configurar el Token en la Extensión

1. Haz clic en el ícono de la extensión en la barra de herramientas de Chrome
2. En el popup, verás un campo para ingresar el **Internal Integration Token**
3. Pega el token que copiaste en el Paso 2
4. Haz clic en **"Conectar con Notion"**
5. Si el token es válido, verás el estado "Conectado"

### Verificar conexión:

- El popup mostrará "Bot conectado" y el número de bases de datos accesibles
- Si hay error, revisa el mensaje y verifica el token

---

## Paso 6: Probar la Extensión

1. Abre [WhatsApp Web](https://web.whatsapp.com)
2. Deberías ver un botón ☑️ junto al campo de mensaje
3. Haz clic en el botón
4. Completa el formulario:
   - **Título**: Requerido
   - **Descripción**: Opcional (se agrega como contenido de la página)
   - **Fecha límite**: Opcional (si tu DB tiene propiedad date)
   - **Prioridad**: Opcional (si tu DB tiene propiedad select/status)
   - **Base de datos**: Selecciona una de las disponibles
5. Haz clic en **"Crear tarea"**
6. ✅ La tarea debería aparecer en Notion

---

## 📚 Variables de Configuración

### Variables necesarias:

- **NOTION_TOKEN**: Internal Integration Token (`secret_xxx...`)
  - Se almacena en `chrome.storage.local`
  - No se requiere configuración en código

### Variables opcionales:

- **DATABASE_ID**: ID de la última base de datos usada
  - Se guarda automáticamente para uso futuro
  - Se almacena en `chrome.storage.local`

---

## 🔍 Ejemplos de Requests HTTP

### 1. Verificar conectividad

```http
GET /v1/users/me HTTP/1.1
Host: api.notion.com
Authorization: Bearer secret_xxx...
Notion-Version: 2022-06-28
```

**Respuesta exitosa:**
```json
{
  "object": "user",
  "id": "bot_id",
  "name": "WhatsApp Task Creator",
  "type": "bot"
}
```

### 2. Buscar bases de datos

```http
POST /v1/search HTTP/1.1
Host: api.notion.com
Authorization: Bearer secret_xxx...
Notion-Version: 2022-06-28
Content-Type: application/json

{
  "filter": {
    "property": "object",
    "value": "database"
  },
  "sort": {
    "direction": "descending",
    "timestamp": "last_edited_time"
  }
}
```

### 3. Obtener esquema de base de datos

```http
GET /v1/databases/{database_id} HTTP/1.1
Host: api.notion.com
Authorization: Bearer secret_xxx...
Notion-Version: 2022-06-28
```

### 4. Crear página en base de datos

```http
POST /v1/pages HTTP/1.1
Host: api.notion.com
Authorization: Bearer secret_xxx...
Notion-Version: 2022-06-28
Content-Type: application/json

{
  "parent": {
    "database_id": "database_id"
  },
  "properties": {
    "Name": {
      "title": [
        {
          "text": {
            "content": "Mi tarea"
          }
        }
      ]
    },
    "Date": {
      "date": {
        "start": "2024-12-31"
      }
    },
    "Priority": {
      "select": {
        "name": "Alta"
      }
    }
  },
  "children": [
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [
          {
            "text": {
              "content": "Descripción de la tarea"
            }
          }
        ]
      }
    }
  ]
}
```

### 5. Agregar contenido a página existente

```http
PATCH /v1/blocks/{page_id}/children HTTP/1.1
Host: api.notion.com
Authorization: Bearer secret_xxx...
Notion-Version: 2022-06-28
Content-Type: application/json

{
  "children": [
    {
      "object": "block",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [
          {
            "text": {
              "content": "Texto adicional"
            }
          }
        ]
      }
    }
  ]
}
```

---

## ⚠️ Límites de Cuenta Notion Free

### Límites de API:

- ✅ **Sin límite de requests**: La API funciona igual en plan Free
- ✅ **Sin límite de páginas**: Puedes crear todas las páginas que quieras
- ⚠️ **Rate limiting**: ~3 requests por segundo (suficiente para uso normal)
- ⚠️ **Sin acceso a usuarios**: Con Internal Integration no puedes obtener lista de usuarios

### Límites de la extensión:

- ✅ Compatible con cuenta Free
- ✅ Sin restricciones adicionales
- ⚠️ Solo puedes usar bases de datos que compartas manualmente

---

## ❓ Troubleshooting

### Error: "Token inválido"

- Verifica que el token comience con `secret_`
- Asegúrate de haber copiado el token completo
- Verifica que no haya espacios al inicio/final
- El token debe ser de tipo **Internal Integration**, no OAuth

### Error: "Sin permisos" o "Sin acceso a esta base de datos"

- **Solución**: Comparte la base de datos con la integración
  1. Abre la base de datos en Notion
  2. Menú "..." → "Connections"
  3. Conecta tu integración

### Error: "No se encontraron bases de datos"

- Verifica que hayas compartido al menos una base de datos con la integración
- Las bases de datos deben estar compartidas explícitamente
- El bot NO tiene acceso global al workspace

### El botón no aparece en WhatsApp Web

- Recarga la página de WhatsApp Web
- Verifica que la extensión esté activada en `chrome://extensions/`
- Abre DevTools (F12) y revisa la consola por errores
- Verifica que estés en `web.whatsapp.com` (no en la app móvil)

### Error al crear tarea: "Error de validación"

- Verifica que la base de datos tenga una propiedad de tipo **"title"**
- Asegúrate de que los valores de select/status existan en el schema
- Verifica que las fechas estén en formato ISO (YYYY-MM-DD)

### Error 401: Unauthorized

- El token puede haber sido revocado
- Ve a [my-integrations](https://www.notion.so/my-integrations) y verifica el token
- Genera un nuevo token si es necesario

### Error 403: Forbidden

- La base de datos no está compartida con la integración
- Comparte la base de datos siguiendo el Paso 3

### Error 404: Not Found

- Verifica que el ID de la base de datos sea correcto
- Asegúrate de que la base de datos exista y esté compartida

---

## 🔒 Seguridad

### Buenas prácticas:

- ✅ **Nunca compartas tu token públicamente**
- ✅ El token se almacena localmente en Chrome (encriptado)
- ✅ Solo se envía a `api.notion.com`
- ✅ No hay servidor intermediario

### Revocar acceso:

Si necesitas revocar el acceso:

1. Ve a [my-integrations](https://www.notion.so/my-integrations)
2. Selecciona tu integración
3. Haz clic en **"Delete"** o **"Revoke token"**
4. En la extensión, haz clic en **"Desconectar cuenta"**

---

## 📖 Referencias

- [Notion API Getting Started](https://developers.notion.com/docs/getting-started)
- [Notion API Reference](https://developers.notion.com/reference/intro)
- [Notion Authorization Guide](https://developers.notion.com/docs/authorization)
- [Internal Integrations](https://developers.notion.com/docs/authorization#internal-integrations)

---

## 🎯 Resumen Rápido

1. ✅ Crear Internal Integration en Notion
2. ✅ Copiar el token `secret_xxx...`
3. ✅ Compartir bases de datos con la integración
4. ✅ Cargar extensión en Chrome
5. ✅ Ingresar token en el popup
6. ✅ ¡Listo para usar!

---

<p align="center">
  <strong>Hecho con ❤️ para productividad</strong>
</p>
