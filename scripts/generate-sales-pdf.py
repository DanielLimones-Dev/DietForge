"""Generate the DietForge commercial brochure from versioned product screens."""

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/DietForge-presentacion-comercial.pdf"
ASSETS = ROOT / "docs/assets/sales"
W, H = A4
COLORS = {
    "ink": HexColor("#0B1720"),
    "forest": HexColor("#072A23"),
    "green": HexColor("#0A9A6A"),
    "mint": HexColor("#69D8B0"),
    "pale": HexColor("#EAF8F2"),
    "line": HexColor("#CFE6DC"),
    "slate": HexColor("#52656F"),
    "white": HexColor("#FFFFFF"),
    "cream": HexColor("#F7FAF8"),
    "amber": HexColor("#E9A23B"),
    "red": HexColor("#DD5A66"),
    "blue": HexColor("#3C8EDB"),
}


def generate() -> Path:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4)
    c.setTitle("DietForge · Presentación comercial")
    c.setAuthor("DietForge")

    def rr(x, y, width, height, radius, fill, stroke=None, line_width=1):
        c.setFillColor(fill)
        c.setStrokeColor(stroke or fill)
        c.setLineWidth(line_width)
        c.roundRect(x, y, width, height, radius, fill=1, stroke=1 if stroke else 0)

    def text(value, x, y, size=10, color=None, font="Helvetica", max_width=None):
        chosen = size
        if max_width:
            while chosen > 6 and stringWidth(value, font, chosen) > max_width:
                chosen -= 0.25
        c.setFillColor(color or COLORS["ink"])
        c.setFont(font, chosen)
        c.drawString(x, y, value)

    def paragraph(value, x, y, width, size=10, leading=14, color=None, font="Helvetica"):
        words = value.split()
        lines, line = [], ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if stringWidth(candidate, font, size) <= width:
                line = candidate
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
        c.setFillColor(color or COLORS["slate"])
        c.setFont(font, size)
        for index, current in enumerate(lines):
            c.drawString(x, y - index * leading, current)
        return y - len(lines) * leading

    def logo(x, y, light=False):
        color = COLORS["mint"] if light else COLORS["green"]
        c.setStrokeColor(color)
        c.setLineWidth(2)
        c.circle(x + 10, y, 9, fill=0, stroke=1)
        c.line(x + 5, y - 1, x + 9, y - 5)
        c.line(x + 9, y - 5, x + 15, y + 5)
        text("DIETFORGE", x + 27, y - 5, 11, COLORS["white"] if light else COLORS["ink"], "Helvetica-Bold")

    def footer(page):
        c.setStrokeColor(COLORS["line"])
        c.line(42, 45, W - 42, 45)
        text("DIETFORGE · COACHING EN UN SOLO LUGAR", 42, 28, 7, COLORS["slate"], "Helvetica-Bold")
        text(f"{page:02d}", W - 55, 28, 7, COLORS["green"], "Helvetica-Bold")

    def page_title(kicker, title, description=None):
        logo(42, H - 50)
        text(kicker, 42, H - 101, 8, COLORS["green"], "Helvetica-Bold")
        text(title, 42, H - 139, 25, COLORS["ink"], "Helvetica-Bold", W - 84)
        if description:
            paragraph(description, 42, H - 166, W - 84, 10, 14, COLORS["slate"])

    def screen(path, x, y, width, height, label, accent=None):
        accent = accent or COLORS["green"]
        rr(x + 4, y - 5, width, height, 13, HexColor("#DCE8E3"))
        rr(x, y, width, height, 13, COLORS["white"], COLORS["line"])
        c.setFillColor(COLORS["forest"])
        c.roundRect(x, y + height - 23, width, 23, 13, fill=1, stroke=0)
        c.rect(x, y + height - 23, width, 11, fill=1, stroke=0)
        for offset, color in ((0, COLORS["red"]), (11, COLORS["amber"]), (22, COLORS["mint"])):
            c.setFillColor(color)
            c.circle(x + 13 + offset, y + height - 11.5, 2.6, fill=1, stroke=0)
        text(label.upper(), x + 44, y + height - 15, 6.5, COLORS["white"], "Helvetica-Bold")
        image = ImageReader(str(path))
        iw, ih = image.getSize()
        available_w, available_h = width - 8, height - 31
        c.setFillColor(HexColor("#050914"))
        c.rect(x + 4, y + 4, available_w, available_h, fill=1, stroke=0)
        scale = min(available_w / iw, available_h / ih)
        draw_w, draw_h = iw * scale, ih * scale
        c.drawImage(image, x + 4 + (available_w - draw_w) / 2, y + 4 + (available_h - draw_h) / 2,
                    draw_w, draw_h, preserveAspectRatio=True, mask="auto")
        c.setStrokeColor(accent)
        c.setLineWidth(1.1)
        c.roundRect(x, y, width, height, 13, fill=0, stroke=1)

    def feature(x, y, title, description, number):
        rr(x, y, 246, 82, 15, COLORS["white"], COLORS["line"])
        rr(x + 16, y + 42, 31, 25, 9, COLORS["pale"])
        text(number, x + 25, y + 50, 8, COLORS["green"], "Helvetica-Bold")
        text(title, x + 58, y + 53, 10.5, COLORS["ink"], "Helvetica-Bold", 170)
        paragraph(description, x + 18, y + 28, 208, 8.3, 11, COLORS["slate"])

    # Cover
    c.setFillColor(COLORS["cream"])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(COLORS["forest"])
    c.rect(0, H - 405, W, 405, fill=1, stroke=0)
    c.setFillColor(HexColor("#0E473A"))
    c.circle(W - 30, H - 80, 160, fill=1, stroke=0)
    c.setFillColor(HexColor("#12624D"))
    c.circle(W - 25, H - 70, 105, fill=1, stroke=0)
    logo(42, H - 54, True)
    text("COACHING PROFESIONAL, SIN DESORDEN", 42, H - 115, 8, COLORS["mint"], "Helvetica-Bold")
    text("Convierte tu método", 42, H - 161, 29, COLORS["white"], "Helvetica-Bold")
    text("en una experiencia premium.", 42, H - 198, 29, COLORS["white"], "Helvetica-Bold")
    paragraph("Clientes, nutrición, rutinas, agenda y seguimiento en una plataforma creada para coaches.",
              42, H - 232, 430, 11, 16, HexColor("#C7DFD6"))
    rr(42, H - 315, 168, 34, 16, COLORS["green"])
    text("DESDE $2,000 MXN / MES", 58, H - 303, 8.5, COLORS["white"], "Helvetica-Bold")
    screen(ASSETS / "coach.jpg", 42, 119, W - 84, 276, "Panel del coach")
    text("Visibilidad inmediata de clientes activos, planes, check-ins y prioridades.", 54, 91, 9, COLORS["slate"])
    footer(1)
    c.showPage()

    # Product screens
    c.setFillColor(COLORS["cream"])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    page_title("LA OPERACIÓN EN UNA SOLA VISTA", "Más control. Menos tareas repetidas.",
               "Cada pantalla conecta con el expediente del cliente para que el coach trabaje con continuidad.")
    screen(ASSETS / "foods.jpg", 42, 431, W - 84, 205, "Base de alimentos y rueda nutricional")
    rr(55, 390, W - 110, 30, 11, COLORS["pale"])
    text("Busca, compara y agrega alimentos sin perder de vista su aporte nutricional.", 70, 401, 8.5, COLORS["green"], "Helvetica-Bold")
    screen(ASSETS / "coach.jpg", 42, 139, W - 84, 205, "Clientes y seguimiento")
    rr(55, 98, W - 110, 30, 11, COLORS["pale"])
    text("Detecta vencimientos y clientes que requieren atención antes de que se pierda continuidad.", 70, 109, 8.3, COLORS["green"], "Helvetica-Bold")
    footer(2)
    c.showPage()

    # Calculator and reports
    c.setFillColor(COLORS["cream"])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    page_title("DECISIONES CON CONTEXTO", "Calcula, revisa y da seguimiento.",
               "DietForge separa la propuesta nutricional del seguimiento real del cliente.")
    screen(ASSETS / "calculator.jpg", 42, 474, W - 84, 165, "Calculadora de macros")
    rr(42, 401, W - 84, 54, 14, COLORS["pale"], COLORS["line"])
    text("CÁLCULO", 58, 431, 7, COLORS["green"], "Helvetica-Bold")
    paragraph("Genera y guarda una evaluación de macros. No crea un check-in ni modifica la tendencia de peso.",
              58, 416, W - 116, 8.5, 11, COLORS["slate"])
    screen(ASSETS / "reports.jpg", 42, 130, W - 84, 244, "Reportes y alertas")
    rr(42, 67, W - 84, 45, 14, COLORS["forest"])
    text("CHECK-IN", 58, 93, 7, COLORS["mint"], "Helvetica-Bold")
    text("Actualiza peso, composición, promedio, tendencia e historial desde el seguimiento.", 58, 78, 8.3, COLORS["white"])
    footer(3)
    c.showPage()

    # Capabilities
    c.setFillColor(COLORS["cream"])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    page_title("UN FLUJO QUE ACOMPAÑA TU MÉTODO", "De la alta al progreso, sin perder contexto.")
    stages = [
        ("01", "Da de alta", "Registra al cliente y habilita su acceso."),
        ("02", "Evalúa", "Calcula macros y define objetivos."),
        ("03", "Entrega", "Publica dieta, rutina y recursos."),
        ("04", "Acompaña", "Recibe check-ins y ajusta el plan."),
    ]
    for index, (number, title, description) in enumerate(stages):
        x = 42 + index * 129
        rr(x, H - 300, 112, 105, 15, COLORS["white"], COLORS["line"])
        rr(x + 14, H - 232, 29, 25, 9, COLORS["green"])
        text(number, x + 23, H - 224, 8, COLORS["white"], "Helvetica-Bold")
        text(title, x + 14, H - 256, 10, COLORS["ink"], "Helvetica-Bold")
        paragraph(description, x + 14, H - 273, 84, 7.5, 10, COLORS["slate"])
        if index < 3:
            text("→", x + 116, H - 249, 13, COLORS["green"], "Helvetica-Bold")
    features = [
        ("Clientes y agenda", "Expedientes, búsquedas, eventos y recordatorios."),
        ("Nutrición", "Macros, alimentos, planes, Rest Day y Peak Week."),
        ("Entrenamiento", "Rutinas por semana, volumen muscular y videos propios."),
        ("Portal del cliente", "Dieta, rutina y registro desde un acceso claro."),
        ("Reportes", "Evolución, alertas y documentos listos para compartir."),
        ("Administración", "Roles, periodos, renovaciones y bloqueo por vencimiento."),
    ]
    for index, (title, description) in enumerate(features):
        feature(42 + (index % 2) * 264, H - 438 - (index // 2) * 105, title, description, f"{index + 1:02d}")
    rr(42, 78, W - 84, 49, 14, COLORS["pale"])
    text("Una fuente de información para cada cliente, accesible desde cualquier dispositivo.", 61, 96, 9, COLORS["green"], "Helvetica-Bold")
    footer(4)
    c.showPage()

    # Pricing
    c.setFillColor(COLORS["cream"])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    page_title("PLANES DISEÑADOS PARA CRECER", "Elige el periodo que mejor encaje contigo.",
               "Todas las opciones incluyen la plataforma completa. La diferencia es el ahorro por permanencia.")

    def price_card(x, y, width, height, name, price, unit, badge, detail, featured=False):
        background = COLORS["forest"] if featured else COLORS["white"]
        rr(x, y, width, height, 18, background, COLORS["green"] if featured else COLORS["line"], 2 if featured else 1)
        if featured:
            rr(x + 25, y + height - 18, 113, 24, 12, COLORS["green"])
            text("MEJOR VALOR", x + 48, y + height - 10, 8, COLORS["white"], "Helvetica-Bold")
        top = y + height - 48
        text(name, x + 18, top, 9, COLORS["mint"] if featured else COLORS["green"], "Helvetica-Bold")
        text(price, x + 18, top - 45, 23, COLORS["white"] if featured else COLORS["ink"], "Helvetica-Bold")
        text(unit, x + 18, top - 63, 8, HexColor("#B8D6CC") if featured else COLORS["slate"])
        rr(x + 18, top - 111, width - 36, 34, 10, HexColor("#17463B") if featured else COLORS["pale"])
        text(badge, x + 30, top - 100, 9.5, COLORS["mint"] if featured else COLORS["green"], "Helvetica-Bold")
        for item_index, item in enumerate(("Acceso completo", "Clientes y planes", "Nutrición + rutinas", "Portal y reportes")):
            yy = top - 148 - item_index * 29
            text("✓", x + 20, yy, 10, COLORS["mint"] if featured else COLORS["green"], "Helvetica-Bold")
            text(item, x + 38, yy, 8.7, COLORS["white"] if featured else COLORS["ink"])
        text(detail, x + 18, y + 22, 7.8, HexColor("#B8D6CC") if featured else COLORS["slate"], "Helvetica-Bold")

    y, card_w, gap = 260, 160, 13
    price_card(42, y, card_w, 345, "MENSUAL", "$2,000", "MXN por mes", "Flexibilidad total", "$2,000 al mes")
    price_card(42 + card_w + gap, y, card_w, 345, "3 MESES", "$5,500", "MXN por periodo", "AHORRA $500", "$1,833 al mes")
    price_card(42 + (card_w + gap) * 2, y, card_w, 345, "ANUAL", "$20,000", "MXN por año", "AHORRA $4,000", "$1,667 al mes", True)
    rr(42, 112, W - 84, 90, 15, COLORS["pale"])
    text("ACTIVACIÓN SIMPLE", 60, 174, 8, COLORS["green"], "Helvetica-Bold")
    paragraph("Tú confirmas la transferencia y DietForge activa o renueva el periodo. La cuenta conserva su contraseña y se bloquea automáticamente al vencer.",
              60, 153, W - 120, 9, 13, COLORS["slate"])
    footer(5)
    c.showPage()

    # Trust and CTA
    c.setFillColor(COLORS["cream"])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    logo(42, H - 50)
    text("UNA BASE SÓLIDA PARA CRECER", 42, H - 105, 8, COLORS["green"], "Helvetica-Bold")
    text("Tu método merece", 42, H - 153, 29, COLORS["ink"], "Helvetica-Bold")
    text("una operación profesional.", 42, H - 190, 29, COLORS["ink"], "Helvetica-Bold")
    paragraph("Presenta mejor tu trabajo, entrega planes claros y conserva cada decisión organizada mientras crece tu cartera de clientes.",
              42, H - 225, 470, 11, 16, COLORS["slate"])
    trust = [
        ("Acceso por roles", "Cada usuario entra a la experiencia que le corresponde."),
        ("Datos en la nube", "Información centralizada con recuperación ante conflictos."),
        ("Control por periodo", "Renueva, suspende o bloquea el acceso desde administración."),
        ("Contenido propio", "Cada coach agrega sus videos y recursos de entrenamiento."),
    ]
    for index, (title, description) in enumerate(trust):
        x = 42 + (index % 2) * 264
        y = H - 391 - (index // 2) * 110
        rr(x, y, 246, 89, 15, COLORS["white"], COLORS["line"])
        c.setFillColor(COLORS["green"])
        c.circle(x + 24, y + 62, 5, fill=1, stroke=0)
        text(title, x + 39, y + 58, 10.5, COLORS["ink"], "Helvetica-Bold")
        paragraph(description, x + 20, y + 34, 205, 8.5, 12, COLORS["slate"])
    rr(42, 108, W - 84, 154, 20, COLORS["forest"])
    text("LISTO PARA ORDENAR TU COACHING", 64, 229, 8, COLORS["mint"], "Helvetica-Bold")
    text("Solicita tu acceso a DietForge", 64, 194, 21, COLORS["white"], "Helvetica-Bold")
    paragraph("Conoce la plataforma, elige tu periodo y comienza a trabajar con una estructura creada para coaches.",
              64, 169, 390, 9.5, 13, HexColor("#C7DFD6"))
    rr(64, 122, 221, 31, 14, COLORS["green"])
    text("diet-forge.vercel.app", 88, 133, 10, COLORS["white"], "Helvetica-Bold")
    text("Precios en MXN. Activación después de confirmar la transferencia.", 42, 61, 8, COLORS["slate"])
    footer(6)
    c.save()
    return OUT


if __name__ == "__main__":
    print(generate())
