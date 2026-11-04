# Nightly scraper for Coolify (Scheduled Task / cron container). Build context: apps/data/scraper
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .
CMD ["python", "-m", "labs_scraper", "run"]
