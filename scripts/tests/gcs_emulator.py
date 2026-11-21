#!/usr/bin/env python3
"""
Linearizable, thread-safe HTTP emulator for the Google Cloud Storage JSON API v1.

Designed for isolated QA testing with the REAL `gcloud storage` CLI binary via:
    CLOUDSDK_API_ENDPOINT_OVERRIDES_STORAGE=http://127.0.0.1:<port>/storage/v1/

Supports:
- Bucket describe (`GET /storage/v1/b/{bucket}`)
- Object describe (`GET /storage/v1/b/{bucket}/o/{object}`)
- Conditional object upload (`POST /upload/storage/v1/b/{bucket}/o`) for:
  - `uploadType=multipart`
  - `uploadType=media`
  - `uploadType=resumable` (init + `PUT` chunk/final)
- Conditional object delete (`DELETE /storage/v1/b/{bucket}/o/{object}`)
- Strict atomic enforcement of `ifGenerationMatch` (including `0` for create-only
  and existing generation for compare-and-swap / compare-and-delete) returning
  authentic HTTP 412 `PreconditionFailed` / `conditionNotMet` responses.
- Full HTTP audit trail, fault injection, deterministic race hooks, and
  controlled clock support for >15-minute TTL tests.
"""

from __future__ import annotations

import base64
import datetime
import email.parser
import gzip
import hashlib
import http.server
import json
import os
import re
import struct
import threading
import time
import urllib.parse
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple


# Castagnoli CRC32C table so crc32c hashes match real GCS checksums.
def _build_crc32c_table() -> List[int]:
    poly = 0x82F63B78
    table: List[int] = []
    for i in range(256):
        crc = i
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ poly
            else:
                crc >>= 1
        table.append(crc)
    return table


_CRC32C_TABLE = _build_crc32c_table()


def _crc32c_b64(data: bytes) -> str:
    crc = 0xFFFFFFFF
    for b in data:
        crc = _CRC32C_TABLE[(crc ^ b) & 0xFF] ^ (crc >> 8)
    crc ^= 0xFFFFFFFF
    return base64.b64encode(struct.pack(">I", crc)).decode("ascii")


def _md5_b64(data: bytes) -> str:
    return base64.b64encode(hashlib.md5(data).digest()).decode("ascii")


def _rfc3339(epoch: float) -> str:
    dt = datetime.datetime.fromtimestamp(epoch, tz=datetime.timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


@dataclass
class StoredObject:
    bucket: str
    name: str
    data: bytes
    generation: int
    metageneration: int
    content_type: str
    metadata: Dict[str, str]
    time_created: str
    updated: str

    def to_gcs_resource(self) -> Dict[str, Any]:
        return {
            "kind": "storage#object",
            "id": f"{self.bucket}/{self.name}/{self.generation}",
            "name": self.name,
            "bucket": self.bucket,
            "generation": str(self.generation),
            "metageneration": str(self.metageneration),
            "contentType": self.content_type,
            "timeCreated": self.time_created,
            "updated": self.updated,
            "size": str(len(self.data)),
            "md5Hash": _md5_b64(self.data),
            "crc32c": _crc32c_b64(self.data),
            "etag": f"etag-{self.generation}-{self.metageneration}",
            "metadata": dict(self.metadata),
        }


@dataclass
class AuditEntry:
    timestamp: float
    method: str
    path: str
    operation: str
    bucket: Optional[str]
    object_name: Optional[str]
    if_generation_match: Optional[str]
    status_code: int
    gen_before: Optional[int]
    gen_after: Optional[int]
    owner_after: Optional[str]


class GCSState:
    """Thread-safe linearizable GCS bucket/object store."""

    def __init__(
        self,
        initial_buckets: Optional[List[str]] = None,
        clock_fn: Optional[Callable[[], float]] = None,
    ) -> None:
        self.lock = threading.Lock()
        self.buckets: Dict[str, Dict[str, Any]] = {}
        self.objects: Dict[Tuple[str, str], StoredObject] = {}
        self.resumable_sessions: Dict[str, Dict[str, Any]] = {}
        self._next_gen = 1700000000000000
        self.clock_fn: Callable[[], float] = clock_fn or time.time
        self.audit_log: List[AuditEntry] = []

        # Fault injection & race hooks
        # Example: fault_rules["bucket_get"] = (403, "AccessDenied", "Caller lacks permission")
        self.fault_rules: Dict[str, Tuple[int, str, str]] = {}
        # Optional hook called BEFORE acquiring lock on commit of an upload:
        # hook(state, bucket, obj_name, if_gen_match, metadata)
        self.before_upload_commit_hook: Optional[
            Callable[["GCSState", str, str, Optional[str], Dict[str, str]], None]
        ] = None

        for b in initial_buckets or []:
            self.create_bucket(b)

    def now(self) -> float:
        return self.clock_fn()

    def create_bucket(self, name: str) -> None:
        with self.lock:
            self.buckets[name] = {
                "kind": "storage#bucket",
                "id": name,
                "name": name,
                "location": "US-CENTRAL1",
                "storageClass": "STANDARD",
                "timeCreated": _rfc3339(self.now()),
                "updated": _rfc3339(self.now()),
            }

    def _alloc_generation(self) -> int:
        self._next_gen += 1
        return self._next_gen

    def seed_object(
        self,
        bucket: str,
        name: str,
        data: bytes,
        metadata: Optional[Dict[str, str]] = None,
        content_type: str = "application/json",
    ) -> StoredObject:
        with self.lock:
            if bucket not in self.buckets:
                self.buckets[bucket] = {
                    "kind": "storage#bucket",
                    "id": bucket,
                    "name": bucket,
                }
            gen = self._alloc_generation()
            ts = _rfc3339(self.now())
            existing = self.objects.get((bucket, name))
            created = existing.time_created if existing else ts
            obj = StoredObject(
                bucket=bucket,
                name=name,
                data=data,
                generation=gen,
                metageneration=1,
                content_type=content_type,
                metadata={str(k): str(v) for k, v in (metadata or {}).items()},
                time_created=created,
                updated=ts,
            )
            self.objects[(bucket, name)] = obj
            return obj

    def get_object_snapshot(self, bucket: str, name: str) -> Optional[StoredObject]:
        with self.lock:
            obj = self.objects.get((bucket, name))
            if obj is None:
                return None
            return StoredObject(
                bucket=obj.bucket,
                name=obj.name,
                data=obj.data,
                generation=obj.generation,
                metageneration=obj.metageneration,
                content_type=obj.content_type,
                metadata=dict(obj.metadata),
                time_created=obj.time_created,
                updated=obj.updated,
            )


def _json_error(code: int, reason: str, message: str) -> bytes:
    payload = {
        "error": {
            "code": code,
            "message": message,
            "errors": [
                {
                    "domain": "global",
                    "reason": reason,
                    "message": message,
                }
            ],
        }
    }
    return json.dumps(payload).encode("utf-8")


def _parse_multipart_related(
    content_type: str, body: bytes, content_encoding: str = ""
) -> Tuple[Dict[str, Any], bytes, str]:
    m = re.search(r"boundary=([^;\s]+)", content_type, re.IGNORECASE)
    if not m:
        raise ValueError(f"Missing multipart boundary in Content-Type: {content_type!r}")
    boundary = m.group(1).strip("'\"")
    delim = b"--" + boundary.encode("ascii")

    raw_chunks = body.split(delim)
    parsed_parts: List[Tuple[Dict[str, str], bytes]] = []
    # Discard preamble (chunks[0]) and closing epilogue ("--" or after "--").
    for chunk in raw_chunks[1:]:
        if chunk.startswith(b"--"):
            break
        if chunk.startswith(b"\r\n"):
            chunk = chunk[2:]
        elif chunk.startswith(b"\n"):
            chunk = chunk[1:]

        if chunk.endswith(b"\r\n"):
            chunk = chunk[:-2]
        elif chunk.endswith(b"\n"):
            chunk = chunk[:-1]

        if b"\r\n\r\n" in chunk:
            hdr_bytes, part_body = chunk.split(b"\r\n\r\n", 1)
        elif b"\n\n" in chunk:
            hdr_bytes, part_body = chunk.split(b"\n\n", 1)
        else:
            raise ValueError(f"Malformed multipart part without header separator: {chunk[:80]!r}")

        hdrs: Dict[str, str] = {}
        for line in hdr_bytes.decode("utf-8", errors="replace").splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                hdrs[k.strip().lower()] = v.strip()
        parsed_parts.append((hdrs, part_body))

    if len(parsed_parts) < 2:
        raise ValueError(
            f"Expected multipart/related with >=2 parts, got {len(parsed_parts)} "
            f"(ct={content_type!r}, body_len={len(body)})"
        )

    meta_hdrs, meta_bytes = parsed_parts[0]
    meta = json.loads((meta_bytes or b"{}").decode("utf-8"))

    data_hdrs, obj_bytes = parsed_parts[1]
    part_encoding = (data_hdrs.get("content-encoding") or content_encoding or "").lower()
    if "gzip" in part_encoding:
        obj_bytes = gzip.decompress(obj_bytes)
    part_ct = (
        data_hdrs.get("content-type", "").split(";", 1)[0].strip()
        or meta.get("contentType")
        or "application/octet-stream"
    )
    return meta, obj_bytes, part_ct


_RE_BUCKET = re.compile(r"^/storage/v1/b/([^/]+)/?$")
_RE_OBJECT_LIST = re.compile(r"^/storage/v1/b/([^/]+)/o/?$")
_RE_OBJECT = re.compile(r"^/storage/v1/b/([^/]+)/o/(.+)$")
_RE_UPLOAD = re.compile(r"^/(?:upload/)?storage/v1/b/([^/]+)/o/?$")


class GCSHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        # Suppress default noisy stderr logging during QA runs.
        return

    @property
    def state(self) -> GCSState:
        return self.server.gcs_state  # type: ignore[attr-defined]

    def _send_json(self, code: int, body: bytes, extra_headers: Optional[Dict[str, str]] = None) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _send_empty(self, code: int, extra_headers: Optional[Dict[str, str]] = None) -> None:
        self.send_response(code)
        self.send_header("Content-Length", "0")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()

    def _read_body(self) -> bytes:
        te = (self.headers.get("Transfer-Encoding") or "").lower()
        if "chunked" in te:
            buf = bytearray()
            while True:
                line = self.rfile.readline()
                if not line:
                    break
                size_hex = line.strip().split(b";", 1)[0]
                if not size_hex:
                    continue
                chunk_size = int(size_hex, 16)
                if chunk_size == 0:
                    # Read optional trailer lines up to blank line
                    while True:
                        trailer = self.rfile.readline()
                        if not trailer or trailer in (b"\r\n", b"\n"):
                            break
                    break
                buf.extend(self.rfile.read(chunk_size))
                # Trailing CRLF after chunk payload
                self.rfile.read(2)
            return bytes(buf)
        length_str = self.headers.get("Content-Length")
        if not length_str:
            return b""
        length = int(length_str)
        if length <= 0:
            return b""
        return self.rfile.read(length)

    def _get_if_gen_match(self, qs: Dict[str, List[str]]) -> Optional[str]:
        if "ifGenerationMatch" in qs and qs["ifGenerationMatch"]:
            return qs["ifGenerationMatch"][0]
        hdr = self.headers.get("x-goog-if-generation-match")
        if hdr is not None:
            return hdr.strip()
        return None

    def _record_audit(
        self,
        operation: str,
        bucket: Optional[str],
        object_name: Optional[str],
        if_gen_match: Optional[str],
        status_code: int,
        gen_before: Optional[int],
        gen_after: Optional[int],
        owner_after: Optional[str],
    ) -> None:
        self.state.audit_log.append(
            AuditEntry(
                timestamp=self.state.now(),
                method=self.command,
                path=self.path,
                operation=operation,
                bucket=bucket,
                object_name=object_name,
                if_generation_match=if_gen_match,
                status_code=status_code,
                gen_before=gen_before,
                gen_after=gen_after,
                owner_after=owner_after,
            )
        )

    def _dispatch(self, fn: Callable[[], None]) -> None:
        try:
            fn()
        except Exception as exc:
            self._send_json(
                500,
                _json_error(500, "internalError", f"GCS emulator internal error: {exc!r}"),
            )

    def do_GET(self) -> None:
        self._dispatch(self._handle_get)

    def do_POST(self) -> None:
        self._dispatch(self._handle_post)

    def do_PUT(self) -> None:
        self._dispatch(self._handle_put)

    def do_DELETE(self) -> None:
        self._dispatch(self._handle_delete)

    def _handle_get(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)

        m_bucket = _RE_BUCKET.match(parsed.path)
        if m_bucket:
            bucket = urllib.parse.unquote(m_bucket.group(1))
            if "bucket_get" in self.state.fault_rules:
                code, reason, msg = self.state.fault_rules["bucket_get"]
                self._record_audit("bucket_get", bucket, None, None, code, None, None, None)
                self._send_json(code, _json_error(code, reason, msg))
                return
            with self.state.lock:
                b_obj = self.state.buckets.get(bucket)
            if b_obj is None:
                err = _json_error(404, "notFound", f"The specified bucket {bucket} does not exist.")
                self._record_audit("bucket_get", bucket, None, None, 404, None, None, None)
                self._send_json(404, err)
                return
            self._record_audit("bucket_get", bucket, None, None, 200, None, None, None)
            self._send_json(200, json.dumps(b_obj).encode("utf-8"))
            return

        m_list = _RE_OBJECT_LIST.match(parsed.path)
        if m_list:
            bucket = urllib.parse.unquote(m_list.group(1))
            if "object_list" in self.state.fault_rules:
                code, reason, msg = self.state.fault_rules["object_list"]
                self._record_audit("object_list", bucket, None, None, code, None, None, None)
                self._send_json(code, _json_error(code, reason, msg))
                return
            prefix = qs.get("prefix", [""])[0]
            delimiter = qs.get("delimiter", [""])[0]
            items: List[Dict[str, Any]] = []
            prefixes_set: set[str] = set()
            with self.state.lock:
                if bucket not in self.state.buckets:
                    err = _json_error(404, "notFound", f"The specified bucket {bucket} does not exist.")
                    self._record_audit("object_list", bucket, None, None, 404, None, None, None)
                    self._send_json(404, err)
                    return
                for (b_name, o_name), obj in sorted(self.state.objects.items()):
                    if b_name != bucket:
                        continue
                    if prefix and not o_name.startswith(prefix):
                        continue
                    rest = o_name[len(prefix):]
                    if delimiter and delimiter in rest:
                        idx = rest.index(delimiter)
                        prefixes_set.add(prefix + rest[: idx + len(delimiter)])
                    else:
                        items.append(obj.to_gcs_resource())
            payload: Dict[str, Any] = {"kind": "storage#objects"}
            if items:
                payload["items"] = items
            if prefixes_set:
                payload["prefixes"] = sorted(prefixes_set)
            self._record_audit("object_list", bucket, prefix or None, None, 200, None, None, None)
            self._send_json(200, json.dumps(payload).encode("utf-8"))
            return

        m_obj = _RE_OBJECT.match(parsed.path)
        if m_obj:
            bucket = urllib.parse.unquote(m_obj.group(1))
            obj_name = urllib.parse.unquote(m_obj.group(2))
            if "object_get" in self.state.fault_rules:
                code, reason, msg = self.state.fault_rules["object_get"]
                self._record_audit("object_get", bucket, obj_name, None, code, None, None, None)
                self._send_json(code, _json_error(code, reason, msg))
                return
            with self.state.lock:
                if bucket not in self.state.buckets:
                    code = 404
                    err = _json_error(404, "notFound", f"Bucket {bucket} not found.")
                    self._record_audit("object_get", bucket, obj_name, None, code, None, None, None)
                    self._send_json(code, err)
                    return
                obj = self.state.objects.get((bucket, obj_name))
                if obj is None:
                    err = _json_error(
                        404,
                        "notFound",
                        f"No such object: {bucket}/{obj_name}",
                    )
                    self._record_audit("object_get", bucket, obj_name, None, 404, None, None, None)
                    self._send_json(404, err)
                    return
                res = obj.to_gcs_resource()
                gen = obj.generation
                owner = obj.metadata.get("build_id")

            alt = qs.get("alt", ["json"])[0]
            self._record_audit("object_get", bucket, obj_name, None, 200, gen, gen, owner)
            if alt == "media":
                self.send_response(200)
                self.send_header("Content-Type", res["contentType"])
                self.send_header("Content-Length", str(len(obj.data)))
                self.end_headers()
                self.wfile.write(obj.data)
            else:
                self._send_json(200, json.dumps(res).encode("utf-8"))
            return

        self._send_json(404, _json_error(404, "notFound", f"Unknown GET path {self.path}"))

    def _commit_upload(
        self,
        bucket: str,
        obj_name: str,
        data: bytes,
        content_type: str,
        metadata: Dict[str, str],
        if_gen_match: Optional[str],
    ) -> None:
        if "object_upload" in self.state.fault_rules:
            code, reason, msg = self.state.fault_rules["object_upload"]
            self._record_audit("object_upload", bucket, obj_name, if_gen_match, code, None, None, None)
            self._send_json(code, _json_error(code, reason, msg))
            return

        hook = self.state.before_upload_commit_hook
        if hook is not None:
            hook(self.state, bucket, obj_name, if_gen_match, metadata)

        with self.state.lock:
            if bucket not in self.state.buckets:
                err = _json_error(404, "notFound", f"Bucket {bucket} not found.")
                self._record_audit("object_upload", bucket, obj_name, if_gen_match, 404, None, None, None)
                self._send_json(404, err)
                return

            existing = self.state.objects.get((bucket, obj_name))
            gen_before = existing.generation if existing else None

            if if_gen_match is not None:
                expected = int(if_gen_match)
                if expected == 0:
                    if existing is not None:
                        err = _json_error(
                            412,
                            "conditionNotMet",
                            "At least one of the pre-conditions you specified did not hold.",
                        )
                        self._record_audit(
                            "object_upload",
                            bucket,
                            obj_name,
                            if_gen_match,
                            412,
                            gen_before,
                            gen_before,
                            existing.metadata.get("build_id"),
                        )
                        self._send_json(412, err)
                        return
                else:
                    if existing is None or existing.generation != expected:
                        err = _json_error(
                            412,
                            "conditionNotMet",
                            "At least one of the pre-conditions you specified did not hold.",
                        )
                        self._record_audit(
                            "object_upload",
                            bucket,
                            obj_name,
                            if_gen_match,
                            412,
                            gen_before,
                            gen_before,
                            existing.metadata.get("build_id") if existing else None,
                        )
                        self._send_json(412, err)
                        return

            new_gen = self.state._alloc_generation()
            ts = _rfc3339(self.state.now())
            created = existing.time_created if existing else ts
            stored = StoredObject(
                bucket=bucket,
                name=obj_name,
                data=data,
                generation=new_gen,
                metageneration=1,
                content_type=content_type,
                metadata=metadata,
                time_created=created,
                updated=ts,
            )
            self.state.objects[(bucket, obj_name)] = stored
            res = stored.to_gcs_resource()
            owner_after = metadata.get("build_id")

        self._record_audit(
            "object_upload",
            bucket,
            obj_name,
            if_gen_match,
            200,
            gen_before,
            new_gen,
            owner_after,
        )
        self._send_json(200, json.dumps(res).encode("utf-8"))

    def _handle_post(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        m_up = _RE_UPLOAD.match(parsed.path)
        if not m_up:
            self._send_json(404, _json_error(404, "notFound", f"Unknown POST path {self.path}"))
            return

        bucket = urllib.parse.unquote(m_up.group(1))
        upload_type = qs.get("uploadType", [""])[0]
        if_gen_match = self._get_if_gen_match(qs)
        body = self._read_body()
        ct = self.headers.get("Content-Type", "application/octet-stream")
        ce = self.headers.get("Content-Encoding", "")

        if upload_type == "resumable":
            meta = json.loads(body.decode("utf-8")) if body else {}
            obj_name = meta.get("name") or (qs.get("name", [""])[0])
            if not obj_name:
                self._send_json(400, _json_error(400, "invalid", "Missing object name"))
                return
            upload_id = uuid.uuid4().hex
            raw_meta = {str(k): str(v) for k, v in (meta.get("metadata") or {}).items()}
            with self.state.lock:
                self.state.resumable_sessions[upload_id] = {
                    "bucket": bucket,
                    "name": obj_name,
                    "content_type": meta.get("contentType") or "application/octet-stream",
                    "metadata": raw_meta,
                    "if_generation_match": if_gen_match,
                    "chunks": bytearray(),
                }
            host = self.headers.get("Host") or f"127.0.0.1:{self.server.server_address[1]}"
            loc = f"http://{host}/upload/storage/v1/b/{urllib.parse.quote(bucket)}/o?uploadType=resumable&upload_id={upload_id}"
            self._send_empty(200, {"Location": loc})
            return

        if upload_type == "multipart" or ct.lower().startswith("multipart/related"):
            meta, data, part_ct = _parse_multipart_related(ct, body, ce)
            obj_name = meta.get("name") or qs.get("name", [""])[0]
            raw_meta = {str(k): str(v) for k, v in (meta.get("metadata") or {}).items()}
            content_type = meta.get("contentType") or part_ct
            self._commit_upload(bucket, obj_name, data, content_type, raw_meta, if_gen_match)
            return

        # uploadType=media or fallback
        obj_name = qs.get("name", [""])[0]
        if "gzip" in ce.lower() and body:
            body = gzip.decompress(body)
        self._commit_upload(bucket, obj_name, body, ct, {}, if_gen_match)

    def _handle_put(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        upload_id = qs.get("upload_id", [""])[0]
        body = self._read_body()
        if not upload_id:
            self._send_json(400, _json_error(400, "invalid", "Missing upload_id"))
            return

        with self.state.lock:
            sess = self.state.resumable_sessions.get(upload_id)
        if sess is None:
            self._send_json(404, _json_error(404, "notFound", "Upload session not found"))
            return

        content_range = self.headers.get("Content-Range", "")
        is_final = True
        if content_range:
            # e.g. "bytes 0-123/124" or "bytes */124" or "bytes 0-99/*"
            m = re.match(r"bytes\s+(?:\*|(\d+)-(\d+))/(\*|\d+)", content_range.strip())
            if m:
                end_str, total_str = m.group(2), m.group(3)
                if total_str == "*":
                    is_final = False
                elif end_str is not None and int(end_str) + 1 < int(total_str):
                    is_final = False

        sess["chunks"].extend(body)
        if not is_final:
            end_byte = len(sess["chunks"]) - 1
            headers = {"Range": f"bytes=0-{end_byte}"} if end_byte >= 0 else {}
            self._send_empty(308, headers)
            return

        with self.state.lock:
            self.state.resumable_sessions.pop(upload_id, None)
        data = bytes(sess["chunks"])
        if "gzip" in self.headers.get("Content-Encoding", "").lower() and data:
            data = gzip.decompress(data)
        self._commit_upload(
            sess["bucket"],
            sess["name"],
            data,
            sess["content_type"],
            sess["metadata"],
            sess["if_generation_match"],
        )

    def _handle_delete(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        m_obj = _RE_OBJECT.match(parsed.path)
        if not m_obj:
            self._send_json(404, _json_error(404, "notFound", f"Unknown DELETE path {self.path}"))
            return

        bucket = urllib.parse.unquote(m_obj.group(1))
        obj_name = urllib.parse.unquote(m_obj.group(2))
        if_gen_match = self._get_if_gen_match(qs)

        if "object_delete" in self.state.fault_rules:
            code, reason, msg = self.state.fault_rules["object_delete"]
            self._record_audit("object_delete", bucket, obj_name, if_gen_match, code, None, None, None)
            self._send_json(code, _json_error(code, reason, msg))
            return

        with self.state.lock:
            existing = self.state.objects.get((bucket, obj_name))
            if existing is None:
                err = _json_error(404, "notFound", f"No such object: {bucket}/{obj_name}")
                self._record_audit("object_delete", bucket, obj_name, if_gen_match, 404, None, None, None)
                self._send_json(404, err)
                return

            gen_before = existing.generation
            if if_gen_match is not None:
                expected = int(if_gen_match)
                if existing.generation != expected:
                    err = _json_error(
                        412,
                        "conditionNotMet",
                        "At least one of the pre-conditions you specified did not hold.",
                    )
                    self._record_audit(
                        "object_delete",
                        bucket,
                        obj_name,
                        if_gen_match,
                        412,
                        gen_before,
                        gen_before,
                        existing.metadata.get("build_id"),
                    )
                    self._send_json(412, err)
                    return

            del self.state.objects[(bucket, obj_name)]

        self._record_audit("object_delete", bucket, obj_name, if_gen_match, 204, gen_before, None, None)
        self._send_empty(204)


class GSEmulatorServer:
    """Context-managed threaded GCS HTTP server."""

    def __init__(
        self,
        buckets: Optional[List[str]] = None,
        clock_fn: Optional[Callable[[], float]] = None,
    ) -> None:
        self.state = GCSState(initial_buckets=buckets or ["levelproaudio_cloudbuild"], clock_fn=clock_fn)
        self._httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), GCSHandler)
        self._httpd.gcs_state = self.state  # type: ignore[attr-defined]
        self.port = self._httpd.server_address[1]
        self.endpoint_url = f"http://127.0.0.1:{self.port}/storage/v1/"
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)

    def start(self) -> "GSEmulatorServer":
        self._thread.start()
        return self

    def stop(self) -> None:
        self._httpd.shutdown()
        self._httpd.server_close()

    def __enter__(self) -> "GSEmulatorServer":
        return self.start()

    def __exit__(self, *args: Any) -> None:
        self.stop()
