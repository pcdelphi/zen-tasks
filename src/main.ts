// 任务接口定义
interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  category: 'today' | 'important' | 'someday';
  important: boolean;
  dueDate: string | null; // 格式: YYYY-MM-DD
}

// 应用状态
interface AppState {
  tasks: Task[];
  filter: 'all' | 'active' | 'completed';
  category: 'today' | 'important' | 'someday';
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
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return {
    tasks: [],
    filter: 'all',
    category: 'today'
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

  let filteredTasks = appState.tasks.filter(task => {
    if (appState.filter === 'active') return !task.completed;
    if (appState.filter === 'completed') return task.completed;
    return true;
  });

  // 按分类筛选
  filteredTasks = filteredTasks.filter(task => task.category === appState.category);

  // 按创建时间倒序排列，未完成的在前，重要的优先
  filteredTasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.important !== b.important) return a.important ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  if (filteredTasks.length === 0) {
    tasksContainer.innerHTML = `
      <div class="empty-state fade-in" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
        <div style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;">○</div>
        <p style="font-style: italic;">空无一人，心如止水</p>
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
          −
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

// 更新统计信息
function updateStats(): void {
  const totalEl = document.getElementById('total-count');
  const completedEl = document.getElementById('completed-count');
  const activeEl = document.getElementById('active-count');

  const categoryTasks = appState.tasks.filter(t => t.category === appState.category);
  const total = categoryTasks.length;
  const completed = categoryTasks.filter(t => t.completed).length;
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

  const newTask: Task = {
    id: generateId(),
    text: text.trim(),
    completed: false,
    createdAt: Date.now(),
    category: appState.category,
    important,
    dueDate
  };

  appState.tasks.unshift(newTask);
  saveToStorage(appState);
  renderTasks();
  updateStats();
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

// 删除任务
function deleteTask(id: string): void {
  appState.tasks = appState.tasks.filter(t => t.id !== id);
  saveToStorage(appState);
  renderTasks();
  updateStats();
}

// 切换分类
function switchCategory(category: 'today' | 'important' | 'someday'): void {
  appState.category = category;
  saveToStorage(appState);
  updateCategoryUI();
  renderTasks();
  updateStats();
}

// 更新分类 UI
function updateCategoryUI(): void {
  document.querySelectorAll('.category-btn').forEach(btn => {
    const btnCategory = btn.getAttribute('data-category');
    if (btnCategory === appState.category) {
      btn.classList.add('active');
      (btn as HTMLElement).style.borderBottomColor = 'var(--ink-medium)';
      (btn as HTMLElement).style.color = 'var(--ink-dark)';
    } else {
      btn.classList.remove('active');
      (btn as HTMLElement).style.borderBottomColor = 'transparent';
      (btn as HTMLElement).style.color = 'var(--muted)';
    }
  });

  // 更新标题
  const titleEl = document.getElementById('category-title');
  const titles = {
    today: '今日之事',
    important: '重要之事',
    someday: '未来可期'
  };
  if (titleEl) {
    titleEl.textContent = titles[appState.category];
  }
}

// 切换过滤器
function switchFilter(filter: 'all' | 'active' | 'completed'): void {
  appState.filter = filter;
  saveToStorage(appState);
  updateFilterUI();
  renderTasks();
}

// 更新过滤器 UI
function updateFilterUI(): void {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const btnFilter = btn.getAttribute('data-filter');
    if (btnFilter === appState.filter) {
      btn.classList.add('active');
      (btn as HTMLElement).style.background = 'var(--sand)';
      (btn as HTMLElement).style.color = 'var(--ink-dark)';
    } else {
      btn.classList.remove('active');
      (btn as HTMLElement).style.background = 'transparent';
      (btn as HTMLElement).style.color = 'var(--muted)';
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

      <!-- 头部 -->
      <header class="fade-in" style="padding: 2rem 2rem 1rem; text-align: center;">
        <h1 style="font-family: 'Noto Serif SC', serif; font-size: 2rem; font-weight: 300; 
            letter-spacing: 0.2em; color: var(--ink-dark); margin-bottom: 0.5rem;">
          禅·任务
        </h1>
        <p style="font-size: 0.875rem; color: var(--muted); letter-spacing: 0.1em; font-style: italic;">
          简单 · 专注 · 当下
        </p>
      </header>

      <!-- 主要内容 -->
      <main style="flex: 1; max-width: 640px; width: 100%; margin: 0 auto; padding: 0 1.5rem 3rem;">
        <!-- 分类标签 -->
        <div class="fade-in delay-1" style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border);">
          <button class="category-btn" data-category="today" 
                  style="background: none; border: none; padding: 0.75rem 0; cursor: pointer; 
                         font-size: 0.875rem; letter-spacing: 0.1em; border-bottom: 2px solid transparent; 
                         transition: all 0.3s; margin-bottom: -1px;">
            今日
          </button>
          <button class="category-btn" data-category="important"
                  style="background: none; border: none; padding: 0.75rem 0; cursor: pointer; 
                         font-size: 0.875rem; letter-spacing: 0.1em; border-bottom: 2px solid transparent; 
                         transition: all 0.3s; margin-bottom: -1px;">
            重要
          </button>
          <button class="category-btn" data-category="someday"
                  style="background: none; border: none; padding: 0.75rem 0; cursor: pointer; 
                         font-size: 0.875rem; letter-spacing: 0.1em; border-bottom: 2px solid transparent; 
                         transition: all 0.3s; margin-bottom: -1px;">
            某天
          </button>
        </div>

        <!-- 分类标题 -->
        <div class="fade-in delay-2" style="text-align: center; margin-bottom: 2rem;">
          <h2 id="category-title" style="font-family: 'Noto Serif SC', serif; font-size: 1.25rem; 
              font-weight: 400; color: var(--ink-medium); letter-spacing: 0.15em;">
            今日之事
          </h2>
        </div>

        <!-- 添加任务 -->
        <div class="fade-in delay-2 zen-card" style="margin-bottom: 2rem;">
          <form id="task-form">
            <div style="margin-bottom: 1rem;">
              <input type="text" id="task-input" class="zen-input" 
                     placeholder="写下你的思绪..." 
                     autocomplete="off">
            </div>
            <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
              <!-- 重要选项 -->
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none;">
                <input type="checkbox" id="important-checkbox" 
                       style="width: 16px; height: 16px; accent-color: #c9a87c; cursor: pointer;">
                <span style="font-size: 0.85rem; color: var(--muted);">
                  <span style="color: #c9a87c;">★</span> 重要
                </span>
              </label>
              <!-- 日期选择 -->
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--muted);">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <input type="date" id="due-date-input" 
                       style="border: none; background: transparent; font-size: 0.85rem; 
                              color: var(--foreground); cursor: pointer; font-family: inherit;
                              outline: none;">
              </label>
              <!-- 添加按钮 -->
              <button type="submit" class="zen-btn primary" style="margin-left: auto;">添加</button>
            </div>
          </form>
        </div>

        <!-- 过滤器 -->
        <div class="fade-in delay-3" style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1.5rem;">
          <button class="filter-btn" data-filter="all"
                  style="background: transparent; border: none; padding: 0.25rem 0.75rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.8rem; 
                         color: var(--muted); transition: all 0.3s;">
            全部
          </button>
          <button class="filter-btn" data-filter="active"
                  style="background: transparent; border: none; padding: 0.25rem 0.75rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.8rem; 
                         color: var(--muted); transition: all 0.3s;">
            进行中
          </button>
          <button class="filter-btn" data-filter="completed"
                  style="background: transparent; border: none; padding: 0.25rem 0.75rem; 
                         border-radius: 1rem; cursor: pointer; font-size: 0.8rem; 
                         color: var(--muted); transition: all 0.3s;">
            已完成
          </button>
        </div>

        <!-- 任务列表 -->
        <div id="tasks-container" class="fade-in delay-3">
          <!-- 任务将在这里渲染 -->
        </div>

        <!-- 统计信息 -->
        <div class="fade-in delay-4" style="margin-top: 2rem; text-align: center;">
          <div class="zen-divider"></div>
          <div style="display: flex; justify-content: center; gap: 2rem; margin-top: 1.5rem;">
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 300; color: var(--ink-medium);" id="total-count">0</div>
              <div style="font-size: 0.75rem; color: var(--muted); letter-spacing: 0.1em;">总数</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 300; color: var(--ink-medium);" id="active-count">0</div>
              <div style="font-size: 0.75rem; color: var(--muted); letter-spacing: 0.1em;">进行中</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 300; color: var(--ink-medium);" id="completed-count">0</div>
              <div style="font-size: 0.75rem; color: var(--muted); letter-spacing: 0.1em;">已完成</div>
            </div>
          </div>
        </div>
      </main>

      <!-- 底部 -->
      <footer style="text-align: center; padding: 2rem; color: var(--muted); font-size: 0.75rem;">
        <span class="zen-dot" style="margin-right: 0.5rem;"></span>
        <span style="letter-spacing: 0.1em;">专注当下，静心完成</span>
        <span class="zen-dot" style="margin-left: 0.5rem;"></span>
      </footer>
    </div>
  `;

  // 初始化 UI 状态
  updateCategoryUI();
  updateFilterUI();
  renderTasks();
  updateStats();

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
      }
    });
  }

  // 分类切换
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category') as 'today' | 'important' | 'someday';
      if (category) switchCategory(category);
    });
  });

  // 过滤器切换
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter') as 'all' | 'active' | 'completed';
      if (filter) switchFilter(filter);
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
