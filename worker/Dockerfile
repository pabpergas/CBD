FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    reportlab \
    python-docx \
    openpyxl \
    matplotlib \
    pandas \
    numpy \
    Pillow \
    pdf2image

WORKDIR /app
COPY server.py .

RUN mkdir -p /tmp/output

EXPOSE 8000
CMD ["python", "server.py"]
