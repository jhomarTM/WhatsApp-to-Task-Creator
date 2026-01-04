/**
 * Popup Script - WhatsApp Task Creator
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Cargar contador de tareas
  try {
    const result = await chrome.storage.local.get(['tasks']);
    const tasks = result.tasks || [];
    document.getElementById('task-count').textContent = tasks.length;
  } catch (e) {
    console.error('Error cargando tareas:', e);
  }

  // Botón ver tareas
  document.getElementById('btn-view-tasks')?.addEventListener('click', () => {
    // Por ahora, mostrar en consola
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      console.log('📋 Tareas guardadas:', tasks);
      
      if (tasks.length === 0) {
        alert('No hay tareas guardadas todavía.\n\nVe a WhatsApp Web y haz clic en el botón ☑️ sobre cualquier mensaje para crear tu primera tarea.');
      } else {
        // Crear ventana simple con las tareas
        let taskList = tasks.map((t, i) => 
          `${i + 1}. ${t.title}${t.priority ? ` [${t.priority}]` : ''}${t.dueDate ? ` - ${t.dueDate}` : ''}`
        ).join('\n');
        
        alert(`📋 Tus tareas (${tasks.length}):\n\n${taskList}`);
      }
    });
  });
});
