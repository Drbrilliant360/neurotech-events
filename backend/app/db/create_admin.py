"""Create or promote a platform administrator.

    python -m app.db.create_admin --email admin@example.org --name "Ops Lead"

The password is read from ADMIN_PASSWORD or prompted for. Platform admins can sign in on the
site and open the super-admin transaction views without the static ADMIN_API_TOKEN.
"""

import argparse
import getpass
import os

from sqlalchemy import select

from app.db.models import User
from app.db.models.enums import UserRole
from app.db.session import SessionLocal
from app.schemas.auth import RegisterRequest
from app.services.auth import normalize_email, password_hash, register_user


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or promote a platform_admin user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Platform Admin")
    args = parser.parse_args()

    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Password (min 8 chars): ")
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters.")

    with SessionLocal() as db:
        email = normalize_email(args.email)
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = register_user(
                db, RegisterRequest(email=email, password=password, full_name=args.name), role=UserRole.PLATFORM_ADMIN
            )
            action = "created"
        else:
            user.role = UserRole.PLATFORM_ADMIN
            user.password_hash = password_hash.hash(password)
            user.is_active = True
            db.commit()
            action = "promoted"
    print(f"{action} platform_admin {email}")


if __name__ == "__main__":
    main()
