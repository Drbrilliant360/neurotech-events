import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ProfileFields(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    phone: str | None = Field(default=None, max_length=40)
    organization: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=200)
    country: str | None = Field(default=None, max_length=120)
    interests: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("interests")
    @classmethod
    def normalize_interests(cls, interests: list[str]) -> list[str]:
        return [interest.strip() for interest in interests if interest.strip()]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=200)
    profile: ProfileFields = Field(default_factory=ProfileFields)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    profile: ProfileFields | None = None
    # The attendee record linked to this account (tickets, registrations).
    attendee_id: uuid.UUID | None = None
    # True when the user may open the organiser console: a platform admin, an organization
    # owner/admin or an event manager. Authorization is still enforced per request.
    organizer: bool = False


class ProfileUpdateRequest(ProfileFields):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Seconds until the access token expires; refresh before then with `refresh_token`.
    expires_in: int
    refresh_token: str
    user: UserResponse
