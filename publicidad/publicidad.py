import smtplib
import time
import json
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

# ── Configuración ────────────────────────────────────────────────────────────
SMTP_SERVER    = "smtp.gmail.com"
SMTP_PORT      = 587
SMTP_USER      = "kasutokirigaya35@gmail.com"
SMTP_PASS      = "xemnaunbzsogduog"

MASCARA        = "no-reply@quemonesum.site"
NOMBRE         = "QuemonesUM"
ASUNTO         = "🔥 ¿Ya conoces QuemonesUM? El foro anónimo de la UM"
TXT_FILE       = "correosum_parte_03.txt"

DELAY          = 0.8   # segundos entre correos
RECONECTAR_C   = 80    # reconectar SMTP cada N envíos
MAX_REINTENTOS = 3     # intentos por correo antes de marcarlo fallido
LIMITE_DIARIO  = 490   # pausa tras este número (Gmail limita a 500/día)

PROGRESO_FILE  = "progreso_envio.json"
LOG_FILE       = "envio_correos.log"

# ── Logger ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger()

# ── Leer matrículas ───────────────────────────────────────────────────────────
with open(TXT_FILE, encoding="utf-8") as f:
    destinatarios = [
        f"{linea.strip()}@alumno.um.edu.mx"
        for linea in f
        if linea.strip()
    ]

# --- Plantilla HTML ---
html = """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>QuemonesUM</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">

        <!-- Contenedor principal -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header con gradiente -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#d946ef 100%);padding:48px 40px 40px;text-align:center;">
<p style="margin:0 0 8px 0;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);font-weight:600;">Universidad de Montemorelos</p>
              <h1 style="margin:0;font-size:42px;font-weight:800;color:#ffffff;letter-spacing:-1px;">QuemonesUM</h1>
              <p style="margin:12px 0 0 0;font-size:16px;color:rgba(255,255,255,0.85);line-height:1.5;">El foro <strong>anónimo</strong> de los estudiantes de la UM</p>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:40px 40px 32px;">

              <p style="margin:0 0 20px 0;font-size:16px;color:#3f3f46;line-height:1.7;">
                ¿Tienes algo que contar pero no quieres que sepan quién eres? 👀<br/>
                En <strong style="color:#7c3aed;">QuemonesUM</strong> puedes publicar de forma completamente anónima. Nadie sabrá que fuiste tú.
              </p>

              <!-- Categorías -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding-bottom:12px;">
                    <p style="margin:0 0 14px 0;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#a1a1aa;">Categorías</p>
                  </td>
                </tr>
                <tr>
                  <!-- Quemones -->
                  <td width="25%" style="padding:0 6px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf5ff;border-radius:12px;border-left:3px solid #7c3aed;overflow:hidden;">
                      <tr><td style="padding:14px 12px;">
                        <p style="margin:0 0 4px 0;font-size:18px;">🔥</p>
                        <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#7c3aed;">Quemones</p>
                        <p style="margin:0;font-size:11px;color:#71717a;line-height:1.4;">Situaciones que te dejaron ardido</p>
                      </td></tr>
                    </table>
                  </td>
                  <!-- Confesiones -->
                  <td width="25%" style="padding:0 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf4ff;border-radius:12px;border-left:3px solid #a855f7;overflow:hidden;">
                      <tr><td style="padding:14px 12px;">
                        <p style="margin:0 0 4px 0;font-size:18px;">🤫</p>
                        <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#a855f7;">Confesiones</p>
                        <p style="margin:0;font-size:11px;color:#71717a;line-height:1.4;">Secretos que ya no puedes guardar</p>
                      </td></tr>
                    </table>
                  </td>
                  <!-- Infieles -->
                  <td width="25%" style="padding:0 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf2f8;border-radius:12px;border-left:3px solid #ec4899;overflow:hidden;">
                      <tr><td style="padding:14px 12px;">
                        <p style="margin:0 0 4px 0;font-size:18px;">💔</p>
                        <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#ec4899;">Infieles</p>
                        <p style="margin:0;font-size:11px;color:#71717a;line-height:1.4;">Dramas del amor en el campus</p>
                      </td></tr>
                    </table>
                  </td>
                  <!-- General -->
                  <td width="25%" style="padding:0 0 0 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border-radius:12px;border-left:3px solid #a1a1aa;overflow:hidden;">
                      <tr><td style="padding:14px 12px;">
                        <p style="margin:0 0 4px 0;font-size:18px;">💬</p>
                        <p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#52525b;">General</p>
                        <p style="margin:0;font-size:11px;color:#71717a;line-height:1.4;">Lo que no cabe en las otras</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Features -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border-radius:14px;padding:4px;margin-bottom:32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:8px 0;border-left:3px solid #7c3aed;padding-left:14px;">
                          <span style="font-size:14px;color:#3f3f46;">100% anónimo — nunca revelaremos quién eres</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-left:3px solid #7c3aed;padding-left:14px;">
                          <span style="font-size:14px;color:#3f3f46;">Vota los posts y comenta lo que piensas</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-left:3px solid #7c3aed;padding-left:14px;">
                          <span style="font-size:14px;color:#3f3f46;">Solo para la comunidad UM — ¿de quién más hablarías?</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-left:3px solid #7c3aed;padding-left:14px;">
                          <span style="font-size:14px;color:#3f3f46;">Comparte en WhatsApp con un solo toque</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td align="center">
                    <a href="https://quemonesum.site"
                       style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#d946ef);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:50px;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(124,58,237,0.35);">
                      Entrar a QuemonesUM 🔥
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0 0;font-size:14px;color:#a1a1aa;text-align:center;">
                o visita <a href="https://quemonesum.site" style="color:#7c3aed;text-decoration:none;font-weight:600;">quemonesum.site</a>
              </p>

            </td>
          </tr>

          <!-- Divisor -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:0;"/>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Estás recibiendo este correo porque eres parte de la comunidad UM.<br/>
                Este es un mensaje automático, por favor no respondas a este correo.
              </p>
              <p style="margin:0;font-size:11px;color:#d4d4d8;">
                &copy; 2025 QuemonesUM &mdash; Universidad de Montemorelos, Nuevo León
              </p>
            </td>
          </tr>

        </table>
        <!-- Fin contenedor -->

      </td>
    </tr>
  </table>

</body>
</html>"""

# ── Helpers ───────────────────────────────────────────────────────────────────
def cargar_progreso():
    try:
        with open(PROGRESO_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        return {"enviados": [], "fallidos": []}

def guardar_progreso(prog):
    with open(PROGRESO_FILE, "w") as f:
        json.dump(prog, f, indent=2)

def conectar_smtp():
    server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=30)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(SMTP_USER, SMTP_PASS)
    return server

def construir_msg(destinatario):
    msg = MIMEMultipart("alternative")
    msg["From"]    = formataddr((NOMBRE, MASCARA))
    msg["To"]      = destinatario
    msg["Subject"] = ASUNTO
    msg.add_header("Reply-To", MASCARA)
    msg.attach(MIMEText(html, "html"))
    return msg

def enviar_con_reintento(server, destinatario):
    """Intenta enviar hasta MAX_REINTENTOS veces con backoff exponencial."""
    for intento in range(1, MAX_REINTENTOS + 1):
        try:
            server.send_message(construir_msg(destinatario))
            return server, True
        except (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError):
            log.warning(f"Conexión caída (intento {intento}), reconectando...")
            try:
                server = conectar_smtp()
            except Exception as e:
                log.error(f"No se pudo reconectar: {e}")
                time.sleep(2 ** intento)
        except smtplib.SMTPRecipientsRefused:
            log.warning(f"Correo rechazado por el servidor: {destinatario}")
            return server, False
        except Exception as e:
            log.warning(f"Error en intento {intento} para {destinatario}: {e}")
            time.sleep(2 ** intento)
    return server, False

# ── Envío principal ───────────────────────────────────────────────────────────
prog = cargar_progreso()
ya_enviados  = set(prog["enviados"])
ya_fallidos  = list(prog["fallidos"])
pendientes   = [d for d in destinatarios if d not in ya_enviados]
enviados_hoy = 0

log.info(f"Total: {len(destinatarios)} | Ya enviados: {len(ya_enviados)} | Pendientes: {len(pendientes)}")

if not pendientes:
    log.info("Todos los correos ya fueron enviados. Borra progreso_envio.json para reenviar.")
else:
    try:
        server = conectar_smtp()
        log.info("Sesión SMTP iniciada.")

        for i, dest in enumerate(pendientes, start=1):
            # Límite diario: pausa y avisa
            if enviados_hoy >= LIMITE_DIARIO:
                guardar_progreso({"enviados": list(ya_enviados), "fallidos": ya_fallidos})
                log.warning(
                    f"Límite diario de {LIMITE_DIARIO} alcanzado. "
                    "Espera 24 h y vuelve a ejecutar el script; reanudará automáticamente."
                )
                break

            # Reconexión periódica
            if i > 1 and (i - 1) % RECONECTAR_C == 0:
                try:
                    server.quit()
                except Exception:
                    pass
                log.info(f"Reconectando SMTP (correo #{i})...")
                server = conectar_smtp()

            server, ok = enviar_con_reintento(server, dest)

            if ok:
                ya_enviados.add(dest)
                enviados_hoy += 1
                log.info(f"[{i}/{len(pendientes)}] ✓ {dest}")
            else:
                ya_fallidos.append(dest)
                log.error(f"[{i}/{len(pendientes)}] ✗ {dest} — marcado como fallido")

            guardar_progreso({"enviados": list(ya_enviados), "fallidos": ya_fallidos})
            time.sleep(DELAY)

        try:
            server.quit()
        except Exception:
            pass

    except smtplib.SMTPAuthenticationError:
        log.critical("Autenticación fallida. Verifica SMTP_USER y SMTP_PASS.")
    except Exception as e:
        log.critical(f"Error fatal de conexión: {e}")
        guardar_progreso({"enviados": list(ya_enviados), "fallidos": ya_fallidos})

# ── Resumen final ─────────────────────────────────────────────────────────────
log.info("─" * 50)
log.info(f"Enviados totales : {len(ya_enviados)}")
log.info(f"Fallidos totales : {len(ya_fallidos)}")
if ya_fallidos:
    log.info("Correos fallidos:")
    for f in ya_fallidos:
        log.info(f"  - {f}")