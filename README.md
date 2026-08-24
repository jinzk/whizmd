# WhizMD

WhizMD is a desktop Markdown editor for desktop, built with Electron, React, TypeScript, and Tiptap. It combines a Typora-like WYSIWYG editing experience with a full Markdown source editor, while keeping the document content in standard Markdown files.

[中文文档](README_CN.md)

## Features

- WYSIWYG Markdown editing powered by Tiptap
- CodeMirror-based Markdown source editing
- Switch between WYSIWYG and source modes without losing unsaved changes
- Open, create, switch between, and close multiple Markdown documents
- Open a folder and browse Markdown files from the sidebar
- Save Markdown documents and track dirty state
- Export documents to HTML or PDF
- Syntax-aware code blocks with lowlight highlighting
- Mermaid diagram preview and editable Mermaid source
- HTML code block preview with sandboxed iframe rendering
- Edit HTML block source while retaining the live preview
- Markdown content embedded inside HTML blocks
- Mathematics rendering with KaTeX
- Tables, lists, images, links, inline HTML, and extended Markdown syntax
- Image links with separate image and destination editing
- GitHub-compatible image paths and URL-encoded media paths
- Light, dark, and system themes
- Chinese and English interface localization
- Automatic code block indentation based on the current line
- Tab and Shift+Tab indentation inside code blocks

## Getting Started

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd whizmd
npm install
```

Start the application in development mode:

```bash
npm run dev
```

The Electron development window will start with hot reload enabled for the renderer process.

## Available Scripts

| Command               | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Start the Electron application in development mode           |
| `npm run build`     | Build the main, preload, and renderer processes              |
| `npm run start`     | Preview the production build                                 |
| `npm run dist`      | Build the application and create Windows installers/packages |
| `npm run typecheck` | Run TypeScript checks for Node and web projects              |
| `npm run lint`      | Run ESLint                                                   |
| `npm run format`    | Format the project with Prettier                             |
| `npm test`          | Run the Vitest test suite                                    |

The Windows distribution is written to the `release/` directory. The configured targets are an NSIS installer and a ZIP archive.

## Editing Modes

### WYSIWYG Mode

WYSIWYG mode renders Markdown as an editable document. It is intended for writing and visual editing while preserving Markdown as the document format.

### Source Mode

Source mode provides a CodeMirror editor for direct Markdown editing. It includes Markdown-aware editing behavior, code fence language completion, indentation support, and a dark theme that follows the application theme.

Switching files or editing modes synchronizes the latest document content and preserves unsaved changes in the current document session.

## Code Blocks

Code blocks can be created from a fenced Markdown block or by using the code language picker in WYSIWYG mode.

- Generic languages use lowlight syntax highlighting.
- Mermaid blocks show a rendered diagram and keep the source editable.
- HTML preview blocks render source in a sandboxed iframe and keep the source editable.
- Press `Enter` to create a new line using the current line's leading whitespace.
- Press `Tab` to insert two spaces inside a code block.
- Press `Shift+Tab` to remove up to two leading spaces from the current line.

HTML indentation intentionally follows the current line rather than attempting to infer nested tag structure. This keeps indentation consistent across HTML, Mermaid, and generic code blocks.

## Document Management

WhizMD maintains an in-memory session for open documents. Each document tracks its path, content, and dirty state independently, allowing multiple files to be edited without overwriting one another's state.

The application supports:

- New untitled documents
- File and folder opening
- Sidebar document switching
- Closing individual documents
- Save prompts for unsaved changes
- HTML and PDF export

## Project Structure

```text
src/
├── main/                 Electron main process and IPC handlers
├── preload/              Secure renderer API bridge
├── shared/               Shared types and IPC definitions
└── renderer/src/
    ├── components/      Application, WYSIWYG, and editor UI components
    ├── editor/           Tiptap extensions, NodeViews, media, and parser logic
    ├── export/           HTML/PDF export preparation
    ├── hooks/            React hooks
    ├── store/            Editor configuration and document session state
    └── styles/           Application and editor styles
```

### Image Storage

When saving a Markdown document, WhizMD keeps local image references compatible with GitHub repositories:

- Images already inside the document's directory, its subdirectories, or the containing Git repository are not copied.
- Repository-relative paths such as `../images/logo.png` are preserved.
- Images outside the repository are copied to `assets/` beside the Markdown file when migration is required.
- The `assets/` directory is created only when an image actually needs to be migrated.
- Spaces and other URL characters are encoded, for example `my image.png` becomes `my%20image.png`.
- Existing files are not overwritten; conflicting names receive a numeric suffix.

## Testing

Run all tests with:

```bash
npm test
```

The test suite covers editor syntax, code blocks, HTML blocks, Mermaid-related behavior, tables, images, export output, document state, and NodeView interactions.

For a quick validation of the main editor behavior:

```bash
npm run typecheck
npm test
npm run build
```

## Technology Stack

- Electron 43
- React 19
- TypeScript 5.9
- Tiptap 3
- CodeMirror 6
- Zustand 5
- Vite and Electron Vite
- Vitest
- Mermaid
- KaTeX
- lowlight

## License

This project is licensed under the MIT License. See the `LICENSE` file if one is added to the repository.
