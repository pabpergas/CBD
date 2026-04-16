"""
Worker Python para CBD RAG - Generación de Artefactos
Recibe código Python, lo ejecuta en un entorno controlado,
y devuelve el archivo generado.
"""

import json
import os
import subprocess
import sys
import tempfile
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler

OUTPUT_DIR = "/tmp/output"
TIMEOUT_SECONDS = 60
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class ArtifactHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/convert":
            return self.handle_convert()
        if self.path != "/execute":
            self.send_error(404)
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            code = data.get("code", "")
            filename = data.get("filename", "output.txt")
            context = data.get("context", None)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        # Limpiar directorio de salida
        for f in os.listdir(OUTPUT_DIR):
            os.remove(os.path.join(OUTPUT_DIR, f))

        # Escribir datos de contexto como archivo JSON accesible para el código
        context_path = os.path.join(OUTPUT_DIR, "_context.json")
        if context:
            with open(context_path, "w", encoding="utf-8") as cf:
                json.dump(context, cf, ensure_ascii=False, indent=2)

        output_path = os.path.join(OUTPUT_DIR, filename)

        # Escribir código en archivo temporal y ejecutar como subproceso
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as tmp:
            tmp.write(code)
            tmp_path = tmp.name

        try:
            result = subprocess.run(
                [sys.executable, tmp_path],
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SECONDS,
                cwd=OUTPUT_DIR,
                env={
                    **os.environ,
                    "MPLBACKEND": "Agg",  # matplotlib no interactivo
                },
            )

            if result.returncode != 0:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": "Execution failed",
                    "stderr": result.stderr[-2000:] if result.stderr else "",
                    "stdout": result.stdout[-1000:] if result.stdout else "",
                }).encode())
                return

            # Verificar si se creó el archivo
            if not os.path.exists(output_path):
                # Quizás el archivo se creó con diferente capitalización o en el directorio de trabajo
                files = os.listdir(OUTPUT_DIR)
                if files:
                    output_path = os.path.join(OUTPUT_DIR, files[0])
                    filename = files[0]
                else:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": f"No output file generated. stdout: {result.stdout[-500:]}",
                    }).encode())
                    return

            file_size = os.path.getsize(output_path)
            if file_size > MAX_FILE_SIZE:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "error": f"File too large: {file_size} bytes (max {MAX_FILE_SIZE})",
                }).encode())
                return

            # Devolver el archivo
            mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("X-Filename", filename)
            self.send_header("X-File-Size", str(file_size))
            self.end_headers()

            with open(output_path, "rb") as f:
                self.wfile.write(f.read())

        except subprocess.TimeoutExpired:
            self.send_response(408)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": f"Execution timed out after {TIMEOUT_SECONDS}s",
            }).encode())

        finally:
            os.unlink(tmp_path)

    def handle_convert(self):
        """Convertir docx→pdf o pdf→png. Espera bytes del archivo + formato destino."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            source_data = data.get("data", "")  # archivo codificado en base64
            source_filename = data.get("filename", "input.docx")
            target_format = data.get("format", "pdf")  # "pdf" o "png"
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        # Limpiar y escribir archivo fuente
        for f in os.listdir(OUTPUT_DIR):
            os.remove(os.path.join(OUTPUT_DIR, f))

        import base64
        source_path = os.path.join(OUTPUT_DIR, source_filename)
        with open(source_path, "wb") as f:
            f.write(base64.b64decode(source_data))

        try:
            if target_format == "pdf":
                # docx → pdf vía LibreOffice
                result = subprocess.run(
                    ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", OUTPUT_DIR, source_path],
                    capture_output=True, text=True, timeout=60
                )
                if result.returncode != 0:
                    raise Exception(f"LibreOffice error: {result.stderr}")

                pdf_name = os.path.splitext(source_filename)[0] + ".pdf"
                pdf_path = os.path.join(OUTPUT_DIR, pdf_name)

                with open(pdf_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("X-Filename", pdf_name)
                self.send_header("X-File-Size", str(len(content)))
                self.end_headers()
                self.wfile.write(content)

            elif target_format == "png":
                # pdf → png vía pdf2image, o docx → pdf → png (TODAS las páginas)
                from pdf2image import convert_from_path
                from PIL import Image

                pdf_path = source_path
                if source_filename.endswith((".docx", ".doc")):
                    subprocess.run(
                        ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", OUTPUT_DIR, source_path],
                        capture_output=True, text=True, timeout=60
                    )
                    pdf_path = os.path.join(OUTPUT_DIR, os.path.splitext(source_filename)[0] + ".pdf")

                # Convertir páginas (máx 10 para preview, DPI bajo para tamaño manejable)
                total_pages = len(convert_from_path(pdf_path, dpi=30))  # conteo rápido
                max_pages = min(total_pages, 10)
                images = convert_from_path(pdf_path, dpi=100, first_page=1, last_page=max_pages)

                if len(images) == 1:
                    # Una sola página
                    final_img = images[0]
                else:
                    # Unir todas las páginas verticalmente con separador
                    separator_height = 4
                    total_width = max(img.width for img in images)
                    total_height = sum(img.height for img in images) + separator_height * (len(images) - 1)

                    final_img = Image.new("RGB", (total_width, total_height), (14, 14, 14))
                    y_offset = 0
                    for i, img in enumerate(images):
                        # Centrar si es más estrecha
                        x_offset = (total_width - img.width) // 2
                        final_img.paste(img, (x_offset, y_offset))
                        y_offset += img.height + separator_height

                png_name = os.path.splitext(source_filename)[0] + "_preview.png"
                png_path = os.path.join(OUTPUT_DIR, png_name)
                final_img.save(png_path, "PNG", optimize=True)

                with open(png_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("X-Filename", png_name)
                self.send_header("X-File-Size", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(400, f"Unsupported format: {target_format}")

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        print(f"[worker] {args[0]}")


if __name__ == "__main__":
    port = 8000
    server = HTTPServer(("0.0.0.0", port), ArtifactHandler)
    print(f"[worker] Python artifact worker running on port {port}")
    server.serve_forever()
