// 任务接口定义
interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  category: 'today' | 'important' | 'someday';
  important: boolean;
  dueDate: string | null; // 格式: YYYY-MM-DD
  deletedAt?: number; // 删除时间，用于回收站
}

// 应用状态
interface AppState {
  tasks: Task[];
  deletedTasks: Task[]; // 已删除任务
  statusFilter: 'all' | 'today' | 'active' | 'completed' | 'deleted'; // 主筛选（单选）
  tags: ('important' | 'someday')[]; // 多选标签
  version?: number; // 数据版本
}

// 本地存储键名
const STORAGE_KEY = 'zen-tasks-data';
const DATA_VERSION = 2; // 数据版本号，用于迁移

// 从本地存储加载数据
function loadFromStorage(): AppState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      
      // 数据迁移：版本1 -> 版本2（清除自动设置的默认日期）
      const currentVersion = parsed.version || 1;
      
      // 兼容旧任务数据
      if (parsed.tasks) {
        parsed.tasks = parsed.tasks.map((task: Task) => ({
          ...task,
          important: task.important ?? false,
          dueDate: task.dueDate ?? null
        }));
        
        // 版本迁移：如果任务的 dueDate 等于创建日期，清除它（这是之前自动设置的默认值）
        if (currentVersion < 2) {
          parsed.tasks = parsed.tasks.map((task: Task) => {
            if (task.dueDate) {
              const createdDate = new Date(task.createdAt).toISOString().split('T')[0];
              // 如果日期等于创建日期，说明是自动设置的默认值，清除它
              if (task.dueDate === createdDate) {
                return { ...task, dueDate: null };
              }
            }
            return task;
          });
        }
      }
      if (parsed.deletedTasks) {
        parsed.deletedTasks = parsed.deletedTasks.map((task: Task) => ({
          ...task,
          important: task.important ?? false,
          dueDate: task.dueDate ?? null
        }));
      }
      
      // 兼容旧的状态结构
      let statusFilter: 'all' | 'today' | 'active' | 'completed' | 'deleted' = 'all';
      let tags: ('important' | 'someday')[] = [];
      
      if (parsed.statusFilter) {
        statusFilter = parsed.statusFilter;
      } else if (parsed.filter) {
        // 兼容旧的 filter 字段
        statusFilter = parsed.filter;
      }
      
      if (parsed.tags) {
        tags = parsed.tags.filter((t: string) => t !== 'all'); // 过滤掉旧的 'all'
      } else if (parsed.category) {
        // 兼容旧的 category 字段
        tags = parsed.category === 'today' ? [] : [parsed.category];
      }
      
      // 保存迁移后的数据
      const newState = {
        tasks: parsed.tasks || [],
        deletedTasks: parsed.deletedTasks || [],
        statusFilter,
        tags,
        version: DATA_VERSION
      };
      saveToStorage(newState);
      
      return newState;
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return {
    tasks: [],
    deletedTasks: [],
    statusFilter: 'all',
    tags: [],
    version: DATA_VERSION
  };
}

// 保存到本地存储
function saveToStorage(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: DATA_VERSION }));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
}

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化日期显示
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateOnly = date.toDateString();
  
  if (dateOnly === today.toDateString()) {
    return '今天';
  } else if (dateOnly === tomorrow.toDateString()) {
    return '明天';
  } else {
    // 格式化为中文日期
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  }
}

// 判断是否过期
function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// 应用状态实例
let appState: AppState = loadFromStorage();

// 创建涟漪效果
function createRipple(event: MouseEvent, element: HTMLElement): void {
  const ripple = document.createElement('span');
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.classList.add('ripple-effect');
  
  element.appendChild(ripple);
  
  setTimeout(() => ripple.remove(), 600);
}

// 渲染任务列表
function renderTasks(): void {
  const tasksContainer = document.getElementById('tasks-container');
  const pcTasksContainer = document.getElementById('pc-tasks-container');

  // 如果是已删除过滤器，渲染已删除的任务
  if (appState.statusFilter === 'deleted') {
    if (tasksContainer) renderDeletedTasks(tasksContainer);
    if (pcTasksContainer) renderDeletedTasks(pcTasksContainer);
    return;
  }

  // 按状态筛选
  let filteredTasks = appState.tasks.filter(task => {
    if (appState.statusFilter === 'active') return !task.completed;
    if (appState.statusFilter === 'completed') return task.completed;
    if (appState.statusFilter === 'today') {
      // 今日：今天到期或今天创建的任务
      const today = new Date().toISOString().split('T')[0];
      return task.dueDate === today || 
             (task.dueDate === null && new Date(task.createdAt).toDateString() === new Date().toDateString());
    }
    // 'all' 显示所有未删除的任务
    return true;
  });

  // 按标签多选筛选（空数组表示显示全部）
  if (appState.tags.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      const matchImportant = appState.tags.includes('important') && task.important;
      const matchSomeday = appState.tags.includes('someday') && task.dueDate !== null;
      return matchImportant || matchSomeday;
    });
  }

  // 按创建时间倒序排列，未完成的在前，重要的优先
  filteredTasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.important !== b.important) return a.important ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  // 生成任务列表HTML
  const tasksHtml = generateTasksHtml(filteredTasks);
  const emptyHtml = generateEmptyHtml();

  if (filteredTasks.length === 0) {
    if (tasksContainer) tasksContainer.innerHTML = emptyHtml;
    if (pcTasksContainer) pcTasksContainer.innerHTML = emptyHtml;
    return;
  }

  if (tasksContainer) {
    tasksContainer.innerHTML = tasksHtml;
    attachTaskEvents(tasksContainer);
  }
  if (pcTasksContainer) {
    pcTasksContainer.innerHTML = tasksHtml;
    attachTaskEvents(pcTasksContainer);
  }
}

// 生成任务列表HTML
function generateTasksHtml(tasks: Task[]): string {
  return tasks.map((task, index) => {
    const dateDisplay = formatDate(task.dueDate);
    const overdue = !task.completed && isOverdue(task.dueDate);
    
    return `
    <div class="task-item slide-in ${task.completed ? 'completed' : ''} ${task.important ? 'important' : ''}" 
         data-id="${task.id}" 
         style="animation-delay: ${index * 0.05}s;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="zen-checkbox ${task.completed ? 'checked' : ''}" 
             data-action="toggle" 
             data-id="${task.id}"></div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
          <span class="task-text" style="font-size: 0.95rem; ${task.important ? 'font-weight: 500;' : ''}">
            ${task.important ? '<span style="color: var(--accent); margin-right: 0.25rem;">★</span>' : ''}${escapeHtml(task.text)}
          </span>
          ${dateDisplay ? `
            <span style="font-size: 0.75rem; color: ${overdue ? 'var(--danger)' : 'var(--muted)'};">
              ${overdue ? '已过期 · ' : ''}${dateDisplay}
            </span>
          ` : ''}
        </div>
        <button class="delete-btn" data-action="delete" data-id="${task.id}" 
                style="background: none; border: none; color: var(--muted); cursor: pointer; 
                       font-size: 1.25rem; opacity: 0; transition: opacity 0.2s; padding: 0.25rem 0.5rem; border-radius: 8px;">
          ×
        </button>
      </div>
    </div>
  `}).join('');
}

// 生成空状态HTML
function generateEmptyHtml(): string {
  return `
    <div class="empty-state fade-in" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
      <div class="empty-icon" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;">📋</div>
      <p style="margin-bottom: 1rem; font-weight: 500;">暂无任务</p>
      <p class="mobile-only" style="font-size: 0.85rem; opacity: 0.7;">
        点击右下角 <span style="display: inline-block; width: 24px; height: 24px; background: var(--accent); 
        color: white; border-radius: 8px; font-size: 1rem; line-height: 24px; vertical-align: middle;">+</span> 添加任务
      </p>
      <p class="pc-only" style="font-size: 0.85rem; opacity: 0.7;">
        点击左侧「添加任务」按钮创建新任务
      </p>
    </div>
  `;
}

// 添加任务项悬停事件
function attachTaskEvents(container: HTMLElement): void {
  container.querySelectorAll('.task-item').forEach(item => {
    const deleteBtn = item.querySelector('.delete-btn') as HTMLElement;
    item.addEventListener('mouseenter', () => {
      if (deleteBtn) deleteBtn.style.opacity = '1';
    });
    item.addEventListener('mouseleave', () => {
      if (deleteBtn) deleteBtn.style.opacity = '0';
    });
  });
}

// 渲染已删除的任务
function renderDeletedTasks(container: HTMLElement): void {
  if (appState.deletedTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state fade-in" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
        <div style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;">🗑️</div>
        <p style="font-weight: 500;">回收站为空</p>
      </div>
    `;
    return;
  }

  // 按删除时间倒序排列
  const sortedTasks = [...appState.deletedTasks].sort((a, b) => 
    (b.deletedAt || 0) - (a.deletedAt || 0)
  );

  container.innerHTML = sortedTasks.map((task, index) => {
    const deletedDate = task.deletedAt ? new Date(task.deletedAt).toLocaleDateString('zh-CN') : '';
    
    return `
    <div class="task-item slide-in deleted-task" 
         data-id="${task.id}" 
         style="animation-delay: ${index * 0.05}s; opacity: 0.7;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
          <span class="task-text" style="font-size: 0.95rem; ${task.completed ? 'text-decoration: line-through; color: var(--muted);' : ''}">
            ${task.important ? '<span style="color: var(--accent); margin-right: 0.25rem;">★</span>' : ''}${escapeHtml(task.text)}
          </span>
          <span style="font-size: 0.75rem; color: var(--muted);">
            删除于 ${deletedDate}
          </span>
        </div>
        <button class="restore-btn" data-action="restore" data-id="${task.id}">
          恢复
        </button>
        <button class="permanent-delete-btn" data-action="permanent-delete" data-id="${task.id}" 
                style="background: none; border: none; color: var(--danger); cursor: pointer; 
                       font-size: 1.25rem; opacity: 0; transition: opacity 0.2s; padding: 0.25rem 0.5rem; border-radius: 8px;">
          ×
        </button>
      </div>
    </div>
  `}).join('');

  // 添加悬停显示永久删除按钮
  container.querySelectorAll('.deleted-task').forEach(item => {
    const deleteBtn = item.querySelector('.permanent-delete-btn') as HTMLElement;
    item.addEventListener('mouseenter', () => {
      if (deleteBtn) deleteBtn.style.opacity = '1';
    });
    item.addEventListener('mouseleave', () => {
      if (deleteBtn) deleteBtn.style.opacity = '0';
    });
  });
}

// 更新统计信息
function updateStats(): void {
  // 移动端元素
  const totalEl = document.getElementById('total-count');
  const completedEl = document.getElementById('completed-count');
  const activeEl = document.getElementById('active-count');

  // PC端元素
  const pcTotalEl = document.getElementById('pc-total-count');
  const pcCompletedEl = document.getElementById('pc-completed-count');
  const pcActiveEl = document.getElementById('pc-active-count');

  // 如果是已删除过滤器，显示回收站统计
  if (appState.statusFilter === 'deleted') {
    const deletedCount = appState.deletedTasks.length;
    if (totalEl) totalEl.textContent = deletedCount.toString();
    if (completedEl) completedEl.textContent = '-';
    if (activeEl) activeEl.textContent = '-';
    if (pcTotalEl) pcTotalEl.textContent = deletedCount.toString();
    if (pcCompletedEl) pcCompletedEl.textContent = '-';
    if (pcActiveEl) pcActiveEl.textContent = '-';
    return;
  }

  // 使用与 renderTasks 相同的筛选逻辑
  let filteredTasks = appState.tasks.filter(task => {
    if (appState.statusFilter === 'active') return !task.completed;
    if (appState.statusFilter === 'completed') return task.completed;
    if (appState.statusFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return task.dueDate === today || 
             (task.dueDate === null && new Date(task.createdAt).toDateString() === new Date().toDateString());
    }
    return true;
  });

  // 按标签筛选（空数组表示显示全部）
  if (appState.tags.length > 0) {
    filteredTasks = filteredTasks.filter(task => {
      const matchImportant = appState.tags.includes('important') && task.important;
      const matchSomeday = appState.tags.includes('someday') && task.dueDate !== null;
      return matchImportant || matchSomeday;
    });
  }
  
  const total = filteredTasks.length;
  const completed = filteredTasks.filter(t => t.completed).length;
  const active = total - completed;

  // 更新移动端
  if (totalEl) totalEl.textContent = total.toString();
  if (completedEl) completedEl.textContent = completed.toString();
  if (activeEl) activeEl.textContent = active.toString();

  // 更新PC端
  if (pcTotalEl) pcTotalEl.textContent = total.toString();
  if (pcCompletedEl) pcCompletedEl.textContent = completed.toString();
  if (pcActiveEl) pcActiveEl.textContent = active.toString();
}

// 转义 HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 添加任务
function addTask(text: string, important: boolean, dueDate: string | null): void {
  if (!text.trim()) return;
  
  const newTask: Task = {
    id: generateId(),
    text: text.trim(),
    completed: false,
    createdAt: Date.now(),
    category: 'today',
    important,
    dueDate: dueDate  // 不设置默认日期，用户未选择则为 null
  };

  appState.tasks.unshift(newTask);
  saveToStorage(appState);
  renderTasks();
  updateStats();
  
  // 添加完成后收起面板
  toggleAddPanel('mobile', false);
  toggleAddPanel('pc', false);
}

// 添加面板展开状态
let isAddPanelOpen = false;
let isPcAddPanelOpen = false;

// 切换添加面板
function toggleAddPanel(type: 'mobile' | 'pc', open?: boolean): void {
  if (type === 'mobile') {
    const panel = document.getElementById('add-task-panel');
    const btn = document.getElementById('toggle-add-btn');
    
    isAddPanelOpen = open !== undefined ? open : !isAddPanelOpen;
    
    if (panel) {
      if (isAddPanelOpen) {
        panel.style.maxHeight = '200px';
        panel.style.opacity = '1';
        if (btn) btn.textContent = '−';
      } else {
        panel.style.maxHeight = '0';
        panel.style.opacity = '0';
        if (btn) btn.textContent = '+';
      }
    }
    
    // 聚焦输入框
    if (isAddPanelOpen) {
      const input = document.getElementById('task-input') as HTMLInputElement;
      if (input) input.focus();
    }
  } else {
    const panel = document.getElementById('pc-add-task-panel');
    
    isPcAddPanelOpen = open !== undefined ? open : !isPcAddPanelOpen;
    
    if (panel) {
      if (isPcAddPanelOpen) {
        panel.style.maxHeight = '200px';
        panel.style.opacity = '1';
      } else {
        panel.style.maxHeight = '0';
        panel.style.opacity = '0';
      }
    }
    
    // 聚焦输入框
    if (isPcAddPanelOpen) {
      const input = document.getElementById('pc-task-input') as HTMLInputElement;
      if (input) input.focus();
    }
  }
}

// 切换任务状态
function toggleTask(id: string): void {
  const task = appState.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveToStorage(appState);
    renderTasks();
    updateStats();
  }
}

// 删除任务（移入回收站）
function deleteTask(id: string): void {
  const task = appState.tasks.find(t => t.id === id);
  if (task) {
    task.deletedAt = Date.now();
    appState.deletedTasks.unshift(task);
    appState.tasks = appState.tasks.filter(t => t.id !== id);
    saveToStorage(appState);
    renderTasks();
    updateStats();
    updateTrashCount();
  }
}

// 恢复任务
function restoreTask(id: string): void {
  const task = appState.deletedTasks.find(t => t.id === id);
  if (task) {
    delete task.deletedAt;
    appState.tasks.unshift(task);
    appState.deletedTasks = appState.deletedTasks.filter(t => t.id !== id);
    saveToStorage(appState);
    renderTasks();
    updateTrashCount();
  }
}

// 永久删除任务
function permanentDeleteTask(id: string): void {
  appState.deletedTasks = appState.deletedTasks.filter(t => t.id !== id);
  saveToStorage(appState);
  renderTasks();
  updateTrashCount();
}

// 清空回收站
function emptyTrash(): void {
  appState.deletedTasks = [];
  saveToStorage(appState);
  renderTasks();
  updateTrashCount();
}

// 更新回收站计数
// 更新回收站计数（已删除任务数量）
function updateTrashCount(): void {
  const count = appState.deletedTasks.length;
  
  // 更新PC端侧边栏计数
  const pcDeletedCount = document.getElementById('pc-deleted-count');
  if (pcDeletedCount) {
    pcDeletedCount.textContent = count.toString();
  }

  // 更新PC端各状态计数
  const today = new Date().toISOString().split('T')[0];
  const todayCount = appState.tasks.filter(t => 
    t.dueDate === today || (t.dueDate === null && new Date(t.createdAt).toDateString() === new Date().toDateString())
  ).length;
  const allCount = appState.tasks.length;
  const activeCount = appState.tasks.filter(t => !t.completed).length;
  const completedCount = appState.tasks.filter(t => t.completed).length;

  const pcTodayCount = document.getElementById('pc-today-count');
  const pcAllCount = document.getElementById('pc-all-count');
  const pcActiveStatusCount = document.getElementById('pc-active-status-count');
  const pcCompletedStatusCount = document.getElementById('pc-completed-status-count');

  if (pcTodayCount) pcTodayCount.textContent = todayCount.toString();
  if (pcAllCount) pcAllCount.textContent = allCount.toString();
  if (pcActiveStatusCount) pcActiveStatusCount.textContent = activeCount.toString();
  if (pcCompletedStatusCount) pcCompletedStatusCount.textContent = completedCount.toString();
}

// 切换状态筛选（单选）
function switchStatusFilter(filter: 'all' | 'today' | 'active' | 'completed' | 'deleted'): void {
  appState.statusFilter = filter;
  saveToStorage(appState);
  updateFilterUI();
  renderTasks();
  updateStats();
  updateTrashCount();
}

// 切换标签（多选）
// 切换标签（多选）
function toggleTag(tag: 'important' | 'someday'): void {
  // 切换当前标签
  if (appState.tags.includes(tag)) {
    appState.tags = appState.tags.filter(t => t !== tag);
  } else {
    appState.tags.push(tag);
  }
  
  saveToStorage(appState);
  updateFilterUI();
  renderTasks();
  updateStats();
}

// 更新筛选 UI
function updateFilterUI(): void {
  // 更新移动端状态筛选按钮
  document.querySelectorAll('.mobile-status-btn').forEach(btn => {
    const btnFilter = btn.getAttribute('data-status');
    if (btnFilter === appState.statusFilter) {
      btn.classList.add('active');
      (btn as HTMLElement).style.background = 'var(--accent)';
      (btn as HTMLElement).style.color = 'white';
    } else {
      btn.classList.remove('active');
      (btn as HTMLElement).style.background = 'transparent';
      (btn as HTMLElement).style.color = 'var(--muted)';
    }
  });

  // 更新PC端状态筛选按钮
  document.querySelectorAll('.pc-status-btn').forEach(btn => {
    const btnFilter = btn.getAttribute('data-status');
    if (btnFilter === appState.statusFilter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 更新移动端标签按钮
  document.querySelectorAll('.mobile-tag-btn').forEach(btn => {
    const btnTag = btn.getAttribute('data-tag');
    const isSelected = appState.tags.includes(btnTag as 'important' | 'someday');
    if (isSelected) {
      btn.classList.add('active');
      (btn as HTMLElement).style.background = 'var(--accent-light)';
      (btn as HTMLElement).style.color = 'var(--accent)';
      (btn as HTMLElement).style.borderColor = 'var(--accent)';
    } else {
      btn.classList.remove('active');
      (btn as HTMLElement).style.background = 'transparent';
      (btn as HTMLElement).style.color = 'var(--muted)';
      (btn as HTMLElement).style.borderColor = 'var(--border)';
    }
  });

  // 更新PC端标签按钮
  document.querySelectorAll('.pc-tag-btn').forEach(btn => {
    const btnTag = btn.getAttribute('data-tag');
    const isSelected = appState.tags.includes(btnTag as 'important' | 'someday');
    if (isSelected) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// 获取今天的日期字符串 (YYYY-MM-DD)
function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// 初始化应用
export function initApp(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="app-container" style="min-height: 100vh; display: flex; flex-direction: column;">
      <!-- 装饰性背景 -->
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; z-index: -1;">
        <div style="position: absolute; top: 10%; right: 15%; width: 400px; height: 400px; 
             background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%); border-radius: 50%;"></div>
        <div style="position: absolute; bottom: 20%; left: 10%; width: 300px; height: 300px; 
             background: radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 70%); border-radius: 50%;"></div>
      </div>

      <!-- ========== PC端侧边栏 ========== -->
      <aside class="pc-sidebar pc-only">
        <div class="sidebar-header">
          <h1 style="font-family: 'Inter', sans-serif; font-size: 1.5rem; font-weight: 700; 
              letter-spacing: 0.05em; color: var(--foreground); margin-bottom: 0.25rem;">
            任务清单
          </h1>
          <p style="font-size: 0.85rem; color: var(--muted);">
            简单 · 高效 · 专注
          </p>
        </div>

        <!-- 统计信息 -->
        <div class="sidebar-stats">
          <div>
            <div class="stat-number" id="pc-total-count">0</div>
            <div class="stat-label">总数</div>
          </div>
          <div>
            <div class="stat-number" id="pc-active-count">0</div>
            <div class="stat-label">进行中</div>
          </div>
          <div>
            <div class="stat-number" id="pc-completed-count">0</div>
            <div class="stat-label">已完成</div>
          </div>
        </div>

        <!-- 筛选区 -->
        <div class="sidebar-filters">
          <!-- 状态筛选 -->
          <div class="filter-section">
            <div class="filter-section-title">状态</div>
            <button class="pc-status-btn" data-status="today">
              <span class="status-icon">☀</span>
              <span>今日</span>
              <span class="status-count" id="pc-today-count">0</span>
            </button>
            <button class="pc-status-btn" data-status="all">
              <span class="status-icon">◐</span>
              <span>全部</span>
              <span class="status-count" id="pc-all-count">0</span>
            </button>
            <button class="pc-status-btn" data-status="active">
              <span class="status-icon">○</span>
              <span>进行中</span>
              <span class="status-count" id="pc-active-status-count">0</span>
            </button>
            <button class="pc-status-btn" data-status="completed">
              <span class="status-icon">●</span>
              <span>已完成</span>
              <span class="status-count" id="pc-completed-status-count">0</span>
            </button>
            <button class="pc-status-btn" data-status="deleted">
              <span class="status-icon">♺</span>
              <span>已删除</span>
              <span class="status-count" id="pc-deleted-count">0</span>
            </button>
          </div>

          <!-- 标签筛选 -->
          <div class="filter-section">
            <div class="filter-section-title">标签</div>
            <button class="pc-tag-btn" data-tag="important">
              <span style="color: var(--accent);">★</span> 重要
            </button>
            <button class="pc-tag-btn" data-tag="someday">
              某天
            </button>
          </div>
        </div>

        <!-- PC端添加按钮 -->
        <button id="pc-add-btn" class="pc-add-btn">
          <span style="font-size: 1.25rem;">+</span>
          <span>添加任务</span>
        </button>
      </aside>

      <!-- ========== PC端主内容区 ========== -->
      <main class="pc-main pc-only">
        <!-- PC端添加任务面板 -->
        <div id="pc-add-task-panel" 
             style="max-height: 0; overflow: hidden; transition: max-height 0.4s ease-out, opacity 0.3s ease-out; opacity: 0;">
          <div class="zen-card" style="margin-bottom: 1.5rem; padding: 1.5rem 2rem;">
            <form id="pc-task-form">
              <div style="margin-bottom: 1rem;">
                <input type="text" id="pc-task-input" class="zen-input" 
                       placeholder="写下你的思绪..." 
                       autocomplete="off"
                       style="font-size: 1rem;">
              </div>
              <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none;">
                  <input type="checkbox" id="pc-important-checkbox" 
                         style="width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer;">
                  <span style="font-size: 0.85rem; color: var(--muted);">
                    <span style="color: var(--accent);">★</span> 重要
                  </span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--muted);">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <input type="date" id="pc-due-date-input" 
                         style="border: none; background: transparent; font-size: 0.85rem; 
                                color: var(--foreground); cursor: pointer; font-family: inherit;
                                outline: none;">
                </label>
                <button type="submit" class="zen-btn primary" style="margin-left: auto; padding: 0.5rem 1.25rem;">添加</button>
              </div>
            </form>
          </div>
        </div>

        <div id="pc-tasks-container" class="pc-tasks-container">
          <!-- 任务将在这里渲染 -->
        </div>
      </main>

      <!-- ========== 移动端布局 ========== -->
      <!-- 头部 - 移动端 -->
      <header class="fade-in mobile-only" style="padding: 1rem 1rem 0.5rem; text-align: center;">
        <h1 style="font-family: 'Inter', sans-serif; font-size: 1.5rem; font-weight: 700; 
            letter-spacing: 0.05em; color: var(--foreground); margin-bottom: 0.25rem;">
          任务清单
        </h1>
        <p style="font-size: 0.85rem; color: var(--muted);">
          简单 · 高效 · 专注
        </p>
      </header>

      <!-- 移动端主内容 -->
      <main class="mobile-only" style="flex: 1; max-width: 640px; width: 100%; margin: 0 auto; padding: 0 1rem 5rem;">
        <!-- 统计信息 -->
        <div class="fade-in delay-1" style="display: flex; justify-content: center; gap: 1.5rem; padding: 0.75rem 0; margin-bottom: 0.5rem;">
          <div style="text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent);" id="total-count">0</div>
            <div style="font-size: 0.7rem; color: var(--muted); font-weight: 500;">总数</div>
          </div>
          <div style="width: 1px; background: var(--border);"></div>
          <div style="text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent);" id="active-count">0</div>
            <div style="font-size: 0.7rem; color: var(--muted); font-weight: 500;">进行中</div>
          </div>
          <div style="width: 1px; background: var(--border);"></div>
          <div style="text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent);" id="completed-count">0</div>
            <div style="font-size: 0.7rem; color: var(--muted); font-weight: 500;">已完成</div>
          </div>
        </div>

        <!-- 状态筛选标签（单选）- 横向可滚动 -->
        <div class="fade-in delay-2 mobile-status-bar" style="display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch; 
             scrollbar-width: none; -ms-overflow-style: none; gap: 0.5rem; padding: 0.5rem 0; 
             margin-bottom: 0.75rem; border-bottom: 1px solid var(--border);">
          <button class="status-btn mobile-status-btn" data-status="today"
                  style="background: transparent; border: none; padding: 0.5rem 1rem; 
                         border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                         color: var(--muted); transition: all 0.2s ease; white-space: nowrap;">
            今日
          </button>
          <button class="status-btn mobile-status-btn" data-status="all"
                  style="background: transparent; border: none; padding: 0.5rem 1rem; 
                         border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                         color: var(--muted); transition: all 0.2s ease; white-space: nowrap;">
            全部
          </button>
          <button class="status-btn mobile-status-btn" data-status="active"
                  style="background: transparent; border: none; padding: 0.5rem 1rem; 
                         border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                         color: var(--muted); transition: all 0.2s ease; white-space: nowrap;">
            进行中
          </button>
          <button class="status-btn mobile-status-btn" data-status="completed"
                  style="background: transparent; border: none; padding: 0.5rem 1rem; 
                         border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                         color: var(--muted); transition: all 0.2s ease; white-space: nowrap;">
            已完成
          </button>
          <button class="status-btn mobile-status-btn" data-status="deleted"
                  style="background: transparent; border: none; padding: 0.5rem 1rem; 
                         border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                         color: var(--muted); transition: all 0.2s ease; white-space: nowrap;">
            已删除
          </button>
        </div>

        <!-- 标签筛选（多选） -->
        <div class="fade-in delay-3" style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1rem;">
          <button class="tag-btn mobile-tag-btn" data-tag="important"
                  style="background: transparent; border: 2px solid var(--border); padding: 0.375rem 0.75rem; 
                         border-radius: 20px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                         color: var(--muted); transition: all 0.2s ease;">
            <span style="color: var(--accent);">★</span> 重要
          </button>
          <button class="tag-btn mobile-tag-btn" data-tag="someday"
                  style="background: transparent; border: 2px solid var(--border); padding: 0.375rem 0.75rem; 
                         border-radius: 20px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                         color: var(--muted); transition: all 0.2s ease;">
            某天
          </button>
        </div>

        <!-- 移动端添加任务面板 -->
        <div id="add-task-panel" 
             style="max-height: 0; overflow: hidden; transition: max-height 0.4s ease-out, opacity 0.3s ease-out; opacity: 0;">
          <div class="zen-card" style="margin-bottom: 1rem; padding: 1rem;">
            <form id="task-form">
              <div style="margin-bottom: 0.75rem;">
                <input type="text" id="task-input" class="zen-input" 
                       placeholder="写下你的思绪..." 
                       autocomplete="off"
                       style="font-size: 0.9rem;">
              </div>
              <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; user-select: none;">
                  <input type="checkbox" id="important-checkbox" 
                         style="width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer;">
                  <span style="font-size: 0.85rem; color: var(--muted);">
                    <span style="color: var(--accent);">★</span> 重要
                  </span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--muted);">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <input type="date" id="due-date-input" 
                         style="border: none; background: transparent; font-size: 0.8rem; 
                                color: var(--foreground); cursor: pointer; font-family: inherit;
                                outline: none;">
                </label>
                <button type="submit" class="zen-btn primary" style="margin-left: auto; padding: 0.4rem 1rem; font-size: 0.85rem;">添加</button>
              </div>
            </form>
          </div>
        </div>

        <!-- 移动端任务列表 -->
        <div id="tasks-container" class="fade-in delay-4">
          <!-- 任务将在这里渲染 -->
        </div>
      </main>

      <!-- 移动端悬浮添加按钮 -->
      <button id="toggle-add-btn" class="mobile-only"
              style="position: fixed; bottom: 2rem; right: 1.5rem; width: 56px; height: 56px; 
                     border-radius: 16px; background: var(--accent); border: none; 
                     color: white; font-size: 1.75rem; cursor: pointer; 
                     box-shadow: var(--shadow-md);
                     display: flex; align-items: center; justify-content: center;
                     transition: all 0.2s ease; z-index: 100;">
        +
      </button>

      <!-- 移动端底部 -->
      <footer class="mobile-only" style="text-align: center; padding: 1rem; color: var(--muted); font-size: 0.75rem;">
        <span>专注当下，静心完成</span>
      </footer>
    </div>
  `;

  // 初始化 UI 状态
  updateFilterUI();
  renderTasks();
  updateStats();
  updateTrashCount();

  // 绑定事件
  bindEvents();
}

// 绑定事件处理
function bindEvents(): void {
  // 移动端表单提交
  const form = document.getElementById('task-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('task-input') as HTMLInputElement;
      const importantCheckbox = document.getElementById('important-checkbox') as HTMLInputElement;
      const dueDateInput = document.getElementById('due-date-input') as HTMLInputElement;
      
      if (input && input.value.trim()) {
        const important = importantCheckbox?.checked ?? false;
        // 只有当日期输入框有值时才使用，否则为 null
        const dueDate = (dueDateInput?.value && dueDateInput.value.trim()) ? dueDateInput.value : null;
        
        addTask(input.value, important, dueDate);
        input.value = '';
        if (importantCheckbox) importantCheckbox.checked = false;
        if (dueDateInput) dueDateInput.value = '';
        input.focus();
      }
    });
  }

  // PC端表单提交
  const pcForm = document.getElementById('pc-task-form');
  if (pcForm) {
    pcForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('pc-task-input') as HTMLInputElement;
      const importantCheckbox = document.getElementById('pc-important-checkbox') as HTMLInputElement;
      const dueDateInput = document.getElementById('pc-due-date-input') as HTMLInputElement;
      
      if (input && input.value.trim()) {
        const important = importantCheckbox?.checked ?? false;
        // 只有当日期输入框有值时才使用，否则为 null
        const dueDate = (dueDateInput?.value && dueDateInput.value.trim()) ? dueDateInput.value : null;
        
        addTask(input.value, important, dueDate);
        input.value = '';
        if (importantCheckbox) importantCheckbox.checked = false;
        if (dueDateInput) dueDateInput.value = '';
        input.focus();
      }
    });
  }

  // 移动端任务容器事件委托
  const tasksContainer = document.getElementById('tasks-container');
  if (tasksContainer) {
    tasksContainer.addEventListener('click', handleTaskClick);
  }

  // PC端任务容器事件委托
  const pcTasksContainer = document.getElementById('pc-tasks-container');
  if (pcTasksContainer) {
    pcTasksContainer.addEventListener('click', handleTaskClick);
  }

  // 移动端添加按钮
  const toggleAddBtn = document.getElementById('toggle-add-btn');
  if (toggleAddBtn) {
    toggleAddBtn.addEventListener('click', () => {
      toggleAddPanel('mobile');
    });
  }

  // PC端添加按钮
  const pcAddBtn = document.getElementById('pc-add-btn');
  if (pcAddBtn) {
    pcAddBtn.addEventListener('click', () => {
      toggleAddPanel('pc');
    });
  }

  // 移动端状态筛选切换
  document.querySelectorAll('.mobile-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status') as 'all' | 'today' | 'active' | 'completed' | 'deleted';
      if (status) switchStatusFilter(status);
    });
  });

  // PC端状态筛选切换
  document.querySelectorAll('.pc-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status') as 'all' | 'today' | 'active' | 'completed' | 'deleted';
      if (status) switchStatusFilter(status);
    });
  });

  // 移动端标签切换
  document.querySelectorAll('.mobile-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag') as 'important' | 'someday';
      if (tag) toggleTag(tag);
    });
  });

  // PC端标签切换
  document.querySelectorAll('.pc-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag') as 'important' | 'someday';
      if (tag) toggleTag(tag);
    });
  });

  // 输入框聚焦效果
  const input = document.getElementById('task-input') as HTMLInputElement;
  if (input) {
    input.addEventListener('focus', () => {
      input.parentElement!.style.borderBottomColor = 'var(--accent)';
    });
    input.addEventListener('blur', () => {
      input.parentElement!.style.borderBottomColor = 'var(--border)';
    });
  }

  const pcInput = document.getElementById('pc-task-input') as HTMLInputElement;
  if (pcInput) {
    pcInput.addEventListener('focus', () => {
      pcInput.parentElement!.style.borderBottomColor = 'var(--accent)';
    });
    pcInput.addEventListener('blur', () => {
      pcInput.parentElement!.style.borderBottomColor = 'var(--border)';
    });
  }
}

// 任务点击事件处理
function handleTaskClick(e: Event): void {
  const target = e.target as HTMLElement;
  const action = target.getAttribute('data-action');
  const id = target.getAttribute('data-id');

  if (action === 'toggle' && id) {
    toggleTask(id);
    createRipple(e as MouseEvent, target);
  } else if (action === 'delete' && id) {
    deleteTask(id);
  } else if (action === 'restore' && id) {
    restoreTask(id);
  } else if (action === 'permanent-delete' && id) {
    permanentDeleteTask(id);
  }
}
