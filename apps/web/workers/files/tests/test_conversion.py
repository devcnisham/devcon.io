import io
import zipfile
from pathlib import Path

import pytest
from docx import Document
from openpyxl import Workbook, load_workbook
from pptx import Presentation
from pypdf import PdfWriter

from conversion import ConversionError, import_file, export_file, validate_upload, validate_formula


def packed(items):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as archive:
        for name, value in items.items():
            archive.writestr(name, value)
    return out.getvalue()


def test_docx_roundtrip_preserves_heading_bold_and_table(tmp_path):
    doc = Document()
    doc.add_heading('Release plan', level=1)
    p = doc.add_paragraph()
    p.add_run('Ship safely').bold = True
    doc.add_table(rows=1, cols=2).cell(0, 0).text = 'Owner'
    raw = io.BytesIO()
    doc.save(raw)
    content, warnings = import_file(raw.getvalue(), 'plan.docx')
    nodes = content['doc']['content']
    assert nodes[0]['type'] == 'heading'
    assert nodes[0]['attrs']['level'] == 1
    assert nodes[1]['content'][0]['marks'] == [{'type': 'bold'}]
    assert nodes[2]['type'] == 'table'
    result = export_file(content, 'docx', tmp_path)
    exported = Document(result)
    assert exported.paragraphs[0].text == 'Release plan'
    assert exported.paragraphs[1].runs[0].bold
    assert exported.tables[0].cell(0, 0).text == 'Owner'


def test_pptx_import_extracts_slide_title_body(tmp_path):
    deck = Presentation()
    slide = deck.slides.add_slide(deck.slide_layouts[1])
    slide.shapes.title.text = 'Demo day'
    slide.placeholders[1].text = 'A working prototype'
    data = io.BytesIO()
    deck.save(data)
    content, warnings = import_file(data.getvalue(), 'demo.pptx')
    assert content['kind'] == 'presentation'
    assert content['slides'][0]['title'] == 'Demo day'
    assert 'working prototype' in content['slides'][0]['body']
    assert warnings


def test_xlsx_import_values_formulas_and_formatting():
    workbook = Workbook()
    ws = workbook.active
    ws['A1'] = 'Budget'
    from openpyxl.styles import Font
    ws['A1'].font = Font(bold=True)
    ws['B1'] = '=SUM(A2:A3)'
    ws['A2'] = 12
    data = io.BytesIO()
    workbook.save(data)
    content, _ = import_file(data.getvalue(), 'budget.xlsx')
    assert content['sheets'][0]['rows'][0][0] == {'value': 'Budget', 'bold': True, 'format': 'text'}
    assert content['sheets'][0]['rows'][0][1]['value'] == '=SUM(A2:A3)'


def test_csv_import_and_export_neutralizes_spreadsheet_injection(tmp_path):
    content, _ = import_file(b'Name,Value\nAlice,12\n', 'budget.csv')
    assert content['sheets'][0]['rows'][1][0]['value'] == 'Alice'
    content['sheets'][0]['rows'].append([{'value': '=WEBSERVICE("https://bad")'}, {'value': '+cmd'}])
    output = export_file(content, 'csv', tmp_path).read_text()
    assert "'=WEBSERVICE" in output
    assert "'+cmd" in output


def test_formula_allowlist_rejects_network_dynamic_and_external_formulas():
    assert validate_formula('=SUM(A1:B9)+AVERAGE(A1,A2)')
    assert validate_formula('=A1*2+3')
    assert not validate_formula('=WEBSERVICE("https://bad")')
    assert not validate_formula("='[other.xlsx]Sheet1'!A1")
    assert not validate_formula('=INDIRECT(A1)')


def test_unsupported_formula_is_imported_as_literal_with_warning():
    book = Workbook()
    book.active['A1'] = '=WEBSERVICE("https://example.com")'
    data = io.BytesIO()
    book.save(data)
    content, warnings = import_file(data.getvalue(), 'book.xlsx')
    assert content['sheets'][0]['rows'][0][0]['value'].startswith("'=")
    assert any('formula' in message.lower() for message in warnings)


def test_rejects_disguised_file_and_zip_paths():
    with pytest.raises(ConversionError, match='signature'):
        validate_upload(b'not-a-docx', 'unsafe.docx')
    with pytest.raises(ConversionError, match='unsafe'):
        validate_upload(packed({'../secret': 'x', '[Content_Types].xml': '<Types/>'}), 'unsafe.docx')


def test_rejects_macro_and_external_relationships():
    with pytest.raises(ConversionError, match='macro'):
        validate_upload(packed({'word/vbaProject.bin': 'x', '[Content_Types].xml': '<Types/>'}), 'macro.docx')
    rel = '<Relationships><Relationship TargetMode="External" Target="http://bad" Type="image"/></Relationships>'
    with pytest.raises(ConversionError, match='external'):
        validate_upload(packed({'word/_rels/document.xml.rels': rel, '[Content_Types].xml': '<Types/>'}), 'external.docx')


def test_rejects_oversized_and_excessive_expansion():
    with pytest.raises(ConversionError, match='20 MB'):
        validate_upload(b'x' * (20 * 1024 * 1024 + 1), 'large.csv')
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<Types/>')
        z.writestr('word/document.xml', 'x' * 2_000_000)
    with pytest.raises(ConversionError, match='expansion'):
        validate_upload(out.getvalue(), 'bomb.docx')


def test_scanned_and_encrypted_pdf_fail_actionably():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    data = io.BytesIO()
    writer.write(data)
    with pytest.raises(ConversionError, match='OCR'):
        import_file(data.getvalue(), 'scan.pdf')
    writer.encrypt('secret')
    encrypted = io.BytesIO()
    writer.write(encrypted)
    with pytest.raises(ConversionError, match='unlocked'):
        import_file(encrypted.getvalue(), 'locked.pdf')


def test_document_markdown_lists_and_marks(tmp_path):
    content = {'kind': 'document', 'doc': {'type': 'doc', 'content': [
        {'type': 'heading', 'attrs': {'level': 2}, 'content': [{'type': 'text', 'text': 'Plan'}]},
        {'type': 'bulletList', 'content': [{'type': 'listItem', 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'Ship'}]}]}]},
    ]}}
    text = export_file(content, 'md', tmp_path).read_text()
    assert '## Plan' in text
    assert '- Ship' in text


def test_image_import_uses_private_asset_callback():
    from PIL import Image
    picture = io.BytesIO()
    Image.new('RGB', (8, 8), color='blue').save(picture, format='PNG')
    doc = Document()
    doc.add_picture(io.BytesIO(picture.getvalue()))
    raw = io.BytesIO()
    doc.save(raw)
    stored = []
    def store(data, extension):
        stored.append((data, extension))
        return '/api/projects/p/files/f/assets/image.png'
    content, _ = import_file(raw.getvalue(), 'image.docx', store)
    assert len(stored) == 1
    image = content['doc']['content'][0]['content'][0]
    assert image['attrs']['src'].endswith('/assets/image.png')


def test_pptx_export_opens_in_independent_reader(tmp_path):
    content = {'kind': 'presentation', 'theme': 'midnight', 'slides': [
        {'id': 'one', 'title': 'Release overview', 'body': 'Ship a reliable prototype', 'layout': 'content'},
        {'id': 'two', 'title': 'Next steps', 'body': 'Validate with users', 'layout': 'title'},
    ]}
    result = export_file(content, 'pptx', tmp_path)
    deck = Presentation(result)
    assert len(deck.slides) == 2
    assert any('Release overview' in shape.text for shape in deck.slides[0].shapes if shape.has_text_frame)


def test_xlsx_export_opens_with_formulas_and_styles(tmp_path):
    content = {'kind': 'spreadsheet', 'sheets': [{'id': 'one', 'name': 'Budget', 'rows': [
        [{'value': 'Budget', 'bold': True}, {'value': '12', 'format': 'currency'}],
        [{'value': '=SUM(B1:B1)'}, {'value': '=WEBSERVICE("https://bad")'}],
    ]}]}
    result = export_file(content, 'xlsx', tmp_path)
    book = load_workbook(result, data_only=False)
    assert book.active['A1'].value == 'Budget'
    assert book.active['A1'].font.bold
    assert book.active['B1'].value == 12
    assert book.active['B1'].number_format == '$#,##0.00'
    assert book.active['A2'].value == '=SUM(B1:B1)'
    assert book.active['B2'].data_type == 's'
    book.close()


def test_text_pdf_extracts_content_and_conversion_warning():
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(b'BT /F1 12 Tf 20 250 Td (Project release plan) Tj ET')
    page[NameObject('/Contents')] = writer._add_object(stream)
    data = io.BytesIO()
    writer.write(data)
    content, warnings = import_file(data.getvalue(), 'plan.pdf')
    assert content['doc']['content'][0]['content'][0]['text'] == 'Project release plan'
    assert 'original PDF' in warnings[0]


def test_unsafe_xml_entity_is_rejected():
    malicious = '<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><x>&secret;</x>'
    with pytest.raises(ConversionError, match='unsafe or invalid XML'):
        validate_upload(packed({'[Content_Types].xml': '<Types/>', 'word/document.xml': malicious}), 'entity.docx')


def test_inline_image_export_loader_normalizes_without_network():
    import base64
    from PIL import Image
    from worker import _asset_callbacks
    raw = io.BytesIO()
    Image.new('RGB', (5, 5), color='red').save(raw, 'JPEG')
    _store, load = _asset_callbacks(None, {'project_id': 'p', 'file_id': 'f'})
    normalized = load('data:image/jpeg;base64,' + base64.b64encode(raw.getvalue()).decode('ascii'))
    assert normalized.startswith(b'\x89PNG\r\n\x1a\n')
    with pytest.raises(ConversionError, match='remote image'):
        load('https://example.com/private.jpg')


def test_import_editing_limits_are_enforced():
    from conversion import validate_import_content
    with pytest.raises(ConversionError, match='10,000 character'):
        validate_import_content({'kind': 'spreadsheet', 'sheets': [{'rows': [[{'value': 'x' * 10_001}]]}]})


def test_missing_libreoffice_reports_actionable_pdf_failure(tmp_path, monkeypatch):
    import conversion
    monkeypatch.setattr(conversion.shutil, 'which', lambda _: None)
    with pytest.raises(ConversionError, match='LibreOffice conversion worker'):
        export_file({'kind': 'document', 'doc': {'type': 'doc', 'content': []}}, 'pdf', tmp_path)


def test_pdf_embedded_script_is_rejected_before_extraction():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    from pypdf.actions import JavaScript
    writer.add_open_action(JavaScript('app.alert("unsafe")'))
    raw = io.BytesIO()
    writer.write(raw)
    with pytest.raises(ConversionError, match='embedded scripts'):
        import_file(raw.getvalue(), 'script.pdf')


def test_process_timeout_terminates_renderer_group(tmp_path):
    import subprocess
    import sys
    import time
    from conversion import _run_process
    finished = tmp_path / 'leaked-child'
    script = 'import subprocess,time; subprocess.Popen(["' + sys.executable + '","-c", "import time,pathlib; time.sleep(.4); pathlib.Path(' + repr(str(finished)) + ').write_text(\'bad\')"]); time.sleep(5)'
    with pytest.raises(subprocess.TimeoutExpired):
        _run_process([sys.executable, '-c', script], timeout=.1)
    time.sleep(.5)
    assert not finished.exists()


def test_csv_keeps_negative_numbers_numeric(tmp_path):
    content = {'kind': 'spreadsheet', 'sheets': [{'id': 'one', 'name': 'Data', 'rows': [[{'value': '-12.5'}, {'value': '+4'}, {'value': '-cmd'}]]}]}
    path = export_file(content, 'csv', tmp_path)
    assert path.read_text().strip() == "-12.5,+4,'-cmd"


def test_slide_image_position_roundtrip_uses_percent_coordinates(tmp_path):
    from PIL import Image
    from pptx.util import Inches
    blob = io.BytesIO()
    Image.new('RGB', (10, 10), color='blue').save(blob, 'PNG')
    raw_image = blob.getvalue()
    original = Presentation()
    original.slide_width = Inches(13.333)
    original.slide_height = Inches(7.5)
    slide = original.slides.add_slide(original.slide_layouts[6])
    slide.shapes.add_picture(io.BytesIO(raw_image), Inches(5), Inches(2), width=Inches(3))
    raw = io.BytesIO()
    original.save(raw)
    content, _ = import_file(raw.getvalue(), 'image.pptx', lambda _data, _ext: '/api/projects/p/files/f/assets/image.png')
    assert content['slides'][0]['x'] == pytest.approx(37.5, abs=.01)
    assert content['slides'][0]['y'] == pytest.approx(26.67, abs=.01)
    rendered = Presentation(export_file(content, 'pptx', tmp_path, lambda _url: raw_image))
    image = next(shape for shape in rendered.slides[0].shapes if shape.shape_type == 13)
    assert image.left / Inches(1) == pytest.approx(5, abs=.01)
    assert image.top / Inches(1) == pytest.approx(2, abs=.01)


def test_absolute_references_and_exponents_export_as_formulas(tmp_path):
    assert validate_formula('=$A$1^2+SUM($B$1:B3)')
    content = {'kind': 'spreadsheet', 'sheets': [{'id': 'one', 'name': 'Numbers', 'rows': [[{'value': '3', 'format': 'number'}, {'value': '=$A$1^2'}]]}]}
    book = load_workbook(export_file(content, 'xlsx', tmp_path), data_only=False)
    assert book.active['B1'].data_type == 'f'
    assert book.active['B1'].value == '=$A$1^2'
    book.close()
