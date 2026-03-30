# 为 AI 开发的工具集（openclaw toolset）

生产级、可部署的工具调用服务，面向 AI 系统（特别是 openclaw）提供标准化工具 API。

本仓库默认实现为 Node.js/TypeScript（原因：当前运行环境的 Python 3.14 与主流 FastAPI/Pydantic 生态存在兼容性缺口）。

## 架构

- `gateway`：统一入口（认证/鉴权、API Key、签名校验、IP 白名单、限流、统一错误格式、可观测性），并将工具调用转发至 `runtime`
- `runtime`：工具运行时（插件热加载、动态注册、工具生命周期、工具执行与缓存）
- `registry`：工具注册中心（元数据、版本、依赖、运行时配置）

三者均提供 OpenAPI 3.0（Swagger UI / Redoc）。

## 快速开始（本地）

```bash
npm install
npm run dev:registry
```

分别启动：

```bash
npm run dev:runtime
npm run dev:gateway
```

默认会转发到 `RUNTIME_BASE_URL`（见 `docker-compose.yml` 环境变量或自行配置）。

## 快速开始（Docker Compose）

```bash
docker compose up
```

- Gateway: `http://localhost:8080/docs`
- Runtime: `http://localhost:8081/docs`
- Registry: `http://localhost:8082/docs`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Jaeger: `http://localhost:16686`

## 调用示例

1) 获取 JWT（演示用 client credentials）

```bash
curl -sS -X POST http://localhost:8080/v1/oauth/token \
  -H 'content-type: application/json' \
  -d '{"client_id":"demo","client_secret":"demo"}'
```

2) 调用工具

```bash
curl -sS -X POST http://localhost:8080/v1/tools/echo:invoke \
  -H 'authorization: Bearer <JWT>' \
  -H 'content-type: application/json' \
  -d '{"input":{"text":"hello"},"context":{"trace_id":"t1"}}'
```

## 目录

- `src/toolset_core`：统一接口规范、错误码、鉴权/限流/日志/指标中间件
- `src/services/*`：三个微服务实现
- `src/tools`：示例工具（插件目录，可热加载）
- `sdks/*`：多语言 SDK 示例（最小可用）
- `deploy/docker`、`deploy/k8s`：容器/K8s
- `configs`：Prometheus/Grafana
