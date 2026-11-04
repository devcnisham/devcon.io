"""Durable file import/export worker. No AI credentials or arbitrary URLs are accepted."""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import logging
import mimetypes
import os
from pathlib import Path
import re
import signal
import tempfile
import time
from urllib.parse import quote, urljoin, urlsplit
import uuid

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
import requests

from conversion import ConversionError, MAX_UPLOAD, export_file, import_file

LOGGER = logging.getLogger('devcon.files')
BUCKET = 'project-files'
MAX_ATTEMPTS = 3


class Storage:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({'Authorization': 'Bearer ' + key, 'apikey': key})

    def _path(self, path: str) -> str:
        if not path or path.startswith('/') or '..' in path.split('/') or '\\' in path:
            raise ConversionError('The stored file path is invalid.')
        return quote(path, safe='/')

    def download(self, path: str, limit: int = MAX_UPLOAD) -> bytes:
        response = self.session.post(self.url + '/storage/v1/object/sign/' + BUCKET + '/' + self._path(path), json={'expiresIn': 120}, timeout=30)
        response.raise_for_status()
        signed_path = response.json().get('signedURL') or response.json().get('signedUrl')
        if not isinstance(signed_path, str):
            raise ConversionError('The original file could not be opened. Retry the job.')
        download_url = urljoin(self.url + '/storage/v1/', signed_path.lstrip('/')) if not signed_path.startswith('/storage/v1/') else self.url + signed_path
        if urlsplit(download_url).netloc != urlsplit(self.url).netloc or urlsplit(download_url).scheme != urlsplit(self.url).scheme:
            raise ConversionError('The storage download address is invalid.')
        # Do not forward the service key to signed URLs or across redirects.
        with requests.get(download_url, stream=True, timeout=(10, 60), allow_redirects=False) as result:
            result.raise_for_status()
            chunks, size = [], 0
            for chunk in result.iter_content(64 * 1024):
                size += len(chunk)
                if size > limit:
                    raise ConversionError('The stored file exceeds the conversion size limit.')
                chunks.append(chunk)
            return b''.join(chunks)

    def upload(self, path: str, data: bytes, content_type: str, upsert=False):
        if len(data) > 20 * 1024 * 1024:
            raise ConversionError('The exported file exceeds the 20 MB output limit.')
        response = self.session.post(self.url + '/storage/v1/object/' + BUCKET + '/' + self._path(path), data=data, headers={'Content-Type': content_type, 'x-upsert': 'true' if upsert else 'false'}, timeout=(10, 90))
        # Content-addressed imported images and revision exports are immutable and retry-safe.
        if response.status_code == 409:
            return
        response.raise_for_status()


@contextmanager
def conversion_timeout(seconds=150):
    previous = signal.getsignal(signal.SIGALRM)
    def expired(_number, _frame):
        raise ConversionError('The conversion exceeded its time limit. Try a smaller file.')
    signal.signal(signal.SIGALRM, expired)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)


def claim_job(connection):
    with connection.transaction():
        # Reclaim crashed workers after five minutes. Three executions maximum.
        connection.execute("""UPDATE file_jobs SET status='failed',error='The conversion worker stopped repeatedly. Retry this job.',finished_at=now()
          WHERE kind IN ('import','export') AND status='running'
          AND started_at < now() - interval '5 minutes' AND attempts >= %s""", (MAX_ATTEMPTS,))
        row = connection.execute("""WITH candidate AS (
          SELECT id FROM file_jobs WHERE kind IN ('import','export') AND attempts < %s
          AND (status='queued' OR (status='running' AND started_at < now() - interval '5 minutes'))
          ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
          UPDATE file_jobs j SET status='running',progress=10,error=NULL,attempts=j.attempts+1,started_at=now(),finished_at=NULL
          FROM candidate c WHERE j.id=c.id RETURNING j.*""", (MAX_ATTEMPTS,)).fetchone()
        return row


def authorized_file(connection, job):
    row = connection.execute("""SELECT f.* FROM workspace_files f
      JOIN projects p ON p.id=f.project_id
      JOIN workspaces w ON w.id=p.workspace_id
      JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=%s
      WHERE f.id=%s AND f.project_id=%s AND f.deleted_at IS NULL
      AND p.deleted_at IS NULL AND w.deleted_at IS NULL AND m.role IN ('owner','admin','member')""",
      (job['created_by'], job['file_id'], job['project_id'])).fetchone()
    if not row:
        raise ConversionError('The file was deleted or your workspace access changed. Reopen the project to continue.')
    return row


def _asset_callbacks(storage, job):
    project_id, file_id = str(job['project_id']), str(job['file_id'])
    prefix = f'{project_id}/{file_id}/assets/'
    proxy = f'/api/projects/{project_id}/files/{file_id}/assets/'
    def store(blob, extension):
        name = hashlib.sha256(blob).hexdigest() + '.' + extension
        storage.upload(prefix + name, blob, 'image/png')
        return proxy + name
    def load(url):
        if isinstance(url, str) and re.fullmatch(r'data:image/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+', url):
            import base64
            from conversion import _image
            try:
                data = base64.b64decode(url.split(',', 1)[1], validate=True)
                return _image(data, lambda normalized, _extension: normalized)
            except Exception as exc:
                raise ConversionError('An embedded image could not be decoded safely.') from exc
        if not isinstance(url, str) or not url.startswith(proxy):
            raise ConversionError('Use uploaded project images before exporting; remote image addresses are not fetched.')
        name = url[len(proxy):]
        if not re.fullmatch(r'[a-f0-9]{64}\.(?:png|jpg|jpeg|gif|webp)', name):
            raise ConversionError('An image reference is invalid.')
        return storage.download(prefix + name, limit=10 * 1024 * 1024)
    return store, load


def process_job(connection, storage, job):
    file = authorized_file(connection, job)
    payload = job['payload'] or {}
    store_image, load_image = _asset_callbacks(storage, job)
    with conversion_timeout(), tempfile.TemporaryDirectory(prefix='devcon-convert-') as temp:
        if job['kind'] == 'import':
            original_path = payload.get('storagePath', '')
            expected_prefix = f"{job['project_id']}/{job['file_id']}/original/"
            if not original_path.startswith(expected_prefix):
                raise ConversionError('The original upload is outside this project file.')
            data = storage.download(original_path)
            connection.execute("UPDATE file_jobs SET progress=30 WHERE id=%s", (job['id'],))
            content, warnings = import_file(data, payload.get('originalName', ''), store_image)
            revision_id = uuid.uuid4()
            baseline = payload.get('baseRevisionId') or file['current_revision_id']
            with connection.transaction():
                # Recheck authorization and deletion immediately before committing converted data.
                authorized_file(connection, job)
                current = connection.execute('SELECT current_revision_id FROM workspace_files WHERE id=%s FOR UPDATE', (job['file_id'],)).fetchone()
                conflict = str(current['current_revision_id']) != str(baseline)
                connection.execute("""INSERT INTO file_revisions(id,file_id,parent_id,content,source,conflict,created_by)
                  VALUES(%s,%s,%s,%s,'import',%s,%s)""", (revision_id, job['file_id'], baseline, Jsonb(content), conflict, job['created_by']))
                connection.execute("""UPDATE workspace_files SET warnings=%s,original_path=%s,original_name=%s,updated_at=now() WHERE id=%s""",
                  (Jsonb(warnings), original_path, payload.get('originalName'), job['file_id']))
                if not conflict:
                    connection.execute("""UPDATE workspace_files SET current_revision_id=%s,kind=%s WHERE id=%s""",
                      (revision_id, content['kind'], job['file_id']))
                result = {'fileId': str(job['file_id']), 'revisionId': str(revision_id), 'warnings': warnings, 'conflict': conflict}
                _succeed(connection, job, result)
                return result
        if job['kind'] == 'export':
            revision = connection.execute('SELECT content FROM file_revisions WHERE id=%s AND file_id=%s', (job['revision_id'], job['file_id'])).fetchone()
            if not revision:
                raise ConversionError('The saved revision is unavailable. Reopen the file and retry.')
            connection.execute("UPDATE file_jobs SET progress=35 WHERE id=%s", (job['id'],))
            result_path = export_file(revision['content'], payload.get('format', ''), Path(temp), load_image)
            # Never upload an export if access was revoked during conversion.
            authorized_file(connection, job)
            extension = payload['format']
            destination = f"{job['project_id']}/{job['file_id']}/exports/{job['revision_id']}.{extension}"
            mime = {'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'pdf': 'application/pdf', 'csv': 'text/csv', 'md': 'text/markdown'}[extension]
            storage.upload(destination, result_path.read_bytes(), mime)
            result = {'fileId': str(job['file_id']), 'revisionId': str(job['revision_id']), 'storagePath': destination}
            _succeed(connection, job, result)
            return result
        raise ConversionError('This worker only processes file import and export jobs.')


def _succeed(connection, job, result):
    connection.execute("""UPDATE file_jobs SET status='succeeded',progress=100,result=%s,error=NULL,finished_at=now(),
      metrics=jsonb_build_object('durationMs',extract(epoch from (now()-started_at))*1000)
      WHERE id=%s AND status='running'""", (Jsonb(result), job['id']))


def run_once(connection, storage):
    job = claim_job(connection)
    if not job:
        return False
    started = time.monotonic()
    try:
        process_job(connection, storage, job)
        LOGGER.info(json.dumps({'jobId': str(job['id']), 'kind': job['kind'], 'status': 'succeeded', 'durationMs': round((time.monotonic() - started) * 1000)}))
    except Exception as error:
        # Do not log exception text from storage/DB libraries: it can include credentials or file contents.
        message = str(error) if isinstance(error, ConversionError) else 'The conversion service could not complete this job. Retry it in DevCon.'
        connection.execute("""UPDATE file_jobs SET status='failed',error=%s,finished_at=now(),
          metrics=jsonb_build_object('durationMs',%s) WHERE id=%s""", (message, round((time.monotonic() - started) * 1000), job['id']))
        LOGGER.warning(json.dumps({'jobId': str(job['id']), 'kind': job['kind'], 'status': 'failed', 'errorType': type(error).__name__, 'durationMs': round((time.monotonic() - started) * 1000)}))
    return True


def main():
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    if not all(os.environ.get(name) for name in required):
        raise SystemExit('Set DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY for the file worker.')
    storage = Storage(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    while True:
        try:
            with psycopg.connect(os.environ['DATABASE_URL'], autocommit=True, row_factory=dict_row) as connection:
                LOGGER.info('{"event":"file-worker-ready"}')
                while True:
                    if not run_once(connection, storage):
                        time.sleep(2)
        except (psycopg.Error, requests.RequestException):
            LOGGER.warning('{"event":"file-worker-connection-unavailable","retrySeconds":5}')
            time.sleep(5)


if __name__ == '__main__':
    main()
