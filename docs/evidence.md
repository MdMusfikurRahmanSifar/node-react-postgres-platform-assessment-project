# Verification & Execution Evidence

This document captures the verified outputs and logs of the platform components.

---

## 1. Docker Compose Multi-Stage Builds & Image Sizes

```
REPOSITORY                                TAG       IMAGE ID       DISK USAGE   CONTENT SIZE
node-react-postgres-platform-backend     latest    1f2a99213a06   216MB        51.4MB
node-react-postgres-platform-frontend    latest    9be7fd4f1040   73.8MB       21.0MB
```

* Both Dockerfiles utilize Alpine Linux base images (`node:20-alpine`, `nginx:1.27-alpine`).
* Build tools, package managers, and devDependencies are discarded in build stages.
* Backend runs under the non-root `USER node` security context.

---

## 2. Docker Compose Runtime & End-to-End Test

### Container Status:
```
NAME                                          STATUS
node-react-postgres-platform-postgres-1       Up (healthy)
node-react-postgres-platform-redis-1          Up (healthy)
node-react-postgres-platform-worker-1         Up
node-react-postgres-platform-backend-1        Up
node-react-postgres-platform-frontend-1       Up
```

### Health Endpoints Verification:
```http
GET http://localhost:4000/api/health
Response: {"status":"ok"}

GET http://localhost:4000/api/health/live
Response: {"status":"alive"}

GET http://localhost:4000/api/health/ready
Response: {"status":"ready"}

GET http://localhost:4000/api/health/redis
Response: {"status":"ok"}
```

### End-to-End Data Write, Queue Processing, and Read:
```http
POST http://localhost:4000/api/items
Content-Type: application/json
Body: {"name":"DevOps Platform Assessment Item 1"}

Response:
201 Created
{"id":1,"name":"DevOps Platform Assessment Item 1","created_at":"2026-10-11T21:44:52.458Z"}
```

### Worker Log (BullMQ Dequeue Execution):
```log
worker started, waiting for jobs on 'item-events'
processing item-created {
  id: 1,
  name: 'DevOps Platform Assessment Item 1',
  created_at: '2026-10-11T21:44:52.458Z'
}
job 1 completed
```

### Database Read Verification:
```http
GET http://localhost:4000/api/items

Response:
[
  {
    "id": 1,
    "name": "DevOps Platform Assessment Item 1",
    "created_at": "2026-10-11T21:44:52.458Z"
  }
]
```

### Prometheus `/metrics` Output Verification:
```prometheus
# HELP nodejs_process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE nodejs_process_cpu_user_seconds_total counter
nodejs_process_cpu_user_seconds_total 1.143431

# HELP http_requests_total Total number of HTTP requests processed
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/health",status="200"} 1
http_requests_total{method="POST",route="/api/items",status="201"} 1
http_requests_total{method="GET",route="/api/items",status="200"} 1

# HELP http_request_duration_seconds Histogram of HTTP request durations in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.05",method="GET",route="/api/items",status="200"} 1
...
```

### Frontend Serving Verification:
```http
GET http://localhost:8080/
Response: 200 OK (Served via Nginx Alpine with SPA fallback)
```

---

## 3. Kubernetes Deployment Artifacts

The complete manifest structure is organized under `k8s/` and `observability/`:

```
k8s/
├── namespace-dev.yaml             # Namespace: dev
├── app-configmap.yaml             # ConfigMap (DB_HOST, DB_NAME, REDIS_URL, URLs)
├── app-secrets.yaml               # Secret (DB_USER, DB_PASSWORD base64)
├── postgres-pv.yaml               # PersistentVolume (1Gi, hostPath)
├── postgres-pvc.yaml              # PersistentVolumeClaim (1Gi)
├── postgres-statefulset.yaml      # Postgres StatefulSet with probes and PVC mount
├── postgres-service.yaml          # ClusterIP :5432
├── backend-deployment.yaml        # Express API (2 replicas, live/ready probes, prometheus annotations)
├── backend-service.yaml           # ClusterIP :4000
├── frontend-deployment.yaml       # React SPA Nginx (2 replicas, probes, resource limits)
├── frontend-service.yaml          # NodePort :30080
├── ingress-dev.yaml               # Nginx Ingress (/ and /api rules + rate limiting annotations)
├── redis-deployment.yaml          # Redis (TCP probes)
├── redis-service.yaml             # ClusterIP :6379
├── bullmq-worker-deployment.yaml  # BullMQ background worker
├── search-deployment.yaml         # OpenSearch dev-mode
└── search-service.yaml            # ClusterIP :9200

observability/
├── prometheus.yaml                # Prometheus Deployment, ConfigMap (pod auto-scrape), RBAC, Service
├── grafana.yaml                   # Grafana Deployment, auto-provisioned datasources, NodePort :30300
├── fluentbit-daemonset.yaml       # Fluent Bit DaemonSet (/var/log/containers tailing -> Loki)
├── loki.yaml                      # Loki Deployment and Service :3100
└── hpa-backend.yaml               # HPA (2->6 replicas, CPU 70%, Memory 80%, 300s scale-down window)
```
