FROM node:22-bookworm-slim AS node
WORKDIR /export-deps
COPY workers/files/package.json workers/files/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
FROM python:3.14-slim-bookworm
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 FILES_NETWORK_SANDBOX=1
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer libreoffice-impress libreoffice-calc fonts-liberation fonts-crosextra-carlito python3-seccomp ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY workers/files/requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
# Install the worker's pinned JS exports on Linux, independently of host dependencies.
COPY --from=node /export-deps/node_modules /app/node_modules
COPY workers/files /app/workers/files
RUN useradd --uid 10001 --create-home converter && chown -R converter:converter /app/workers/files
USER converter
WORKDIR /app/workers/files
CMD ["python", "worker.py"]
