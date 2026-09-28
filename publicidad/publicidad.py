import argparse
import json
import logging
import os
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from pathlib import Path

# Configuracion base
SMTP_SERVER = os.getenv("QUEMONES_SMTP_SERVER", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("QUEMONES_SMTP_PORT", "587"))
SMTP_USER = os.getenv("QUEMONES_SMTP_USER", "bb8767001@smtp-brevo.com")
SMTP_PASS = os.getenv("QUEMONES_SMTP_PASS", "")

MASCARA = "no-reply@quemonesum.site"
NOMBRE = "QuemonesUM"
ASUNTO = "QuemonesUM"

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_TEST_FILE = "prueba.txt"
DEFAULT_PROD_FILE = "correosum_parte_02.txt"

DELAY = 0.8
RECONECTAR_C = 80
MAX_REINTENTOS = 3
LIMITE_DIARIO = 490


HTML = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuemonesUM</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#111111;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 18px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
          <tr>
            <td style="padding:0 0 28px;border-bottom:1px solid #e8e8e8;">
              <h1 style="margin:0;font-size:31px;line-height:1.15;font-weight:700;letter-spacing:0;color:#111111;">
                QuemonesUM
              </h1>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#555555;">
                Un espacio anonimo para leer y publicar lo que pasa en la UM.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 0 10px;">
              <p style="margin:0 0 26px;font-size:16px;line-height:1.7;color:#222222;">
                Entra cuando quieras ver que esta diciendo la comunidad o compartir algo sin poner tu nombre.
                Anónimo · Tu alias cambia en cada hilo
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 30px;">
                <tr>
                  <td>
                    <a href="https://quemonesum.site"
                       style="display:inline-block;border:1px solid #111111;color:#111111;text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:3px;">
                      Entrar a QuemonesUM
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#777777;">
                O visita directamente
                <a href="https://quemonesum.site" style="color:#111111;text-decoration:underline;">quemonesum.site</a>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 0 0;border-top:1px solid #e8e8e8;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#888888;">
Recibes este correo porque formas parte de la comunidad UM. Mensaje automatico; por favor no respondas a esta direccion.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


TEXT = """QuemonesUM

Un espacio anonimo para leer y publicar lo que pasa en la UM.
Entra cuando quieras ver que esta diciendo la comunidad o compartir algo sin poner tu nombre.

https://quemonesum.site
"""


def parse_args():
    parser = argparse.ArgumentParser(description="Enviar correos de QuemonesUM por SMTP.")
    parser.add_argument(
        "--lista",
        default=DEFAULT_TEST_FILE,
        help=f"Archivo de destinatarios dentro de publicidad/ (default: {DEFAULT_TEST_FILE}).",
    )
    parser.add_argument(
        "--produccion",
        action="store_true",
        help=f"Usa la lista de produccion ({DEFAULT_PROD_FILE}) y exige confirmacion.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Muestra destinatarios sin enviar.")
    return parser.parse_args()


def configurar_logger(lista_nombre):
    log_file = BASE_DIR / f"envio_{Path(lista_nombre).stem}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )
    return logging.getLogger()


def resolver_archivo_lista(args):
    lista = DEFAULT_PROD_FILE if args.produccion else args.lista
    path = (BASE_DIR / lista).resolve()
    if BASE_DIR not in path.parents and path != BASE_DIR:
        raise ValueError("La lista debe estar dentro de la carpeta publicidad/.")
    return path


def normalizar_destinatario(valor):
    valor = valor.strip()
    if not valor or valor.startswith("#"):
        return None
    if "@" in valor:
        return valor
    return f"{valor}@alumno.um.edu.mx"


def leer_destinatarios(path):
    with open(path, encoding="utf-8") as f:
        return [dest for line in f if (dest := normalizar_destinatario(line))]


def progreso_path(lista_path):
    return BASE_DIR / f"progreso_{lista_path.stem}.json"


def cargar_progreso(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"enviados": [], "fallidos": []}


def guardar_progreso(path, prog):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(prog, f, indent=2, ensure_ascii=False)


def conectar_smtp():
    if not SMTP_PASS:
        raise RuntimeError(
            "Falta QUEMONES_SMTP_PASS. Define tu clave SMTP de Brevo antes de enviar."
        )
    server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=30)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(SMTP_USER, SMTP_PASS)
    return server


def construir_msg(destinatario):
    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((NOMBRE, MASCARA))
    msg["To"] = destinatario
    msg["Subject"] = ASUNTO
    msg.add_header("Reply-To", MASCARA)
    msg.attach(MIMEText(TEXT, "plain", "utf-8"))
    msg.attach(MIMEText(HTML, "html", "utf-8"))
    return msg


def enviar_con_reintento(server, destinatario, log):
    for intento in range(1, MAX_REINTENTOS + 1):
        try:
            server.send_message(construir_msg(destinatario))
            return server, True
        except (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError):
            log.warning(f"Conexion caida (intento {intento}), reconectando...")
            try:
                server = conectar_smtp()
            except Exception as e:
                log.error(f"No se pudo reconectar: {e}")
                time.sleep(2**intento)
        except smtplib.SMTPRecipientsRefused:
            log.warning(f"Correo rechazado por el servidor: {destinatario}")
            return server, False
        except Exception as e:
            log.warning(f"Error en intento {intento} para {destinatario}: {e}")
            time.sleep(2**intento)
    return server, False


def confirmar_produccion(destinatarios):
    print(f"Vas a enviar a {len(destinatarios)} destinatarios de produccion.")
    confirmacion = input("Escribe ENVIAR para continuar: ").strip()
    return confirmacion == "ENVIAR"


def main():
    args = parse_args()
    lista_path = resolver_archivo_lista(args)
    log = configurar_logger(lista_path.name)
    destinatarios = leer_destinatarios(lista_path)
    prog_file = progreso_path(lista_path)

    if args.dry_run:
        log.info(f"Lista: {lista_path.name} | Destinatarios: {len(destinatarios)}")
        for dest in destinatarios:
            log.info(f"  - {dest}")
        return

    if args.produccion and not confirmar_produccion(destinatarios):
        log.info("Envio cancelado.")
        return

    prog = cargar_progreso(prog_file)
    ya_enviados = set(prog["enviados"])
    ya_fallidos = list(prog["fallidos"])
    pendientes = [d for d in destinatarios if d not in ya_enviados]
    enviados_hoy = 0

    log.info(
        f"Lista: {lista_path.name} | Total: {len(destinatarios)} | "
        f"Ya enviados: {len(ya_enviados)} | Pendientes: {len(pendientes)}"
    )

    if not pendientes:
        log.info(f"Todos los correos de {lista_path.name} ya fueron enviados.")
        log.info(f"Borra {prog_file.name} si quieres reenviar esa misma lista.")
        return

    try:
        server = conectar_smtp()
        log.info("Sesion SMTP iniciada.")

        for i, dest in enumerate(pendientes, start=1):
            if enviados_hoy >= LIMITE_DIARIO:
                guardar_progreso(prog_file, {"enviados": list(ya_enviados), "fallidos": ya_fallidos})
                log.warning(
                    f"Limite diario de {LIMITE_DIARIO} alcanzado. "
                    "Espera 24 h y vuelve a ejecutar el script; reanudara automaticamente."
                )
                break

            if i > 1 and (i - 1) % RECONECTAR_C == 0:
                try:
                    server.quit()
                except Exception:
                    pass
                log.info(f"Reconectando SMTP (correo #{i})...")
                server = conectar_smtp()

            server, ok = enviar_con_reintento(server, dest, log)

            if ok:
                ya_enviados.add(dest)
                enviados_hoy += 1
                log.info(f"[{i}/{len(pendientes)}] OK {dest}")
            else:
                ya_fallidos.append(dest)
                log.error(f"[{i}/{len(pendientes)}] FALLIDO {dest}")

            guardar_progreso(prog_file, {"enviados": list(ya_enviados), "fallidos": ya_fallidos})
            time.sleep(DELAY)

        try:
            server.quit()
        except Exception:
            pass

    except smtplib.SMTPAuthenticationError:
        log.critical("Autenticacion fallida. Revisa el login SMTP de Brevo y QUEMONES_SMTP_PASS.")
    except Exception as e:
        log.critical(f"Error fatal: {e}")
        guardar_progreso(prog_file, {"enviados": list(ya_enviados), "fallidos": ya_fallidos})

    log.info("-" * 50)
    log.info(f"Enviados totales en esta lista: {len(ya_enviados)}")
    log.info(f"Fallidos totales en esta lista: {len(ya_fallidos)}")
    if ya_fallidos:
        log.info("Correos fallidos:")
        for f in ya_fallidos:
            log.info(f"  - {f}")


if __name__ == "__main__":
    main()
