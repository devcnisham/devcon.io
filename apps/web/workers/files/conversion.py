"""Bounded, non-executing Office import and deterministic revision exports."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import uuid
import zipfile
from typing import Callable

from defusedxml import ElementTree
from docx import Document
from docx.oxml.ns import qn
from docx.shared import Inches
from openpyxl import load_workbook
from openpyxl.styles import Font
from PIL import Image
from pptx import Presentation
from pypdf import PdfReader

MAX_UPLOAD = 20 * 1024 * 1024
MAX_EXPANDED = 100 * 1024 * 1024
MAX_CELLS = 100_000
MAX_ROWS = 2_000
MAX_COLUMNS = 100
MAX_SLIDES = 100
MAX_PAGES = 500
Image.MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_EXTENSIONS = {'.docx', '.pptx', '.xlsx', '.csv', '.pdf'}
SUPPORTED_FUNCTIONS = {'SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT'}


class ConversionError(ValueError):
    """A safe, user-facing conversion failure; never includes document contents."""


def validate_formula(value: str) -> bool:
    if not value.startswith('=') or len(value) > 2000:
        return False
    expr = value[1:].upper()
    if not re.fullmatch(r'[A-Z0-9$+\-*/^().,:\s]+', expr):
        return False
    functions = re.findall(r'([A-Z]+)\s*\(', expr)
    if any(name not in SUPPORTED_FUNCTIONS for name in functions):
        return False
    stripped = re.sub(r'(?:SUM|AVERAGE|MIN|MAX|COUNT)\s*\(', '(', expr)
    stripped = re.sub(r'\$?[A-Z]{1,3}\$?[1-9][0-9]*\b', '1', stripped)
    return not re.search(r'[A-Z]', stripped)


def validate_upload(data: bytes, filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ConversionError('Upload a DOCX, PPTX, XLSX, CSV, or PDF file.')
    if not data:
        raise ConversionError('The uploaded file is empty.')
    if len(data) > MAX_UPLOAD:
        raise ConversionError('Files must be 20 MB or smaller.')
    if extension == '.pdf':
        if not data.startswith(b'%PDF-'):
            raise ConversionError('The PDF file signature does not match its extension.')
    elif extension == '.csv':
        if b'\x00' in data or data.startswith((b'PK\x03\x04', b'%PDF-', b'\xd0\xcf\x11\xe0')):
            raise ConversionError('The CSV file signature is invalid; use UTF-8 text.')
        try:
            data.decode('utf-8-sig')
        except UnicodeDecodeError as exc:
            raise ConversionError('Save this CSV as UTF-8 text and upload it again.') from exc
    else:
        if not data.startswith(b'PK\x03\x04'):
            raise ConversionError('The Office file signature does not match its extension.')
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                members = archive.infolist()
                if len(members) > 10_000 or sum(item.file_size for item in members) > MAX_EXPANDED:
                    raise ConversionError('The archive expansion exceeds the import limit.')
                for item in members:
                    path = PurePosixPath(item.filename)
                    if path.is_absolute() or '..' in path.parts or '\\' in item.filename or item.flag_bits & 1:
                        raise ConversionError('The archive contains an unsafe path or encrypted entry.')
                    if item.file_size > 1_000_000 and item.file_size > max(1, item.compress_size) * 500:
                        raise ConversionError('The archive expansion ratio exceeds the import limit.')
                    lowered = item.filename.lower()
                    if any(part in lowered for part in ('vbaproject', 'activex/', 'embeddings/', 'scripts/')):
                        raise ConversionError('Remove macros and embedded executable objects before importing.')
                    if lowered.endswith(('.xml', '.rels')):
                        xml = archive.read(item)
                        try:
                            root = ElementTree.fromstring(xml)
                        except Exception as exc:
                            raise ConversionError('The Office file contains unsafe or invalid XML.') from exc
                        for element in root.iter():
                            if element.attrib.get('TargetMode', '').lower() == 'external':
                                raise ConversionError('Remove external document links and linked media before importing.')
                expected = {'.docx': 'word/document.xml', '.pptx': 'ppt/presentation.xml', '.xlsx': 'xl/workbook.xml'}[extension]
                names = archive.namelist()
                if '[Content_Types].xml' not in names or expected not in names:
                    raise ConversionError('The Office file signature does not match its extension.')
        except zipfile.BadZipFile as exc:
            raise ConversionError('The Office archive is damaged.') from exc
    return extension


def _text(text: str, marks: list | None = None) -> dict:
    result = {'type': 'text', 'text': text}
    if marks:
        result['marks'] = marks
    return result


def _paragraph(text: str) -> dict:
    return {'type': 'paragraph', 'content': [_text(text)] if text else []}


def _image(blob: bytes, store_image: Callable | None) -> str | None:
    if not store_image:
        return None
    try:
        with Image.open(io.BytesIO(blob)) as picture:
            picture.load()
            if picture.width * picture.height > 40_000_000:
                raise ConversionError('An embedded image exceeds the size limit.')
            # Re-encode to strip metadata and discard active/polyglot payloads.
            output = io.BytesIO()
            picture.convert('RGBA').save(output, 'PNG')
            if len(output.getvalue()) > 10 * 1024 * 1024:
                raise ConversionError('An embedded image exceeds the size limit.')
            return store_image(output.getvalue(), 'png')
    except ConversionError:
        raise
    except Exception as exc:
        raise ConversionError('An embedded image could not be decoded safely.') from exc


def _docx_paragraph(paragraph, document, store_image) -> dict:
    nodes = []
    for run in paragraph.runs:
        marks = []
        for attr, name in [('bold', 'bold'), ('italic', 'italic'), ('underline', 'underline')]:
            if getattr(run, attr):
                marks.append({'type': name})
        if run.text:
            nodes.append(_text(run.text, marks))
        for blip in run._element.findall('.//' + qn('a:blip')):
            rel_id = blip.get(qn('r:embed'))
            if rel_id and rel_id in document.part.related_parts:
                url = _image(document.part.related_parts[rel_id].blob, store_image)
                if url:
                    nodes.append({'type': 'image', 'attrs': {'src': url, 'alt': 'Imported image'}})
    # Hyperlinks were rejected if external, but internal anchors still contain text.
    if not nodes and paragraph.text:
        nodes = [_text(paragraph.text)]
    style = paragraph.style.name if paragraph.style else ''
    node = {'type': 'paragraph', 'content': nodes}
    heading = re.match(r'Heading ([1-6])', style)
    if heading:
        node.update(type='heading', attrs={'level': int(heading.group(1))})
    if style.startswith(('List Bullet', 'List Number')) or paragraph._p.find('.//' + qn('w:numPr')) is not None:
        return {'type': 'orderedList' if style.startswith('List Number') else 'bulletList', 'content': [{'type': 'listItem', 'content': [node]}]}
    return node


def _import_docx(data: bytes, store_image) -> tuple[dict, list[str]]:
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    document = Document(io.BytesIO(data))
    nodes = []
    for child in document.element.body.iterchildren():
        if child.tag == qn('w:p'):
            nodes.append(_docx_paragraph(Paragraph(child, document), document, store_image))
        elif child.tag == qn('w:tbl'):
            table = Table(child, document)
            if sum(len(row.cells) for row in table.rows) > MAX_CELLS:
                raise ConversionError('The document table exceeds the import limit.')
            nodes.append({'type': 'table', 'content': [{'type': 'tableRow', 'content': [
                {'type': 'tableCell', 'attrs': {'colspan': 1, 'rowspan': 1}, 'content': [
                    _docx_paragraph(p, document, store_image) for p in cell.paragraphs
                ] or [_paragraph('')]} for cell in row.cells
            ]} for row in table.rows]})
    return {'kind': 'document', 'doc': {'type': 'doc', 'content': nodes or [_paragraph('')]}}, [
        'Page layout, headers, footers, comments, and advanced styling may change during conversion.'
    ]


def _import_pptx(data: bytes, store_image) -> tuple[dict, list[str]]:
    deck = Presentation(io.BytesIO(data))
    if len(deck.slides) > MAX_SLIDES:
        raise ConversionError('Presentations must contain 100 slides or fewer.')
    slides = []
    for slide in deck.slides:
        title_shape = slide.shapes.title
        title = title_shape.text if title_shape is not None else ''
        texts = []
        image_url, image_x, image_y = None, None, None
        for shape in slide.shapes:
            if shape.has_text_frame and shape != title_shape and shape.text:
                texts.append(shape.text)
            if shape.has_table:
                texts.append('\n'.join(' | '.join(c.text for c in row.cells) for row in shape.table.rows))
            if shape.shape_type == 13 and image_url is None:
                image_url = _image(shape.image.blob, store_image)
                image_x = max(0, min(66, shape.left / deck.slide_width * 100))
                image_y = max(0, min(60, shape.top / deck.slide_height * 100))
        item = {'id': str(uuid.uuid4()), 'title': title, 'body': '\n'.join(texts), 'layout': 'split' if image_url else 'content'}
        if image_url:
            item.update(image=image_url, x=image_x, y=image_y)
        slides.append(item)
    return {'kind': 'presentation', 'theme': 'paper', 'slides': slides or [{'id': str(uuid.uuid4()), 'title': '', 'body': '', 'layout': 'title'}]}, [
        'Slides use editable layout presets. Fonts, animations, charts, and complex shapes may change; the first image on each slide is preserved.'
    ]


def _safe_cell(value, warnings: list[str]) -> str:
    text = '' if value is None else str(value)
    if text.startswith('=') and not validate_formula(text):
        warnings.append('Unsupported or external spreadsheet formulas were imported as literal text.')
        return "'" + text
    return text


def _import_xlsx(data: bytes) -> tuple[dict, list[str]]:
    workbook = load_workbook(io.BytesIO(data), data_only=False, keep_links=False)
    sheets, warnings, cell_count = [], [], 0
    try:
        if len(workbook.worksheets) > 20:
            raise ConversionError('Workbooks must contain 20 sheets or fewer.')
        for ws in workbook.worksheets:
            if ws.max_row > MAX_ROWS or ws.max_column > MAX_COLUMNS:
                raise ConversionError('Sheets must contain at most 2,000 rows and 100 columns.')
            rows = []
            for row in ws.iter_rows():
                cells = []
                for cell in row:
                    cell_count += 1
                    if cell_count > MAX_CELLS:
                        raise ConversionError('The workbook exceeds 100,000 cells.')
                    fmt = 'text'
                    if '%' in cell.number_format:
                        fmt = 'percent'
                    elif '$' in cell.number_format or '€' in cell.number_format or '£' in cell.number_format:
                        fmt = 'currency'
                    elif cell.data_type == 'n' and cell.value is not None:
                        fmt = 'number'
                    item = {'value': _safe_cell(cell.value, warnings), 'format': fmt}
                    if cell.font.bold:
                        item['bold'] = True
                    cells.append(item)
                rows.append(cells)
            sheets.append({'id': str(uuid.uuid4()), 'name': ws.title, 'rows': rows or [[{'value': ''}]]})
    finally:
        workbook.close()
    warnings.append('Charts, pivot tables, merged cells, macros, and unsupported formulas are not editable in this workspace.')
    return {'kind': 'spreadsheet', 'sheets': sheets}, list(dict.fromkeys(warnings))


def _import_csv(data: bytes) -> tuple[dict, list[str]]:
    text = data.decode('utf-8-sig')
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=',;\t')
    except csv.Error:
        dialect = csv.excel
    rows, warnings = [], []
    count = 0
    for row in csv.reader(io.StringIO(text, newline=''), dialect):
        count += len(row)
        if len(row) > MAX_COLUMNS or len(rows) >= MAX_ROWS or count > MAX_CELLS:
            raise ConversionError('The CSV exceeds the 2,000 row, 100 column, or 100,000 cell import limit.')
        rows.append([{'value': _safe_cell(value, warnings)} for value in row])
    return {'kind': 'spreadsheet', 'sheets': [{'id': str(uuid.uuid4()), 'name': 'Sheet 1', 'rows': rows or [[{'value': ''}]]}]}, list(dict.fromkeys(warnings))


def _import_pdf(data: bytes) -> tuple[dict, list[str]]:
    reader = PdfReader(io.BytesIO(data), strict=False)
    if reader.is_encrypted:
        raise ConversionError('This PDF is encrypted. Upload an unlocked copy to revise its content.')
    if len(reader.pages) > MAX_PAGES:
        raise ConversionError('PDFs must contain 500 pages or fewer.')
    root = reader.trailer['/Root']
    names = root.get('/Names', {})
    if hasattr(names, 'get_object'):
        names = names.get_object()
    if names.get('/JavaScript') or names.get('/EmbeddedFiles'):
        raise ConversionError('Remove embedded scripts and file attachments before importing this PDF.')
    def check_actions(owner):
        for key in ('/OpenAction', '/A'):
            action = owner.get(key)
            if hasattr(action, 'get_object'):
                action = action.get_object()
            if hasattr(action, 'get') and action.get('/S') in ('/JavaScript', '/Launch', '/SubmitForm', '/ImportData'):
                raise ConversionError('Remove embedded scripts and active actions before importing this PDF.')
        if owner.get('/AA'):
            raise ConversionError('Remove automatic actions before importing this PDF.')
    check_actions(root)
    for page in reader.pages:
        check_actions(page)
        for annotation in page.get('/Annots', []):
            check_actions(annotation.get_object())
    texts = [page.extract_text() or '' for page in reader.pages]
    if not any(text.strip() for text in texts):
        raise ConversionError('This PDF has no extractable text. Run OCR on the scanned pages and upload it again.')
    paragraphs = [_paragraph(line) for text in texts for line in text.splitlines() if line.strip()]
    return {'kind': 'document', 'doc': {'type': 'doc', 'content': paragraphs}}, [
        'PDF text was extracted into an editable document. Page layout, tables, images, and text order may change; the original PDF remains available.'
    ]


def validate_import_content(content: dict):
    if len(json.dumps(content, ensure_ascii=False).encode('utf-8')) > 8_000_000:
        raise ConversionError('The converted file exceeds the 8 MB editing limit.')
    if content['kind'] == 'document':
        count = 0
        def visit(node, depth=0):
            nonlocal count
            count += 1
            if count > 20_000 or depth > 24:
                raise ConversionError('The converted document is too complex to edit. Split it into smaller documents.')
            if len(node.get('text', '')) > 200_000:
                raise ConversionError('A paragraph exceeds the editing limit. Split it into smaller paragraphs.')
            for child in node.get('content', []):
                visit(child, depth + 1)
        visit(content['doc'])
    elif content['kind'] == 'presentation':
        if any(len(slide['title']) > 1000 or len(slide['body']) > 20_000 for slide in content['slides']):
            raise ConversionError('A slide contains too much text to edit. Split its text across slides.')
    elif content['kind'] == 'spreadsheet':
        if any(len(cell['value']) > 10_000 for sheet in content['sheets'] for row in sheet['rows'] for cell in row):
            raise ConversionError('A spreadsheet cell exceeds the 10,000 character editing limit.')


def import_file(data: bytes, filename: str, store_image: Callable | None = None) -> tuple[dict, list[str]]:
    extension = validate_upload(data, filename)
    try:
        if extension == '.docx':
            result = _import_docx(data, store_image)
        elif extension == '.pptx':
            result = _import_pptx(data, store_image)
        elif extension == '.xlsx':
            result = _import_xlsx(data)
        elif extension == '.csv':
            result = _import_csv(data)
        else:
            result = _import_pdf(data)
        validate_import_content(result[0])
        return result
    except ConversionError:
        raise
    except Exception as exc:
        raise ConversionError('This file could not be converted. Re-save it in its original application and try again.') from exc


def _node_text(node: dict) -> str:
    return node.get('text', '') + ''.join(_node_text(child) for child in node.get('content', []))


def _markdown(node: dict, depth=0) -> str:
    kind = node.get('type')
    if kind == 'text':
        text = node.get('text', '')
        for mark in node.get('marks', []):
            marker = {'bold': '**', 'italic': '*', 'code': '`', 'strike': '~~'}.get(mark.get('type'))
            if marker:
                text = marker + text + marker
        return text
    children = node.get('content', [])
    if kind == 'heading':
        return '#' * max(1, min(6, int(node.get('attrs', {}).get('level', 1)))) + ' ' + ''.join(_markdown(c) for c in children) + '\n\n'
    if kind in ('bulletList', 'orderedList'):
        if not children:
            return ''
        return ''.join(
            ('  ' * depth + (f'{index + 1}. ' if kind == 'orderedList' else '- ') + ''.join(_markdown(c, depth + 1) for c in item.get('content', [])).strip() + '\n') for index, item in enumerate(children)
        ) + '\n'
    if kind == 'image':
        return '[Image: ' + str(node.get('attrs', {}).get('alt', 'image')) + ']'
    if kind == 'hardBreak':
        return '\n'
    if kind == 'table':
        return '\n'.join(' | '.join(_node_text(cell) for cell in row.get('content', [])) for row in children) + '\n\n'
    return ''.join(_markdown(c, depth) for c in children) + ('\n\n' if kind == 'paragraph' else '')


def _write_docx(content: dict, target: Path, load_image: Callable | None):
    document = Document()
    def add_nodes(nodes, parent=document, list_style=None):
        for node in nodes:
            kind = node.get('type')
            if kind in ('bulletList', 'orderedList'):
                for item in node.get('content', []):
                    add_nodes(item.get('content', []), parent, 'List Number' if kind == 'orderedList' else 'List Bullet')
            elif kind in ('paragraph', 'heading', 'blockquote'):
                if kind == 'heading' and parent is document:
                    paragraph = document.add_heading(level=max(1, min(6, int(node.get('attrs', {}).get('level', 1)))))
                else:
                    if parent is document:
                        paragraph = parent.add_paragraph(style=list_style)
                    elif len(parent.paragraphs) == 1 and not parent.paragraphs[0].text:
                        paragraph = parent.paragraphs[0]
                    else:
                        paragraph = parent.add_paragraph()
                def inline(child):
                    if child.get('type') == 'image':
                        if load_image:
                            blob = load_image(child.get('attrs', {}).get('src', ''))
                            if blob:
                                paragraph.add_run().add_picture(io.BytesIO(blob), width=Inches(5))
                        return
                    if child.get('type') == 'hardBreak':
                        paragraph.add_run().add_break()
                        return
                    run = paragraph.add_run(child.get('text', ''))
                    marks = {m.get('type') for m in child.get('marks', [])}
                    run.bold = 'bold' in marks
                    run.italic = 'italic' in marks
                    run.underline = 'underline' in marks
                    run.font.strike = 'strike' in marks
                    for descendant in child.get('content', []):
                        inline(descendant)
                for child in node.get('content', []):
                    inline(child)
            elif kind == 'table':
                rows = node.get('content', [])
                columns = max((len(row.get('content', [])) for row in rows), default=0)
                if rows and columns:
                    table = parent.add_table(rows=len(rows), cols=columns)
                    if parent is document:
                        table.style = 'Table Grid'
                    for index, row in enumerate(rows):
                        for column, cell in enumerate(row.get('content', [])):
                            table.cell(index, column).text = ''
                            add_nodes(cell.get('content', []), table.cell(index, column))
            elif kind == 'image' and load_image:
                blob = load_image(node.get('attrs', {}).get('src', ''))
                if blob:
                    document.add_picture(io.BytesIO(blob), width=Inches(5))
            else:
                add_nodes(node.get('content', []), parent)
    add_nodes(content['doc'].get('content', []))
    document.save(target)


def _run_process(command, timeout, env=None):
    """Own a process group so timeouts and outer SIGALRM cannot leak renderers."""
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, env=env)
    try:
        process.communicate(timeout=timeout)
        if process.returncode:
            raise subprocess.CalledProcessError(process.returncode, command)
    except BaseException:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        raise


def _node_export(content: dict, target: Path, load_image: Callable | None):
    payload = json.loads(json.dumps(content))
    if payload['kind'] == 'presentation':
        import base64
        for slide in payload['slides']:
            if slide.get('image') and load_image:
                blob = load_image(slide['image'])
                if blob:
                    slide['_imageData'] = 'image/png;base64,' + base64.b64encode(blob).decode('ascii')
            slide.pop('image', None)
    input_path = target.with_suffix('.json')
    input_path.write_text(json.dumps(payload), encoding='utf-8')
    helper = Path(__file__).with_name('export-office.mjs')
    try:
        _run_process(['node', str(helper), str(input_path), str(target)], timeout=90)
    except (FileNotFoundError, subprocess.SubprocessError) as exc:
        raise ConversionError('The Office export service could not render this file. Retry the export.') from exc
    finally:
        input_path.unlink(missing_ok=True)
    if payload['kind'] == 'spreadsheet':
        # SheetJS CE writes values/formulas; apply the editor's supported styles with openpyxl.
        book = load_workbook(target)
        for sheet, source in zip(book.worksheets, payload['sheets']):
            for row_index, row in enumerate(source['rows'], start=1):
                for column_index, cell in enumerate(row, start=1):
                    target_cell = sheet.cell(row_index, column_index)
                    target_cell.font = Font(bold=bool(cell.get('bold')))
                    target_cell.number_format = {'number': '0.00', 'currency': '$#,##0.00', 'percent': '0.00%'}.get(cell.get('format'), 'General')
        book.save(target)
        book.close()


def _libreoffice_pdf(source: Path, target_dir: Path) -> Path:
    binary = shutil.which('libreoffice') or shutil.which('soffice')
    if not binary:
        raise ConversionError('PDF rendering requires the LibreOffice conversion worker. Start the worker and retry.')
    profile = target_dir / ('lo-profile-' + uuid.uuid4().hex)
    user = profile / 'user'
    user.mkdir(parents=True)
    (user / 'registrymodifications.xcu').write_text('''<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item><item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateDocMode" oor:op="fuse"><value>0</value></prop></item></oor:items>''', encoding='utf-8')
    try:
        # Only safe, newly generated Office documents enter LibreOffice, never uploaded binaries.
        command = [binary, '-env:UserInstallation=' + profile.as_uri(), '--headless', '--nologo', '--nodefault', '--nolockcheck', '--norestore', '--convert-to', 'pdf', '--outdir', str(target_dir), str(source)]
        if os.environ.get('FILES_NETWORK_SANDBOX') == '1':
            command = ['/usr/bin/python3', str(Path(__file__).with_name('no_network.py')), *command]
        _run_process(command, timeout=90, env={**os.environ, 'SAL_USE_VCLPLUGIN': 'svp'})
        result = source.with_suffix('.pdf')
        if not result.is_file() or not result.read_bytes().startswith(b'%PDF-'):
            raise ConversionError('PDF rendering did not produce a valid file. Retry the export.')
        return result
    except (subprocess.SubprocessError, FileNotFoundError) as exc:
        raise ConversionError('PDF rendering failed or exceeded its time limit. Retry with a smaller file.') from exc
    finally:
        shutil.rmtree(profile, ignore_errors=True)


def export_file(content: dict, format: str, directory: Path, load_image: Callable | None = None) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    kind = content.get('kind')
    allowed = {'document': {'docx', 'pdf', 'md'}, 'presentation': {'pptx', 'pdf'}, 'spreadsheet': {'xlsx', 'csv', 'pdf'}}
    if format not in allowed.get(kind, set()):
        raise ConversionError('Choose a download format supported by this file type.')
    if format == 'md':
        target = directory / 'export.md'
        target.write_text(_markdown(content['doc']), encoding='utf-8')
        return target
    if format == 'csv':
        target = directory / 'export.csv'
        with target.open('w', encoding='utf-8', newline='') as stream:
            writer = csv.writer(stream)
            for row in content['sheets'][0]['rows']:
                values = []
                for cell in row:
                    value = str(cell.get('value', ''))
                    # CSV consumers can execute even leading-space/tab formulas. Export literal values.
                    numeric = re.fullmatch(r'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?', value.strip())
                    if (value.lstrip().startswith(('=', '+', '-', '@')) and not numeric) or value.startswith(('\t', '\r', '\n')):
                        value = "'" + value
                    values.append(value)
                writer.writerow(values)
        return target
    office_format = {'document': 'docx', 'presentation': 'pptx', 'spreadsheet': 'xlsx'}[kind]
    target = directory / ('export.' + office_format)
    if kind == 'document':
        _write_docx(content, target, load_image)
    else:
        _node_export(content, target, load_image)
    return _libreoffice_pdf(target, directory) if format == 'pdf' else target
