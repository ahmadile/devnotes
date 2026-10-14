# Contributing to DevNotes ⚡

Thank you for your interest in contributing to **DevNotes**! DevNotes is an open-source project dedicated to giving software engineers, computer science students, and tech leads the best note-taking, code annotation, and architectural modeling workspace.

We welcome contributions of all kinds: bug fixes, new features, UI/UX polish, documentation improvements, and translations.

---

## 📋 Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, constructive, and considerate in all communications and code reviews.

---

## 🛠️ Development Setup

1. **Fork the Repository:**
   Click the "Fork" button on GitHub to create your own copy of the repository.

2. **Clone your fork locally:**
   ```bash
   git clone https://github.com/<your-username>/devnotes.git
   cd devnotes
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Add your test credentials (see [README.md](./README.md) for details). Note that local offline notes work out-of-the-box even without a MongoDB cluster!

5. **Start the development servers:**
   ```bash
   npm run dev
   ```
   This command starts both:
   - Frontend Vite server: `http://localhost:5173`
   - Backend Express API server: `http://localhost:3001`

---

## 🌿 Branching Strategy & Git Workflow

- **`main`** is our production-ready branch. All changes should be submitted via Pull Requests against `main`.
- Create focused, descriptive branch names:
  - `feat/feature-name` (e.g. `feat/vim-mode`, `feat/mermaid-theme-picker`)
  - `fix/bug-description` (e.g. `fix/folder-overflow`, `fix/clipboard-paste-firefox`)
  - `docs/documentation-update` (e.g. `docs/api-guide`)
  - `perf/optimization` (e.g. `perf/debounce-local-storage`)

---

## 📝 Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types:
- `feat`: A new feature or capability.
- `fix`: A bug fix.
- `docs`: Documentation changes only.
- `style`: Changes that do not affect the meaning of the code (whitespace, formatting).
- `refactor`: A code change that neither fixes a bug nor adds a feature.
- `perf`: A code change that improves performance.
- `test`: Adding missing tests or correcting existing tests.
- `chore`: Changes to build process, tooling, or auxiliary libraries.

### Examples:
- `feat(diagrams): add pan and zoom controls to Mermaid viewer`
- `fix(folders): prevent layout overflow on deeply nested subfolders`
- `docs(readme): add Ollama local model setup instructions`

---

## 🧪 Testing & Quality Assurance

Before submitting a Pull Request, always verify that both the frontend and backend compile cleanly:

```bash
# Type check both frontend and backend
npm run lint

# Build production bundles
npm run build
```

Ensure there are no TypeScript errors or broken imports before pushing your branch.

---

## 🚀 Pull Request Checklist

When opening a Pull Request:
1. **Title:** Use a clear, concise Conventional Commit message.
2. **Description:** Explain **what** was changed, **why** it was needed, and how you tested it.
3. **Visuals:** For UI/UX changes, attach screenshots or short screen recordings (before vs after).
4. **Clean Git History:** Rebase on `origin/main` if your branch has fallen behind.

---

## 💡 Ideas for Contribution

If you are looking for somewhere to start, consider:
- **Internationalization (i18n)**: Adding a language switcher for English, French, Spanish, German, Japanese, etc.
- **New AI Providers**: Adding integration for Anthropic Direct API, Groq, Mistral AI, or AWS Bedrock.
- **Custom Syntax Highlighting Themes**: Expanding the theme palette (Dracula, Nord, Tokyo Night, Catppuccin).
- **Export Formats**: Exporting notes as standalone self-contained HTML files or PDF documents.
- **Keyboard Shortcuts**: Adding Vim or Emacs keybindings for editing notes.

Thank you for helping make DevNotes better for developers everywhere! 🚀
