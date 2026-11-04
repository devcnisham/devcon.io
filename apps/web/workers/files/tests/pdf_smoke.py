"""Container acceptance gate, deliberately separate from host-only unit tests."""
from pathlib import Path
import tempfile
from pypdf import PdfReader
from conversion import export_file

def main():
    samples = [
        {'kind': 'document', 'doc': {'type': 'doc', 'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': 'DevCon PDF acceptance'}]}]}},
        {'kind': 'presentation', 'theme': 'paper', 'slides': [{'id': 's1', 'title': 'DevCon PDF acceptance', 'body': 'A readable slide.', 'layout': 'title'}]},
        {'kind': 'spreadsheet', 'sheets': [{'id': 's1', 'name': 'Budget', 'rows': [[{'value': 'DevCon PDF acceptance'}], [{'value': '42'}]]}]},
    ]
    for content in samples:
        with tempfile.TemporaryDirectory(prefix='pdf-acceptance-') as directory:
            result = export_file(content, 'pdf', Path(directory), lambda _src: b'')
            assert result.read_bytes().startswith(b'%PDF-'), content['kind']
            reader = PdfReader(result)
            assert len(reader.pages) > 0, content['kind']
            text = '\n'.join(page.extract_text() or '' for page in reader.pages)
            assert 'DevCon' in text, (content['kind'], 'Missing text')
            print(content['kind'] + ': PDF rendered and independently reopened')

if __name__ == '__main__':
    main()
