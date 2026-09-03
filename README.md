# GGT - Internal AI Pentest Portal

GGT là nền tảng nội bộ dùng Strix để thực hiện pentest có ủy quyền đối với ứng dụng Web, API và mã nguồn.

Tài liệu này chỉ mô tả mô hình chạy hiện tại:

- Web React chạy trên máy local tại `http://localhost:5173`.
- Node.js API chạy trên máy local tại `http://localhost:4000`.
- Worker và Strix chạy trong Docker.
- SQS, S3 và Secrets Manager chạy local bằng LocalStack.
- PostgreSQL sử dụng Amazon RDS; không chạy PostgreSQL bằng Docker.

Đọc [hướng dẫn sử dụng Web App](docs/huong-dan-su-dung-web-ggt.md) để thực hiện pentest trên giao diện. Các giới hạn kỹ thuật được ghi tại [known limitations](docs/known-limitations.md).

## Kiến trúc local

```text
Browser local
    |
    v
React Web :5173 ---> Node API :4000 ---> Amazon RDS PostgreSQL
                          |
                          v
                  LocalStack SQS :4566
                          |
                          v
                Docker Worker + Strix
                    |             |
                    v             v
             LocalStack S3   LLM provider
```

Web không kết nối trực tiếp với RDS, SQS, S3 hoặc Strix. Web chỉ gọi API local. API ghi lượt pentest vào RDS và gửi `runId` vào SQS. Worker nhận message, chạy Strix, lưu artifacts vào S3 LocalStack và ghi findings trở lại RDS.

## Yêu cầu

- Node.js 20 trở lên.
- npm.
- Docker Desktop đang chạy Linux containers.
- Máy local được phép kết nối tới RDS trên port `5432`.
- Database RDS và user ứng dụng đã được tạo.
- RDS CA bundle tại `certs/rds-global-bundle.pem` nếu bật xác minh certificate.
- LLM API key dùng cho Strix local.

## 1. Cài dependencies

Chỉ cần chạy khi mới clone repository hoặc dependencies thay đổi:

```powershell
npm install
```

## 2. Tạo hai file môi trường

```powershell
Copy-Item .env.example .env
Copy-Item .env.worker-docker.example .env.worker-docker
```

Hai file thật đã được `.gitignore` loại trừ. Không commit password hoặc API key.

### `.env` - API local và database migration

Cập nhật tối thiểu:

```env
# Amazon RDS
DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_NAME=ggtdb
DB_USER=<rds-user>
DB_PASSWORD=<rds-password>
DB_SSL=true
DB_SSL_CA_PATH=C:/absolute/path/to/GGT/certs/rds-global-bundle.pem
DB_SSL_REJECT_UNAUTHORIZED=true

# API local
API_PORT=4000
CORS_ORIGIN=http://localhost:5173
SESSION_SECRET=<random-long-secret>

# LocalStack được API truy cập từ máy host
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566
SQS_QUEUE_URL=http://localhost:4566/000000000000/pentest-jobs
S3_ARTIFACTS_BUCKET=ggt-pentest-artifacts

# Đường dẫn host mà Docker Desktop daemon và worker cùng nhìn thấy.
# Thay theo vị trí thật của repository trên máy Windows.
STRIX_DOCKER_SHARED_DIR=/host_mnt/c/Users/<user>/path/to/GGT/.strix-shared

# Tài khoản admin được tạo bởi seeder
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<admin-password>
```

### `.env.worker-docker` - Worker và Strix

Dùng cùng thông tin RDS với `.env`, nhưng endpoint LocalStack phải sử dụng hostname trong Docker network:

```env
# Amazon RDS
DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_NAME=ggtdb
DB_USER=<rds-user>
DB_PASSWORD=<rds-password>
DB_SSL=true
DB_SSL_CA_PATH=/certs/rds-global-bundle.pem
DB_SSL_REJECT_UNAUTHORIZED=true

# LocalStack được Worker truy cập từ Docker network
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localstack:4566
SQS_QUEUE_URL=http://localstack:4566/000000000000/pentest-jobs
S3_ARTIFACTS_BUCKET=ggt-pentest-artifacts

# LLM và Strix chỉ thuộc Worker
STRIX_LLM=openrouter/free
LLM_API_KEY=<llm-api-key>
LLM_API_BASE=https://openrouter.ai/api/v1
STRIX_BIN=/opt/strix-venv/bin/strix
STRIX_TIMEOUT_MS=1800000
STRIX_MAX_BUDGET_USD=3
STRIX_WORKSPACE_ROOT=/opt/ggt/workspaces

WORKER_POLL_INTERVAL_MS=5000
WORKER_VISIBILITY_TIMEOUT_SEC=1800
```

Không đặt `LLM_API_KEY` trong frontend. API hiện cũng không cần đọc key này.

`STRIX_MAX_BUDGET_USD=3` áp dụng giới hạn chi phí LLM ước tính cho từng lần
pentest. Worker luôn truyền `--max-budget 3` vào Strix; nếu biến bị thiếu, code
vẫn dùng mặc định an toàn là 3 USD. Strix kiểm tra ngân sách sau mỗi model
response nên chi phí thực tế có thể vượt nhẹ do request đã được gửi hoặc đang
chạy đồng thời. Theo dõi AWS Billing/Budgets vẫn cần thiết; đây không phải giới
hạn thanh toán tuyệt đối ở cấp tài khoản AWS.

## 3. Khởi tạo schema trên RDS

Chạy migration sau khi cấu hình `.env`:

```powershell
npm run db:migrate
```

Chạy seeder khi thiết lập database lần đầu hoặc khi chưa có tài khoản admin:

```powershell
npm run db:seed
```

Không cần chạy lại seeder mỗi lần khởi động ứng dụng.

## 4. Khởi động LocalStack và Worker/Strix

Đảm bảo Docker Desktop đang chạy, sau đó:

```powershell
npm run local:rds:up
```

Lệnh này sử dụng [docker-compose.local-rds.yml](docker-compose.local-rds.yml) để:

- Khởi động LocalStack với SQS, S3 và Secrets Manager.
- Tạo queue `pentest-jobs` và bucket `ggt-pentest-artifacts`.
- Build và khởi động Worker chứa Strix.
- Mount Docker socket để Strix có thể chạy sandbox containers.
- Mount `.strix-shared` tại `STRIX_DOCKER_SHARED_DIR` để repository do Strix
  clone trong worker có thể được Docker Desktop bind-mount vào sandbox.
- Nối worker và sandbox vào network `ggt-strix`; Strix dùng
  `STRIX_DOCKER_SANDBOX_NETWORK=ggt-strix` để worker gọi được Caido trong
  sandbox mà không phụ thuộc port `127.0.0.1` của Docker host.
- Kết nối Worker tới Amazon RDS bằng `.env.worker-docker`.

Worker đã chạy trong Docker nên không cần khởi động Worker trực tiếp trên host.

## 5. Khởi động API và Web

Mở hai terminal riêng.

Terminal API:

```powershell
npm run dev:api
```

Log mong đợi:

```text
Database connection established
API listening
```

Terminal Web:

```powershell
npm run dev:web
```

Mở `http://localhost:5173` và đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env`.

## 6. Dừng môi trường local

```powershell
npm run local:rds:down
```

Dừng API và Web bằng `Ctrl+C` trong hai terminal tương ứng.

## Lệnh sử dụng thường xuyên

Sau khi đã cài dependencies, migrate và seed, một phiên làm việc thông thường chỉ cần:

```powershell
npm run local:rds:up
npm run dev:api
npm run dev:web
```

Ba lệnh được chạy theo thứ tự và API/Web chạy ở hai terminal riêng.

## Kiểm tra hệ thống

Kiểm tra container:

```powershell
docker compose -f docker-compose.local-rds.yml ps
```

Theo dõi Worker:

```powershell
docker compose -f docker-compose.local-rds.yml logs -f worker
```

Theo dõi LocalStack:

```powershell
docker compose -f docker-compose.local-rds.yml logs -f localstack
```

Kiểm tra code khi phát triển:

```powershell
npm run typecheck
npm run test
npm run lint
```

## Xử lý lỗi thường gặp

### `no pg_hba.conf entry ... no encryption`

RDS yêu cầu SSL. Kiểm tra trong cả `.env` và `.env.worker-docker`:

```env
DB_SSL=true
DB_SSL_CA_PATH=<đường-dẫn-CA-phù-hợp-với-host-hoặc-container>
DB_SSL_REJECT_UNAUTHORIZED=true
```

### API kết nối được RDS nhưng Worker không kết nối được

- Kiểm tra thông tin `DB_*` trong hai file env giống nhau.
- Trong `.env`, CA path là đường dẫn trên Windows/host.
- Trong `.env.worker-docker`, CA path phải là `/certs/rds-global-bundle.pem`.
- RDS Security Group phải cho phép IP public hiện tại của máy Docker Desktop.

### Pentest đứng ở `QUEUED`

Kiểm tra Worker và LocalStack:

```powershell
docker compose -f docker-compose.local-rds.yml ps
docker compose -f docker-compose.local-rds.yml logs --tail 100 worker
```

### Worker không gọi được Strix

Kiểm tra `STRIX_BIN` trong `.env.worker-docker` và quá trình build image. Cách cài Strix trong [Worker Dockerfile](apps/worker/Dockerfile) phải khớp với phiên bản Strix thực tế đang sử dụng.

## Repository

```text
apps/
  web/       React frontend
  api/       Express API
  worker/    SQS consumer và Strix orchestration
packages/
  shared/    Schema, validation, RBAC và shared types
  database/  Sequelize models và migrations
  strix/     PentestEngine và Strix adapter
infra/aws/   LocalStack bootstrap
docs/        Hướng dẫn sử dụng và giới hạn kỹ thuật
```
