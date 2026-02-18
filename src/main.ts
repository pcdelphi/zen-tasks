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
}

// 本地存储键名
const STORAGE_KEY = 'zen-tasks-data';

// 从本地存储加载数据
function loadFromStorage(): AppState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      // 兼容旧数据，为旧任务添加默认值
      if (parsed.tasks) {
        parsed.tasks = parsed.tasks.map((task: Task) => ({
          ...task,
          important: task.important ?? false,
          dueDate: task.dueDate ?? null
        }));
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
      
      return {
        tasks: parsed.tasks || [],
        deletedTasks: parsed.deletedTasks || [],
        statusFilter,
        tags
      };
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return {
    tasks: [],
    deletedTasks: [],
    statusFilter: 'all',
    tags: []
  };
}

// 保存到本地存储
function saveToStorage(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  if (!tasksContainer) return;

  // 如果是已删除过滤器，渲染已删除的任务
  if (appState.statusFilter === 'deleted') {
    renderDeletedTasks(tasksContainer);
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

  if (filteredTasks.length === 0) {
    tasksContainer.innerHTML = `
      <div class="empty-state fade-in" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
        <div style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.4;">○</div>
        <p style="font-style: italic; margin-bottom: 1rem;">空无一人，心如止水</p>
        <p style="font-size: 0.8rem; opacity: 0.7;">
          点击右下角 <span style="display: inline-block; width: 20px; height: 20px; background: var(--ink-medium); 
          color: white; border-radius: 50%; font-size: 0.75rem; line-height: 20px; vertical-align: middle;">+</span> 添加任务
        </p>
      </div>
    `;
    return;
  }

  tasksContainer.innerHTML = filteredTasks.map((task, index) => {
    const dateDisplay = formatDate(task.dueDate);
    const overdue = !task.completed && isOverdue(task.dueDate);
    
    return `
    <div class="task-item slide-in ${task.completed ? 'completed' : ''} ${task.important ? 'important' : ''}" 
         data-id="${task.id}" 
         style="animation-delay: ${index * 0.05}s; ${task.important ? 'border-left-color: #c9a87c;' : ''}">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="zen-checkbox ${task.completed ? 'checked' : ''}" 
             data-action="toggle" 
             data-id="${task.id}"></div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
          <span class="task-text" style="font-size: 0.95rem; ${task.important ? 'font-weight: 500;' : ''}">
            ${task.important ? '<span style="color: #c9a87c; margin-right: 0.25rem;">★</span>' : ''}${escapeHtml(task.text)}
          </span>
          ${dateDisplay ? `
            <span style="font-size: 0.75rem; color: ${overdue ? '#c97070' : 'var(--muted)'};">
              ${overdue ? '已过期 · ' : ''}${dateDisplay}
            </span>
          ` : ''}
        </div>
        <button class="delete-btn" data-action="delete" data-id="${task.id}" 
                style="background: none; border: none; color: var(--muted); cursor: pointer; 
                       font-size: 1.25rem; opacity: 0; transition: opacity 0.3s; padding: 0 0.5rem;">
          ×
        </button>
      </div>
    </div>
  `}).join('');

  // 添加悬停显示删除按钮
  tasksContainer.querySelectorAll('.task-item').forEach(item => {
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
        <div style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.4;">🗑</div>
        <p style="font-style: italic;">回收站为空</p>
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
         style="animation-delay: ${index * 0.05}s; opacity: 0.7; border-left-color: var(--muted);">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.25rem;">
          <span class="task-text" style="font-size: 0.95rem; ${task.completed ? 'text-decoration: line-through; color: var(--muted);' : ''}">
            ${task.important ? '<span style="color: #c9a87c; margin-right: 0.25rem;">★</span>' : ''}${escapeHtml(task.text)}
          </span>
          <span style="font-size: 0.75rem; color: var(--muted);">
            删除于 ${deletedDate}
          </span>
        </div>
        <button class="restore-btn" data-action="restore" data-id="${task.id}" 
                style="background: none; border: 1px solid var(--border); color: var(--ink-medium); 
                       cursor: pointer; font-size: 0.8rem; padding: 0.25rem 0.75rem; 
                       border-radius: 1rem; transition: all 0.3s;">
          恢复
        </button>
        <button class="permanent-delete-btn" data-action="permanent-delete" data-id="${task.id}" 
                style="background: none; border: none; color: #c97070; cursor: pointer; 
                       font-size: 1.25rem; opacity: 0; transition: opacity 0.3s; padding: 0 0.5rem;">
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
  const totalEl = document.getElementById('total-count');
  const completedEl = document.getElementById('completed-count');
  const activeEl = document.getElementById('active-count');

  // 如果是已删除过滤器，显示回收站统计
  if (appState.statusFilter === 'deleted') {
    const deletedCount = appState.deletedTasks.length;
    if (totalEl) totalEl.textContent = deletedCount.toString();
    if (completedEl) completedEl.textContent = '-';
    if (activeEl) activeEl.textContent = '-';
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

  // 按标签筛选
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

  if (totalEl) totalEl.textContent = total.toString();
  if (completedEl) completedEl.textContent = completed.toString();
  if (activeEl) activeEl.textContent = active.toString();
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

  const today = new Date().toISOString().split('T')[0];
  
  const newTask: Task = {
    id: generateId(),
    text: text.trim(),
    completed: false,
    createdAt: Date.now(),
    category: 'today',
    important,
    dueDate: dueDate || today
  };

  appState.tasks.unshift(newTask);
  saveToStorage(appState);
  renderTasks();
  updateStats();
  
  // 添加完成后收起面板
  toggleAddPanel(false);
}

// 添加面板展开状态
let isAddPanelOpen = false;

// 切换添加面板
function toggleAddPanel(open?: boolean): void {
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
  // 更新"已删除"按钮上的数字显示
  const deletedBtn = document.querySelector('[data-filter="deleted"]');
  if (deletedBtn) {
    const count = appState.deletedTasks.length;
    const countSpan = deletedBtn.querySelector('.deleted-count');
    if (count > 0) {
      if (!countSpan) {
        const span = document.createElement('span');
        span.className = 'deleted-count';
        span.style.cssText = 'margin-left: 0.25rem; font-size: 0.7rem; opacity: 0.7;';
        span.textContent = `(${count})`;
        deletedBtn.appendChild(span);
      } else {
        countSpan.textContent = `(${count})`;
      }
    } else if (countSpan) {
      countSpan.remove();
    }
  }
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
  // 更新状态筛选按钮（单选）
  document.querySelectorAll('.status-btn').forEach(btn => {
    const btnFilter = btn.getAttribute('data-status');
    if (btnFilter === appState.statusFilter) {
      btn.classList.add('active');
      (btn as HTMLElement).style.background = 'var(--ink-medium)';
      (btn as HTMLElement).style.color = 'white';
    } else {
      btn.classList.remove('active');
      (btn as HTMLElement).style.background = 'transparent';
      (btn as HTMLElement).style.color = 'var(--muted)';
    }
  });

  // 更新标签按钮（多选）
  document.querySelectorAll('.tag-btn').forEach(btn => {
    const btnTag = btn.getAttribute('data-tag');
    const isSelected = appState.tags.includes(btnTag as 'important' | 'someday');
    if (isSelected) {
      btn.classList.add('active');
      (btn as HTMLElement).style.background = 'var(--sand)';
      (btn as HTMLElement).style.color = 'var(--ink-dark)';
    } else {
      btn.classList.remove('active');
      (btn as HTMLElement).style.background = 'transparent';
      (btn as HTMLElement).style.color = 'var(--muted)';
    }
  });
  document.querySelectorAll('.tag-btn').forEach(btn => {
    const btnTag = btn.getAttribute('data-tag');
    const isSelected = appState.tags.includes(btnTag as 'important' | 'someday');
    if (isSelected) {
      btn.classList.add('active');
      (btn as HTMLElement).style.background = 'var(--ink-medium)';
      (btn as HTMLElement).style.color = 'white';
      (btn as HTMLElement).style.borderColor = 'var(--ink-medium)';
    } else {
      btn.classList.remove('active');
      (btn as HTMLElement).style.background = 'transparent';
      (btn as HTMLElement).style.color = 'var(--muted)';
      (btn as HTMLElement).style.borderColor = 'var(--border)';
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
        <div class="breathe" style="position: absolute; top: 10%; right: 15%; width: 300px; height: 300px; 
             background: radial-gradient(circle, rgba(139,115,85,0.05) 0%, transparent 70%); border-radius: 50%;"></div>
        <div class="breathe" style="position: absolute; bottom: 20%; left: 10%; width: 200px; height: 200px; 
             background: radial-gradient(circle, rgba(212,229,237,0.1) 0%, transparent 70%); border-radius: 50%; 
             animation-delay: 2s;"></div>
      </div>

      <!-- 头部 - 移动端优化 -->
      <header class="fade-in" style="padding: 1rem 1rem 0.5rem; text-align: center;">
        <h1 style="font-family: 'Noto Serif SC', serif; font-size: 1.5rem; font-weight: 300; 
            letter-spacing: 0.15em; color: var(--ink-dark); margin-bottom: 0.25rem;">
          禅·任务
        </h1>
        <p style="font-size: 0.75rem; color: var(--muted); letter-spacing: 0.1em; font-style: italic;">
          简单 · 专注 · 当下
        </p>
      </header>

      <!-- 主要内容 -->
      <main style="flex: 1; max-width: 640px; width: 100%; margin: 0 auto; padding: 0 1rem 5rem;">
        <!-- 统计信息 - 移到顶部 -->
        <div class="fade-in delay-1" style="display: flex; justify-content: center; gap: 1.5rem; padding: 0.75rem 0; margin-bottom: 0.5rem;">
          <div style="text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 300; color: var(--ink-medium);" id="total-count">0</div>
            <div style="font-size: 0.65rem; color: var(--muted); letter-spacing: 0.05em;">总数</div>
          </div>
          <div style="width: 1px; background: var(--border);"></div>
          <div style="text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 300; color: var(--ink-medium);" id="active-count">0</div>
            <div style="font-size: 0.65rem; color: var(--muted); letter-spacing: 0.05em;">进行中</div>
          </div>
          <div style="width: 1px; background: var(--border);"></div>
          <div style="text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 300; color: var(--ink-medium);" id="completed-count">0</div>
            <div style="font-size: 0.65rem; color: var(--muted); letter-spacing: 0.05em;">已完成</div>
          </div>
        </div>

        <!-- 状态筛选标签（单选）- 横向可滚动 -->
        <div class="fade-in delay-2" style="display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch; 
             scrollbar-width: none; -ms-overflow-style: none; gap: 0.5rem; padding: 0.5rem 0; 
             margin-bottom: 0.75rem; border-bottom: 1px solid var(--border);">
          <button class="status-btn" data-status="today"
                  style="background: transparent; border: none; padding: 0.4rem 0.75rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.8rem; 
                         color: var(--muted); transition: all 0.3s; white-space: nowrap;">
            今日
          </button>
          <button class="status-btn" data-status="all"
                  style="background: transparent; border: none; padding: 0.4rem 0.75rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.8rem; 
                         color: var(--muted); transition: all 0.3s; white-space: nowrap;">
            全部
          </button>
          <button class="status-btn" data-status="active"
                  style="background: transparent; border: none; padding: 0.4rem 0.75rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.8rem; 
                         color: var(--muted); transition: all 0.3s; white-space: nowrap;">
            进行中
          </button>
          <button class="status-btn" data-status="completed"
                  style="background: transparent; border: none; padding: 0.4rem 0.75rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.8rem; 
                         color: var(--muted); transition: all 0.3s; white-space: nowrap;">
            已完成
          </button>
          <button class="status-btn" data-status="deleted"
                  style="background: transparent; border: none; padding: 0.4rem 0.75rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.8rem; 
                         color: var(--muted); transition: all 0.3s; white-space: nowrap;">
            已删除
          </button>
        </div>

        <!-- 标签筛选（多选） -->
        <div class="fade-in delay-3" style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1rem;">
          <button class="tag-btn" data-tag="important"
                  style="background: transparent; border: 1px solid var(--border); padding: 0.2rem 0.6rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.75rem; 
                         color: var(--muted); transition: all 0.3s;">
            <span style="color: #c9a87c;">★</span> 重要
          </button>
          <button class="tag-btn" data-tag="someday"
                  style="background: transparent; border: 1px solid var(--border); padding: 0.2rem 0.6rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.75rem; 
                         color: var(--muted); transition: all 0.3s;">
            某天
          </button>
        </div>

        <!-- 添加任务面板（默认隐藏） -->
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
                <!-- 重要选项 -->
                <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; user-select: none;">
                  <input type="checkbox" id="important-checkbox" 
                         style="width: 14px; height: 14px; accent-color: #c9a87c; cursor: pointer;">
                  <span style="font-size: 0.8rem; color: var(--muted);">
                    <span style="color: #c9a87c;">★</span> 重要
                  </span>
                </label>
                <!-- 日期选择 -->
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
                <!-- 添加按钮 -->
                <button type="submit" class="zen-btn primary" style="margin-left: auto; padding: 0.4rem 1rem; font-size: 0.85rem;">添加</button>
              </div>
            </form>
          </div>
        </div>

        <!-- 任务列表 -->
        <div id="tasks-container" class="fade-in delay-4">
          <!-- 任务将在这里渲染 -->
        </div>
      </main>

      <!-- 悬浮添加按钮 -->
      <button id="toggle-add-btn" 
              style="position: fixed; bottom: 2rem; right: 1.5rem; width: 56px; height: 56px; 
                     border-radius: 50%; background: var(--ink-medium); border: none; 
                     color: white; font-size: 1.75rem; cursor: pointer; 
                     box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                     display: flex; align-items: center; justify-content: center;
                     transition: all 0.3s ease; z-index: 100;">
        +
      </button>

      <!-- 底部 -->
      <footer style="text-align: center; padding: 1rem; color: var(--muted); font-size: 0.65rem;">
        <span style="letter-spacing: 0.1em;">专注当下，静心完成</span>
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
  // 表单提交
  const form = document.getElementById('task-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('task-input') as HTMLInputElement;
      const importantCheckbox = document.getElementById('important-checkbox') as HTMLInputElement;
      const dueDateInput = document.getElementById('due-date-input') as HTMLInputElement;
      
      if (input && input.value.trim()) {
        const important = importantCheckbox?.checked ?? false;
        const dueDate = dueDateInput?.value || null;
        
        addTask(input.value, important, dueDate);
        input.value = '';
        if (importantCheckbox) importantCheckbox.checked = false;
        if (dueDateInput) dueDateInput.value = '';
        input.focus();
      }
    });
  }

  // 任务容器事件委托
  const tasksContainer = document.getElementById('tasks-container');
  if (tasksContainer) {
    tasksContainer.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');

      if (action === 'toggle' && id) {
        toggleTask(id);
        createRipple(e, target);
      } else if (action === 'delete' && id) {
        deleteTask(id);
      } else if (action === 'restore' && id) {
        restoreTask(id);
      } else if (action === 'permanent-delete' && id) {
        permanentDeleteTask(id);
      }
    });
  }

  // 添加按钮点击事件
  const toggleAddBtn = document.getElementById('toggle-add-btn');
  if (toggleAddBtn) {
    toggleAddBtn.addEventListener('click', () => {
      toggleAddPanel();
    });
  }

  // 状态筛选切换（单选）
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status') as 'all' | 'today' | 'active' | 'completed' | 'deleted';
      if (status) switchStatusFilter(status);
    });
  });

  // 标签切换（多选）
  document.querySelectorAll('.tag-btn').forEach(btn => {
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
}
