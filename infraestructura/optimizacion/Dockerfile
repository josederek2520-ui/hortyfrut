FROM python:3.12-slim@sha256:b18b261e1b4974b4f321451ad5251ded85abb22c2b8b262da527dda1d031ab30
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /aplicacion
COPY Backend/requirements.txt Backend/requirements-optimizacion.txt /dependencias/
RUN pip install --no-cache-dir -r /dependencias/requirements.txt
USER 10001:10001
CMD ["python", "-m", "celery", "-A", "config.trabajos:aplicacion", "worker", "--loglevel=INFO", "--concurrency=1", "--hostname=optimizacion@%h"]
