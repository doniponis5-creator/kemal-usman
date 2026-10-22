# Касса Kemal Usman — сервер. База — файл SQLite в томе /data (переживает пересборку).
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY kassa_server ./kassa_server
ENV KASSA_DB=/data/kassa.db PYTHONUNBUFFERED=1
EXPOSE 8095
CMD ["uvicorn", "kassa_server.app:app", "--host", "0.0.0.0", "--port", "8095", "--proxy-headers", "--forwarded-allow-ips", "*"]
