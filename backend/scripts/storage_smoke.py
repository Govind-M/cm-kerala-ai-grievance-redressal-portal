"""Explicit opt-in Storage provisioning/synthetic smoke test. Never invoked by pytest/startup."""

import argparse
import hashlib
from uuid import uuid4

import httpx

from app.core.config import get_settings
from app.integrations.storage import StorageError, SupabaseStorage


def fingerprint(settings):
    return hashlib.sha256(
        f"{settings.supabase_url}|{settings.supabase_storage_bucket}".encode()
    ).hexdigest()[:16]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["inspect", "provision", "smoke"])
    parser.add_argument("--approved-storage-requests", action="store_true")
    parser.add_argument("--confirm-target")
    args = parser.parse_args()
    settings = get_settings()
    target = fingerprint(settings)
    if not args.approved_storage_requests:
        print(
            f"No Storage requests made. Target fingerprint: {target}. Explicit approval required."
        )
        return 2
    if args.confirm_target != target:
        parser.error("Matching storage target fingerprint required")
    storage = SupabaseStorage(settings)
    key = None
    cleanup_failed = False
    try:
        if args.operation == "provision":
            storage.provision()
            print("Private bucket verified; no existing bucket replaced.")
        else:
            if storage.bucket() is None:
                raise StorageError("Private bucket missing; provision separately")
            if args.operation == "smoke":
                key = "smoke-tests/" + str(uuid4())
                content = b"%PDF-1.4\n% Synthetic storage transport probe only\n%%EOF"
                storage.upload(settings.supabase_storage_bucket, key, content, "application/pdf")
                url = storage.sign(settings.supabase_storage_bucket, key, "synthetic.pdf")
                with httpx.Client(timeout=15, follow_redirects=False, trust_env=False) as client:
                    response = client.get(url)
                if response.status_code != 200 or response.content != content:
                    raise StorageError("Synthetic download verification failed")
                print("Synthetic upload and signed download verified.")
            else:
                print("Private bucket verified.")
    except (StorageError, httpx.HTTPError):
        print("Storage verification failed; credentials/provider details withheld.")
        return 1
    finally:
        if key:
            try:
                storage.remove(settings.supabase_storage_bucket, key)
                print("Synthetic object cleanup completed.")
            except StorageError:
                cleanup_failed = True
                print(f"Synthetic cleanup required: {key}")
    print("Gemini requests: 0.")
    return 1 if cleanup_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
