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
    openaiKeyInput: document.getElementById('openai-key'),
    btnSave: document.getElementById('btn-save'),
    btnTest: document.getElementById('btn-test'),
    btnLogout: document.getElementById('btn-logout'),
    taskCount: document.getElementById('task-count'),
    dbName: document.getElementById('db-name'),
    notionStatus: document.getElementById('notion-status'),
    openaiStatus: document.getElementById('openai-status'),
    message: document.getElementById('message')
  };

  function showState(stateName) {
    Object.values(states).forEach(s => s.classList.remove('active'));
    states[stateName]?.classList.add('active');
  }

  function showMessage(type, text) {
    elements.message.textContent = text;
    elements.message.className = `message show ${type}`;
    setTimeout(() => {
      elements.message.classList.remove('show');
    }, 4000);
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
      const result = await chrome.storage.local.get(['tasks', 'openaiKey']);
      const tasks = result.tasks || [];
      elements.taskCount.textContent = tasks.length;
      
      // Estado de OpenAI
      if (result.openaiKey) {
        elements.openaiStatus.textContent = 'Conectado';
        elements.openaiStatus.classList.add('connected');
      } else {
        elements.openaiStatus.textContent = 'No configurado';
        elements.openaiStatus.classList.remove('connected');
      }
    } catch (e) {
      console.error('Error:', e);
    }

    // Probar conexión Notion
    try {
      const testResult = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
      if (testResult.success && testResult.database) {
        elements.dbName.textContent = testResult.database.title;
        elements.notionStatus.textContent = 'Conectado';
        elements.notionStatus.classList.add('connected');
      } else {
        elements.notionStatus.textContent = 'Error';
        elements.notionStatus.classList.remove('connected');
      }
    } catch (e) {
      console.error('Error:', e);
    }
  }

  // Guardar configuración
  elements.configForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = elements.tokenInput.value.trim();
    const databaseId = elements.databaseInput.value.trim();
    const openaiKey = elements.openaiKeyInput.value.trim();
    
    if (!token || !databaseId) {
      showMessage('error', 'Token y Database ID son requeridos');
      return;
    }

    elements.btnSave.disabled = true;
    elements.btnSave.textContent = 'Conectando...';

    try {
      // Guardar configuración
      await chrome.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        token: token,
        databaseId: databaseId,
        openaiKey: openaiKey || null
      });

      // Probar conexión con Notion
      const testResult = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
      
      if (testResult.success) {
        showMessage('success', '¡Configuración guardada!');
        setTimeout(() => checkConfig(), 1000);
      } else {
        showMessage('error', testResult.error || 'Error de conexión con Notion');
      }
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      elements.btnSave.disabled = false;
      elements.btnSave.textContent = '💾 Guardar y conectar';
    }
  });

  // Probar conexión
  elements.btnTest?.addEventListener('click', async () => {
    elements.btnTest.disabled = true;
    elements.btnTest.textContent = 'Probando...';

    try {
      const result = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
      
      if (result.success) {
        showMessage('success', `✅ Notion conectado: "${result.database.title}"`);
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

  // Cerrar sesión
  elements.btnLogout?.addEventListener('click', async () => {
    if (confirm('¿Seguro que quieres cerrar sesión?\n\nSe eliminarán todas las credenciales guardadas.')) {
      await chrome.storage.local.remove([
        'notionToken', 
        'notionDatabaseId', 
        'openaiKey',
        'tasks'
      ]);
      showMessage('success', 'Sesión cerrada');
      setTimeout(() => showState('setup'), 500);
    }
  });

  // Iniciar
  await checkConfig();
});
