# 禅·任务 | Zen Tasks

一个具有禅意美学的任务管理工具，专注于简单和高效的任务组织。

## 功能特点

- ✅ 任务增删改查
- ✅ 状态筛选（今日/全部/进行中/已完成/已删除）
- ✅ 标签筛选（重要/某天）
- ✅ 回收站功能
- ✅ 数据本地持久化（localStorage）
- ✅ 响应式设计（PC端侧边栏布局 / 移动端紧凑布局）
- ✅ 禅意美学界面

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:5000](http://localhost:5000) 查看应用。

### 构建生产版本

```bash
pnpm run build
```

构建产物位于 `dist/` 目录。

## 部署到 GitHub Pages

### 方法一：自动部署（推荐）

1. 将代码推送到 GitHub 仓库的 `main` 分支
2. 进入仓库 Settings → Pages → Source
3. 选择 "GitHub Actions"
4. 推送代码后会自动触发部署

### 方法二：手动部署

1. 修改 `vite.config.ts` 中的 `base` 为你的仓库名：
   ```ts
   const base = '/你的仓库名/';
   ```

2. 构建并部署：
   ```bash
   pnpm run build
   ```

3. 将 `dist` 目录内容推送到 `gh-pages` 分支

## 数据存储

所有数据保存在浏览器的 localStorage 中：
- 刷新页面数据不丢失
- 清除浏览器数据会导致数据丢失
- 数据仅保存在本地，不会上传到服务器

## 项目结构

```
├── index.html              # HTML 入口文件
├── src/
│   ├── index.ts           # 应用入口
│   ├── main.ts            # 主逻辑文件
│   └── index.css          # 全局样式
├── public/
│   └── favicon.png        # 网站图标
├── .github/workflows/
│   └── deploy.yml         # GitHub Actions 部署配置
├── vite.config.ts         # Vite 配置
└── tsconfig.json          # TypeScript 配置
```

## 技术栈

- **框架**: Vite + TypeScript
- **样式**: Tailwind CSS
- **存储**: localStorage
- **部署**: GitHub Pages

## License

MIT

## 核心开发规范

### 1. 样式开发

**使用 Tailwind CSS**

本项目使用 Tailwind CSS 进行样式开发，支持亮色/暗色模式自动切换。

```typescript
// 使用 Tailwind 工具类
app.innerHTML = `
  <div class="flex items-center justify-center min-h-screen bg-white dark:bg-black">
    <h1 class="text-4xl font-bold text-black dark:text-white">
      Hello World
    </h1>
  </div>
`;
```

**主题变量**

主题变量定义在 `src/index.css` 中，支持自动适配系统主题：

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

**常用 Tailwind 类名**

- 布局：`flex`, `grid`, `container`, `mx-auto`
- 间距：`p-4`, `m-4`, `gap-4`, `space-x-4`
- 颜色：`bg-white`, `text-black`, `dark:bg-black`, `dark:text-white`
- 排版：`text-lg`, `font-bold`, `leading-8`, `tracking-tight`
- 响应式：`sm:`, `md:`, `lg:`, `xl:`

### 2. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 3. TypeScript 开发

**类型安全**

充分利用 TypeScript 的类型系统，确保代码质量：

```typescript
// 定义接口
interface User {
  id: number;
  name: string;
  email: string;
}

// 使用类型
function createUser(data: User): void {
  console.log(`Creating user: ${data.name}`);
}

// DOM 操作类型推断
const button = document.querySelector<HTMLButtonElement>('#my-button');
if (button) {
  button.addEventListener('click', () => {
    console.log('Button clicked');
  });
}
```

**避免 any 类型**

尽量避免使用 `any`，使用 `unknown` 或具体类型：

```typescript
// ❌ 不推荐
function process(data: any) { }

// ✅ 推荐
function process(data: unknown) {
  if (typeof data === 'string') {
    console.log(data.toUpperCase());
  }
}
```

## 常见开发场景

### 添加新页面

本项目是单页应用（SPA），如需多页面：

1. 在 `src/` 下创建新的 `.ts` 文件
2. 在 `vite.config.ts` 中配置多入口
3. 创建对应的 `.html` 文件

### DOM 操作

```typescript
// 获取元素
const app = document.getElementById('app');
const button = document.querySelector<HTMLButtonElement>('.my-button');

// 动态创建元素
const div = document.createElement('div');
div.className = 'flex items-center gap-4';
div.textContent = 'Hello World';
app?.appendChild(div);

// 事件监听
button?.addEventListener('click', (e) => {
  console.log('Clicked', e);
});
```

### 数据获取

```typescript
// Fetch API
async function fetchData() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
  }
}

// 使用数据
fetchData().then(data => {
  console.log(data);
});
```

### 环境变量

在 `.env` 文件中定义环境变量（需以 `VITE_` 开头）：

```bash
VITE_API_URL=https://api.example.com
```

在代码中使用：

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
console.log(apiUrl); // https://api.example.com
```

## 技术栈

- **构建工具**: Vite 6.x
- **语言**: TypeScript 5.x
- **样式**: Tailwind CSS 3.x
- **包管理器**: pnpm 9+

## 参考文档

- [Vite 官方文档](https://cn.vitejs.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/zh/docs/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **使用 TypeScript** 进行类型安全开发，避免使用 `any`
3. **使用 Tailwind CSS** 进行样式开发，支持响应式和暗色模式
4. **环境变量必须以 `VITE_` 开头** 才能在客户端代码中访问
5. **开发时使用 `coze dev`**，支持热更新和快速刷新
