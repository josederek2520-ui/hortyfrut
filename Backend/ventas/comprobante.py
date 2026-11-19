import base64
from datetime import date
from decimal import Decimal
from html import escape
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Image, KeepTogether
from .importe_letras import importe_en_letras

TEXTOS = {
    'es': {'titulo': 'COMPROBANTE DE VENTA', 'sin_fiscal': 'SIN VALOR FISCAL', 'numero': 'Documento N.º',
        'fecha': 'Fecha de emisión', 'cliente': 'Nombre / Razón social', 'nit': 'NIT / CI', 'codigo': 'Código',
        'cantidad': 'Cantidad', 'unidad': 'Unidad', 'descripcion': 'Descripción', 'precio': 'Precio unitario (Bs)',
        'subtotal': 'Importe (Bs)', 'total': 'TOTAL Bs', 'literal': 'Son', 'pagina': 'Página', 'telefono': 'Teléfono',
        'nota': 'Documento comercial. El total corresponde a los kilos aceptados y los precios acordados al emitir. Los pagos se registran por separado en Cobros.',
        'responsable': 'Emitido por'},
    'en': {'titulo': 'SALES RECEIPT', 'sin_fiscal': 'NOT A TAX INVOICE', 'numero': 'Document No.',
        'fecha': 'Issue date', 'cliente': 'Customer / Legal name', 'nit': 'Tax ID / ID', 'codigo': 'Code',
        'cantidad': 'Quantity', 'unidad': 'Unit', 'descripcion': 'Description', 'precio': 'Unit price (Bs)',
        'subtotal': 'Amount (Bs)', 'total': 'TOTAL Bs', 'literal': 'In words', 'pagina': 'Page', 'telefono': 'Phone',
        'nota': 'Commercial document. Amounts use accepted weights and agreed prices at issue. Payments are recorded separately in Collections.',
        'responsable': 'Issued by'},
}


def generar_comprobante_pdf(venta, lineas, idioma='es'):
    t, empresa = TEXTOS[idioma], venta['empresa']
    salida = BytesIO()
    ancho = A4[0] - 80
    tinta, gris = colors.HexColor('#202826'), colors.HexColor('#5C6D63')
    texto = ParagraphStyle('textoComercial', fontName='HortyTexto', fontSize=8.5, leading=12, textColor=tinta)
    pequeno = ParagraphStyle('pequenoComercial', parent=texto, fontSize=7, leading=10, textColor=gris)
    negrita = ParagraphStyle('negritaComercial', parent=texto, fontName='HortyNegrita')
    numero = ParagraphStyle('numeroComercial', parent=texto, alignment=TA_RIGHT)
    centro = ParagraphStyle('centroComercial', parent=negrita, alignment=TA_CENTER)
    def parrafo(valor, estilo=texto):
        return Paragraph(escape(str(valor)), estilo)
    def monto(valor):
        texto_monto = format(Decimal(valor), ',.2f')
        return texto_monto.translate(str.maketrans(',.', '.,')) if idioma == 'es' else texto_monto
    def fecha(valor):
        return date.fromisoformat(str(valor)[:10]).strftime('%d/%m/%Y')
    def pie(lienzo, documento):
        lienzo.saveState()
        lienzo.setFillColor(gris)
        lienzo.setFont('HortyTexto', 7)
        lienzo.drawString(40, 30, venta['codigo'] + ' | ' + t['sin_fiscal'])
        lienzo.drawRightString(A4[0] - 40, 30, f"{t['pagina']} {documento.page}")
        lienzo.restoreState()
    documento = SimpleDocTemplate(salida, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=35, bottomMargin=55,
        title=t['titulo'] + ' ' + venta['codigo'], author=empresa['razon_social'])
    datos_empresa = []
    if empresa.get('logo_base64'):
        contenido = BytesIO(base64.b64decode(empresa['logo_base64'].split(',', 1)[1]))
        logo = Image(contenido)
        escala = min(140 / logo.imageWidth, 48 / logo.imageHeight)
        logo.drawWidth, logo.drawHeight = logo.imageWidth * escala, logo.imageHeight * escala
        logo.hAlign = 'LEFT'
        datos_empresa.extend([logo, Spacer(1, 7)])
    datos_empresa += [parrafo(empresa['razon_social'], negrita), parrafo(empresa['direccion']),
        parrafo(t['telefono'] + ': ' + empresa['telefono']), parrafo(empresa['ciudad'])]
    datos_documento = [parrafo('NIT: ' + empresa['nit'], negrita), parrafo(t['numero'], pequeno),
        parrafo(venta['codigo'], negrita), Spacer(1, 8), parrafo(t['fecha'] + ': ' + fecha(venta['fecha_emision']))]
    cabecera = Table([[datos_empresa, datos_documento]], colWidths=[ancho * .6, ancho * .4])
    cabecera.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 10)]))
    elementos = [cabecera, Spacer(1, 18), parrafo(t['titulo'], ParagraphStyle('tituloComercial', parent=centro, fontSize=17, leading=23)),
        parrafo(t['sin_fiscal'], centro), Spacer(1, 18)]
    cliente = Table([[parrafo(t['cliente'], negrita), parrafo(venta['cliente_nombre'])],
        [parrafo(t['nit'], negrita), parrafo(venta['cliente_nit'])]], colWidths=[ancho * .3, ancho * .7])
    cliente.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    elementos += [cliente, Spacer(1, 12)]
    filas = [[parrafo(t[k], centro) for k in ('codigo', 'cantidad', 'unidad', 'descripcion', 'precio', 'subtotal')]]
    for fila in lineas:
        peso = format(Decimal(fila['peso_aceptado_kg']), 'f').rstrip('0').rstrip('.') if '.' in str(fila['peso_aceptado_kg']) else str(fila['peso_aceptado_kg'])
        if idioma == 'es':
            peso = peso.replace('.', ',')
        filas.append([parrafo('PRO-' + str(fila['producto']), pequeno), parrafo(peso, numero), parrafo('kg', centro),
            [parrafo(fila['producto_nombre']), parrafo(fila['sucursal_nombre'] + ' | ' + fila['codigo_entrega'], pequeno)],
            parrafo(monto(fila['precio_kg']), numero), parrafo(monto(fila['importe']), numero)])
    tabla = Table(filas, colWidths=[ancho * .09, ancho * .12, ancho * .10, ancho * .32, ancho * .18, ancho * .19], repeatRows=1)
    tabla.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), .5, colors.HexColor('#6B7470')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F2F5F3')), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9)]))
    elementos.append(tabla)
    total = Table([[parrafo(t['literal'] + ': ' + importe_en_letras(venta['total'], idioma)),
        parrafo(t['total'], negrita), parrafo(monto(venta['total']), ParagraphStyle('totalComercial', parent=numero, fontName='HortyNegrita', fontSize=11, leading=16))]],
        colWidths=[ancho * .57, ancho * .18, ancho * .25])
    total.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (1, 0), (-1, -1), .8, tinta),
        ('TOPPADDING', (0, 0), (-1, -1), 12), ('BOTTOMPADDING', (0, 0), (-1, -1), 12), ('LEFTPADDING', (0, 0), (0, 0), 0)]))
    elementos.append(KeepTogether([total, Spacer(1, 12), parrafo(t['nota'], pequeno), Spacer(1, 8),
        parrafo(t['responsable'] + ': ' + venta['emitido_por_nombre'], pequeno)]))
    documento.build(elementos, onFirstPage=pie, onLaterPages=pie)
    return salida.getvalue()
