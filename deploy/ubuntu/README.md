## 目标

把“工具集门户 + 网关 API”部署到你现有服务器 `123.206.127.250 (Ubuntu)`，同时 **不改动你已存在的 `jiaaxing.cn` 网站内容**。

推荐做法：新增两个子域名（不影响主站）：

- `toolset.jiaaxing.cn`：工具集门户（静态站点）
- `toolset-api.jiaaxing.cn`：网关 API（反向代理到本机 `127.0.0.1:8080`）

Runtime/Registry 只跑在服务器本机，不直接暴露公网。

---

## DNS

在你的 DNS 面板新增：

- `toolset.jiaaxing.cn` → A 记录指向 `123.206.127.250`
- `toolset-api.jiaaxing.cn` → A 记录指向 `123.206.127.250`

主站 `jiaaxing.cn` 保持不变。

---

## 服务器安装依赖（Ubuntu）

假设你用的是 Nginx（最常见）。

1) 安装 Node.js（建议 20+）

2) 安装 Nginx 与证书工具

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 部署后端（Gateway/Runtime/Registry）

1) 拉取代码

```bash
sudo mkdir -p /opt/openclaw-toolset
sudo chown -R $USER:$USER /opt/openclaw-toolset
cd /opt/openclaw-toolset
git clone <你的仓库地址> .
```

2) 安装依赖并启动（systemd）

```bash
npm ci
```

把示例环境变量复制一份（根据你的机器实际情况改）：

```bash
cp .env.example .env
```

关键建议（生产环境）：

- `GATEWAY_JWT_SECRET` 改成随机强密钥
- `GATEWAY_CORS_ORIGINS` 设置为 `https://toolset.jiaaxing.cn`
- `RUNTIME_BASE_URL=http://127.0.0.1:8081`
- `REGISTRY_BASE_URL=http://127.0.0.1:8082`
- `REDIS_URL` 若不装 Redis，可先留空或指向本机 Redis

安装 systemd service：

```bash
sudo cp deploy/ubuntu/systemd/toolset-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now toolset-runtime toolset-registry toolset-gateway
sudo systemctl status toolset-gateway --no-pager
```

---

## 部署门户（Portal 静态站点）

构建门户：

```bash
cd /opt/openclaw-toolset
export VITE_GATEWAY_BASE_URL=https://toolset-api.jiaaxing.cn
export VITE_RUNTIME_BASE_URL=http://127.0.0.1:8081
export VITE_REGISTRY_BASE_URL=http://127.0.0.1:8082
export VITE_BASE_PATH=/
npm --workspace services/portal run build
```

把构建产物放到 Nginx 的静态目录：

```bash
sudo mkdir -p /var/www/toolset-portal
sudo rsync -a --delete services/portal/dist/ /var/www/toolset-portal/
sudo chown -R www-data:www-data /var/www/toolset-portal
```

---

## Nginx 配置（不影响主站）

把两个 server block 复制到 Nginx：

```bash
sudo cp deploy/ubuntu/nginx/toolset.jiaaxing.cn.conf /etc/nginx/sites-available/toolset.jiaaxing.cn
sudo cp deploy/ubuntu/nginx/toolset-api.jiaaxing.cn.conf /etc/nginx/sites-available/toolset-api.jiaaxing.cn

sudo ln -sf /etc/nginx/sites-available/toolset.jiaaxing.cn /etc/nginx/sites-enabled/toolset.jiaaxing.cn
sudo ln -sf /etc/nginx/sites-available/toolset-api.jiaaxing.cn /etc/nginx/sites-enabled/toolset-api.jiaaxing.cn

sudo nginx -t
sudo systemctl reload nginx
```

申请 HTTPS 证书：

```bash
sudo certbot --nginx -d toolset.jiaaxing.cn -d toolset-api.jiaaxing.cn
```

---

## 验证

```bash
curl -s https://toolset-api.jiaaxing.cn/healthz
curl -s https://toolset-api.jiaaxing.cn/v1/tools
```

浏览器打开：

- `https://toolset.jiaaxing.cn`
