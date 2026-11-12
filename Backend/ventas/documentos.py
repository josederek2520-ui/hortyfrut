"""Resumen privado desde los datos emitidos; sin recalcular precios o saldos."""
from datetime import date
from decimal import Decimal
from html import escape
from io import BytesIO
from pathlib import Path
import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

carpeta_fuentes = Path(reportlab.__file__).parent / 'fonts'
pdfmetrics.registerFont(TTFont('HortyTexto', str(carpeta_fuentes / 'Vera.ttf')))
pdfmetrics.registerFont(TTFont('HortyNegrita', str(carpeta_fuentes / 'VeraBd.ttf')))
pdfmetrics.registerFontFamily('HortyTexto', normal='HortyTexto', bold='HortyNegrita')

TEXTOS = {
    'es': {'titulo': 'Resumen de venta', 'sin_fiscal': 'SIN VALOR FISCAL', 'cliente': 'Supermercado', 'periodo': 'Recepciones incluidas',
        'emision': 'Emisión', 'vencimiento': 'Vencimiento', 'sin_vencimiento': 'Sin fecha acordada', 'producto': 'Producto / destino',
        'peso': 'Kg aceptados', 'precio': 'Bs / kg', 'importe': 'Importe (Bs)', 'total': 'TOTAL DE LA VENTA', 'emitido': 'Emitido por',
        'nota': 'Importes calculados con los kilos aceptados y los precios acordados al emitir. Este resumen no acredita un pago.',
        'pagina': 'Página', 'entregas': 'entregas', 'pedido': 'Pedido', 'recepcion': 'Recepción', 'trazabilidad': 'Detalle de origen',
        'lote': 'Lote', 'acuerdo': 'Acuerdo de precio'},
    'en': {'titulo': 'Sales summary', 'sin_fiscal': 'NOT A TAX INVOICE', 'cliente': 'Supermarket', 'periodo': 'Included receipts',
        'emision': 'Issued', 'vencimiento': 'Due date', 'sin_vencimiento': 'No agreed date', 'producto': 'Product / destination',
        'peso': 'Accepted kg', 'precio': 'Bs / kg', 'importe': 'Amount (Bs)', 'total': 'SALE TOTAL', 'emitido': 'Issued by',
        'nota': 'Amounts use accepted weights and agreed prices at issue. This summary does not confirm a payment.',
        'pagina': 'Page', 'entregas': 'deliveries', 'pedido': 'Order', 'recepcion': 'Receipt', 'trazabilidad': 'Source details',
        'lote': 'Lot', 'acuerdo': 'Price agreement'},
}


def generar_resumen_pdf(venta, lineas, idioma='es'):
    t = TEXTOS[idioma]
    salida = BytesIO()
    verde, tinta, gris = colors.HexColor('#14532D'), colors.HexColor('#22332B'), colors.HexColor('#5C6D63')
    suave, borde = colors.HexColor('#ECF5EE'), colors.HexColor('#D6E2DB')
    texto = ParagraphStyle('texto', fontName='HortyTexto', fontSize=9, leading=13, textColor=tinta, spaceAfter=0, splitLongWords=True)
    pequeno = ParagraphStyle('pequeno', parent=texto, fontSize=7.5, leading=10.5, textColor=gris)
    numero = ParagraphStyle('numero', parent=texto, alignment=TA_RIGHT)
    encabezado = ParagraphStyle('encabezado', parent=pequeno, fontName='HortyNegrita', textColor=verde)
    def parrafo(valor, estilo=texto):
        return Paragraph(escape(str(valor)), estilo)
    def fecha(valor):
        return date.fromisoformat(str(valor)[:10]).strftime('%d/%m/%Y') if valor else t['sin_vencimiento']
    def monto(valor):
        valor = format(Decimal(valor), ',.2f')
        return valor.translate(str.maketrans(',.', '.,')) if idioma == 'es' else valor
    def peso(valor):
        valor = format(Decimal(valor), 'f').rstrip('0').rstrip('.') if '.' in str(valor) else str(valor)
        return valor.replace('.', ',') if idioma == 'es' else valor
    def pie(lienzo, documento):
        lienzo.saveState()
        lienzo.setStrokeColor(borde)
        lienzo.line(42, 45, A4[0] - 42, 45)
        lienzo.setFillColor(gris)
        lienzo.setFont('HortyTexto', 7)
        lienzo.drawString(42, 31, f"HortyFru | {venta['codigo']} | {t['sin_fiscal']}")
        lienzo.drawRightString(A4[0] - 42, 31, f"{t['pagina']} {documento.page}")
        lienzo.restoreState()
    documento = SimpleDocTemplate(salida, pagesize=A4, rightMargin=42, leftMargin=42, topMargin=42, bottomMargin=62,
        title=f"{t['titulo']} {venta['codigo']}", author='HortyFru', pageCompression=1)
    ancho = A4[0] - 84
    marca = Paragraph('<font color="#14532D">HORTY</font><font color="#F97316">FRU</font>',
        ParagraphStyle('marca', parent=texto, fontName='HortyNegrita', fontSize=23, leading=28))
    cabecera = Table([[marca, Paragraph(escape(venta['codigo']), ParagraphStyle('codigo', parent=numero, fontName='HortyNegrita', fontSize=15, leading=23))]], colWidths=[ancho * .6, ancho * .4])
    cabecera.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    elementos = [cabecera, Spacer(1, 22), parrafo(t['titulo'], ParagraphStyle('titulo', parent=texto, fontName='HortyNegrita', fontSize=22, leading=28)),
        Spacer(1, 5), parrafo(t['sin_fiscal'], encabezado), Spacer(1, 21)]
    datos_cliente = [parrafo(t['cliente'], pequeno), parrafo(venta['cliente_nombre'], ParagraphStyle('cliente', parent=texto, fontName='HortyNegrita', fontSize=12, leading=17)),
        parrafo('NIT: ' + venta['cliente_nit'], pequeno)]
    datos_fechas = [parrafo(t['emision'] + ': ' + fecha(venta['fecha_emision'])), parrafo(t['vencimiento'] + ': ' + fecha(venta['vencimiento'])),
        parrafo(t['periodo'] + ': ' + fecha(venta['desde']) + ' - ' + fecha(venta['hasta']), pequeno)]
    ficha = Table([[datos_cliente, datos_fechas]], colWidths=[ancho * .52, ancho * .48])
    ficha.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), suave), ('BOX', (0, 0), (-1, -1), .5, borde),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12), ('BOTTOMPADDING', (0, 0), (-1, -1), 12)]))
    elementos.extend([ficha, Spacer(1, 20)])
    filas = [[parrafo(t[k], encabezado) for k in ['producto', 'peso', 'precio', 'importe']]]
    for fila in lineas:
        destino = f"{fila['sucursal_nombre']} | {fila['codigo_entrega']}"
        detalle = f"{fila['codigo_pedido']} | {t['recepcion']}: {fecha(fila['fecha_recepcion'])}"
        filas.append([[parrafo(fila['producto_nombre']), parrafo(destino, pequeno), parrafo(detalle, pequeno)],
            parrafo(peso(fila['peso_aceptado_kg']), numero), parrafo(monto(fila['precio_kg']), numero), parrafo(monto(fila['importe']), numero)])
    tabla = Table(filas, colWidths=[ancho * .46, ancho * .18, ancho * .16, ancho * .20], repeatRows=1, hAlign='LEFT')
    tabla.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), suave), ('LINEBELOW', (0, 0), (-1, 0), .7, borde),
        ('LINEBELOW', (0, 1), (-1, -1), .35, borde), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 10)]))
    elementos.append(tabla)
    total = Table([[parrafo(t['total'], encabezado), Paragraph('Bs ' + monto(venta['total']),
        ParagraphStyle('total', parent=numero, fontName='HortyNegrita', fontSize=19, leading=25, textColor=verde))]], colWidths=[ancho * .5, ancho * .5])
    total.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), suave), ('TOPPADDING', (0, 0), (-1, -1), 14), ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    elementos.append(KeepTogether([Spacer(1, 16), total, Spacer(1, 12), parrafo(t['nota'], pequeno), Spacer(1, 9),
        parrafo(t['emitido'] + ': ' + venta['emitido_por_nombre'], pequeno)]))
    documento.build(elementos, onFirstPage=pie, onLaterPages=pie)
    return salida.getvalue()
