/**
 * Popup Script - WhatsApp Task Creator
 */

document.addEventListener('DOMContentLoaded', async () => {
  const states = {
    loading: document.getElementById('state-loading'),
    setup: document.getElementById('state-setup'),
    ready: document.getElementById('state-ready')
  };

  const elements = {
    configForm: document.getElementById('config-form'),
    tokenInput: document.getElementById('notion-token'),
    databaseInput: document.getElementById('notion-database'),
    btnSave: document.getElementById('btn-save'),
    btnTest: document.getElementById('btn-test'),
    btnReset: document.getElementById('btn-reset'),
    taskCount: document.getElementById('task-count'),
    dbName: document.getElementById('db-name'),
    message: document.getElementById('message')
  };

  // Cambiar estado
  function showState(stateName) {
    Object.values(states).forEach(s => s.classList.remove('active'));
    states[stateName]?.classList.add('active');
  }

  // Mostrar mensaje
  function showMessage(type, text) {
    elements.message.textContent = text;
    elements.message.className = `message show ${type}`;
    setTimeout(() => {
      elements.message.classList.remove('show');
    }, 3000);
  }

  // Verificar configuración
  async function checkConfig() {
    showState('loading');
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      
      if (response.configured) {
        await loadReadyState();
        showState('ready');
      } else {
        showState('setup');
      }
    } catch (error) {
      console.error('Error:', error);
      showState('setup');
    }
  }

  // Cargar estado "listo"
  async function loadReadyState() {
    // Cargar contador de tareas
    try {
      const result = await chrome.storage.local.get(['tasks']);
      const tasks = result.tasks || [];
      elements.taskCount.textContent = tasks.length;
    } catch (e) {
      console.error('Error cargando tareas:', e);
    }

    // Probar conexión para obtener nombre de DB
    try {
      const testResult = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
      if (testResult.success && testResult.database) {
        elements.dbName.textContent = testResult.database.title;
      }
    } catch (e) {
      console.error('Error probando conexión:', e);
    }
  }

  // Guardar configuración
  elements.configForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = elements.tokenInput.value.trim();
    const databaseId = elements.databaseInput.value.trim();
    
    if (!token || !databaseId) {
      showMessage('error', 'Completa todos los campos');
      return;
    }

    elements.btnSave.disabled = true;
    elements.btnSave.textContent = 'Guardando...';

    try {
      // Guardar configuración
      await chrome.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        token: token,
        databaseId: databaseId
      });

      // Probar conexión
      const testResult = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
      
      if (testResult.success) {
        showMessage('success', '¡Conexión exitosa!');
        setTimeout(() => {
          checkConfig();
        }, 1000);
      } else {
        showMessage('error', testResult.error || 'Error de conexión');
      }
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      elements.btnSave.disabled = false;
      elements.btnSave.textContent = '💾 Guardar configuración';
    }
  });

  // Probar conexión
  elements.btnTest?.addEventListener('click', async () => {
    elements.btnTest.disabled = true;
    elements.btnTest.textContent = 'Probando...';

    try {
      const result = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
      
      if (result.success) {
        showMessage('success', `✅ Conectado a "${result.database.title}"`);
        elements.dbName.textContent = result.database.title;
      } else {
        showMessage('error', result.error || 'Error de conexión');
      }
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      elements.btnTest.disabled = false;
      elements.btnTest.textContent = '🔄 Probar conexión';
    }
  });

  // Resetear configuración
  elements.btnReset?.addEventListener('click', async () => {
    if (confirm('¿Seguro que quieres cambiar la configuración?')) {
      await chrome.storage.local.remove(['notionToken', 'notionDatabaseId']);
      showState('setup');
    }
  });

  // Iniciar
  await checkConfig();
});
