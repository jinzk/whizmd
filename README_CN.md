# WhizMD

WhizMD 是一款面向桌面的 Markdown 编辑器，基于 Electron、React、TypeScript 和 Tiptap 构建。它将类似 Typora 的所见即所得编辑体验与完整的 Markdown 源码编辑器结合起来，同时使用标准 Markdown 文件保存文档内容。

[English README](README.md)

## 功能特性

- 基于 Tiptap 的所见即所得 Markdown 编辑
- 基于 CodeMirror 的 Markdown 源码编辑
- 在所见即所得模式和源码模式之间切换，且不会丢失未保存修改
- 新建、打开、切换和关闭多个 Markdown 文档
- 打开文件夹，并在侧边栏浏览 Markdown 文件
- 保存 Markdown 文档并追踪修改状态
- 导出 HTML 或 PDF
- 支持 lowlight 语法高亮的代码块
- Mermaid 图表预览和源码编辑
- 使用沙箱 iframe 渲染 HTML 代码块预览
- 编辑 HTML 代码块源码，同时保留实时预览
- 支持 HTML 容器内部嵌入 Markdown 内容
- 使用 KaTeX 渲染数学公式
- 支持表格、列表、图片、链接、行内 HTML 和扩展 Markdown 语法
- 支持图片链接，并可分别编辑图片地址和跳转地址
- 支持 GitHub 兼容的图片路径和 URL 编码媒体路径
- 浅色、深色和跟随系统主题
- 中文和英文界面
- 代码块按当前行缩进自动换行
- 代码块内支持 Tab 和 Shift+Tab 缩进操作

## 快速开始

克隆仓库并安装依赖：

```bash
git clone <repository-url>
cd whizmd
npm install
```

以开发模式启动应用：

```bash
npm run dev
```

Electron 开发窗口会启动，渲染进程支持热更新。

## 可用脚本

| 命令                  | 说明                                        |
| --------------------- | ------------------------------------------- |
| `npm run dev`       | 以开发模式启动 Electron 应用                |
| `npm run build`     | 构建主进程、预加载脚本和渲染进程            |
| `npm run start`     | 预览生产构建结果                            |
| `npm run dist`      | 构建应用并生成 Windows 安装包/压缩包        |
| `npm run typecheck` | 对 Node 和 Web 项目执行 TypeScript 类型检查 |
| `npm run lint`      | 执行 ESLint                                 |
| `npm run format`    | 使用 Prettier 格式化项目                    |
| `npm test`          | 执行 Vitest 测试套件                        |

Windows 构建产物会写入 `release/` 目录。当前配置会生成 NSIS 安装程序和 ZIP 压缩包。

## 编辑模式

### 所见即所得模式

所见即所得模式将 Markdown 渲染为可直接编辑的文档，适合写作和视觉化编辑，同时仍以 Markdown 作为文档格式。

### 源码模式

源码模式提供基于 CodeMirror 的 Markdown 编辑器，支持 Markdown 感知的编辑行为、代码围栏语言补全、缩进处理，并根据应用主题切换深色主题。

切换文件或编辑模式时，应用会同步最新文档内容，并在当前文档会话中保留未保存修改。

## 代码块

在所见即所得模式中，可以通过输入围栏 Markdown 代码块或使用代码语言选择器创建代码块。

- 普通语言使用 lowlight 进行语法高亮。
- Mermaid 代码块显示渲染后的图表，同时保留可编辑源码。
- HTML 预览代码块使用沙箱 iframe 渲染源码，同时保留可编辑源码。
- 按 `Enter` 后，新行会继承当前行的前导空格。
- 在代码块内按 `Tab` 插入两个空格。
- 在代码块内按 `Shift+Tab` 删除当前行开头最多两个空格。

HTML 的缩进会有意继承当前行，而不会尝试根据嵌套标签推断层级。这样可以让 HTML、Mermaid 和普通代码块使用一致的缩进规则。

## 文档管理

WhizMD 为打开的文档维护内存中的会话。每个文档独立记录路径、内容和修改状态，因此可以同时编辑多个文件，而不会相互覆盖状态。

应用支持：

- 新建未命名文档
- 打开文件和文件夹
- 通过侧边栏切换文档
- 关闭单个文档
- 关闭未保存文档时提示保存
- 导出 HTML 和 PDF

## 项目结构

```text
src/
├── main/                 Electron 主进程和 IPC 处理器
├── preload/              安全的渲染进程 API 桥接
├── shared/               共享类型和 IPC 定义
└── renderer/src/
    ├── components/      应用、所见即所得和编辑器 UI 组件
    ├── editor/           Tiptap 扩展、NodeView、媒体和解析器逻辑
    ├── export/           HTML/PDF 导出准备逻辑
    ├── hooks/            React Hooks
    ├── store/            编辑器配置和文档会话状态
    └── styles/           应用和编辑器样式
```

### 图片存储策略

保存 Markdown 文档时，WhizMD 会尽量保持图片引用与 GitHub 仓库兼容：

- 已经位于文档目录、子目录或所属 Git 仓库内的图片不会被复制。
- `../images/logo.png` 这类仓库相对路径会保留。
- 仓库外的本地图片只有在确实需要迁移时，才会复制到 Markdown 文件同级的 `assets/` 目录。
- 没有图片需要迁移时不会创建 `assets/` 目录。
- 空格和其他 URL 字符会被编码，例如 `my image.png` 会保存为 `my%20image.png`。
- 已有文件不会被覆盖，重名文件会自动添加数字后缀。

## 测试

执行全部测试：

```bash
npm test
```

测试套件覆盖编辑器语法、代码块、HTML 代码块、Mermaid 相关行为、表格、图片、导出结果、文档状态和 NodeView 交互。

如需快速验证编辑器的主要功能，可以执行：

```bash
npm run typecheck
npm test
npm run build
```

## 技术栈

- Electron 43
- React 19
- TypeScript 5.9
- Tiptap 3
- CodeMirror 6
- Zustand 5
- Vite 和 Electron Vite
- Vitest
- Mermaid
- KaTeX
- lowlight

## 许可证

本项目使用 MIT 许可证。如果仓库中添加了 `LICENSE` 文件，请以该文件内容为准。
