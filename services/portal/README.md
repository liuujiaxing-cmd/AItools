# 工具集门户（Portal）

## 部署到独立子域名（推荐，不影响主站）

如果你不想动 `jiaaxing.cn` 已有网站，建议用子域名承载门户，例如：`toolset.jiaaxing.cn`。

### 方案 A：部署到你的 Ubuntu 服务器（Nginx 静态托管）

参考：`deploy/ubuntu/README.md`

### 方案 B：部署到 Vercel（只改子域名解析，不动主站）

- 在 Vercel 导入仓库
- Root Directory 选择 `services/portal`
- Build Command：`npm run build`
- Output Directory：`dist`
- 绑定域名 `toolset.jiaaxing.cn`
- 确保项目内的 `vercel.json` 存在，用于 SPA 刷新路由不 404

本前端用于展示：系统概览、工具列表与详情、在线调用演示，以及 API 文档/监控入口。

需要配置的环境变量：
- `VITE_GATEWAY_BASE_URL`（默认 `http://localhost:8080`）
- `VITE_RUNTIME_BASE_URL`（默认 `http://localhost:8081`，用于“文档与监控”页面生成链接）
- `VITE_REGISTRY_BASE_URL`（默认 `http://localhost:8082`，用于“文档与监控”页面生成链接）

开发启动：
- 在仓库根目录执行 `npm run dev:portal`

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  extends: [
    // other configs...
    // Enable lint rules for React
    reactX.configs['recommended-typescript'],
    // Enable lint rules for React DOM
    reactDom.configs.recommended,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```
