"""Operational commands: ``python -m app.cli migrate|create-admin|recover``."""
import argparse
import getpass
import sys

from app.core.logging import configure_logging


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("migrate", help="Create tables, add missing columns and indexes")
    create_admin = sub.add_parser("create-admin", help="Create or reset an admin account")
    create_admin.add_argument("email")
    sub.add_parser("recover", help="Mark jobs interrupted by a crash as failed")
    args = parser.parse_args(argv)
    configure_logging()

    from app.db.database import SessionLocal
    from app.db.migrations import run_migrations

    if args.command == "migrate":
        run_migrations()
        return 0

    if args.command == "create-admin":
        from app.core.security import hash_password
        from app.db.models import User

        password = getpass.getpass("Password (min 10 chars): ")
        if len(password) < 10:
            print("Password too short.", file=sys.stderr)
            return 1
        run_migrations()
        with SessionLocal() as db:
            email = args.email.strip().lower()
            user = db.query(User).filter(User.email == email).first() or User(email=email, full_name="Administrator")
            user.password_hash = hash_password(password)
            user.role = "admin"
            user.is_active = True
            db.add(user)
            db.commit()
        print(f"Admin {email} is ready.")
        return 0

    if args.command == "recover":
        from app.services.startup_service import recover_stale_work

        with SessionLocal() as db:
            print(recover_stale_work(db))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
