"""Organiser outreach: sponsors, event communications and certificate issuing."""

import uuid

from fastapi import APIRouter, status

from app.api.deps import DbSession
from app.api.v1.auth import CurrentUser
from app.schemas.engagement import (
    CertificateIssueOut,
    CommunicationFields,
    CommunicationOut,
    CommunicationSendOut,
    CommunicationUpdate,
    SponsorFields,
    SponsorOut,
    SponsorUpdate,
)
from app.services import audit, engagement, outreach
from app.services.authorization import Capability, require_event

router = APIRouter(prefix="/admin", tags=["admin: outreach"])


@router.get("/sponsors", response_model=list[SponsorOut])
def list_sponsors(user: CurrentUser, db: DbSession) -> list[SponsorOut]:
    return [outreach.to_sponsor_out(item) for item in outreach.list_sponsors(db, user)]


@router.post("/sponsors", response_model=SponsorOut, status_code=status.HTTP_201_CREATED)
def create_sponsor(payload: SponsorFields, user: CurrentUser, db: DbSession) -> SponsorOut:
    return outreach.to_sponsor_out(outreach.create_sponsor(db, user, payload))


@router.patch("/sponsors/{sponsor_id}", response_model=SponsorOut)
def update_sponsor(sponsor_id: uuid.UUID, payload: SponsorUpdate, user: CurrentUser, db: DbSession) -> SponsorOut:
    return outreach.to_sponsor_out(outreach.update_sponsor(db, user, sponsor_id, payload))


@router.delete("/sponsors/{sponsor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sponsor(sponsor_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    outreach.delete_sponsor(db, user, sponsor_id)


@router.get("/events/{event_id}/communications", response_model=list[CommunicationOut])
def list_communications(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> list[CommunicationOut]:
    return [CommunicationOut.model_validate(item) for item in outreach.list_communications(db, user, event_id)]


@router.post("/events/{event_id}/communications", response_model=CommunicationOut, status_code=status.HTTP_201_CREATED)
def create_communication(
    event_id: uuid.UUID, payload: CommunicationFields, user: CurrentUser, db: DbSession
) -> CommunicationOut:
    """Save a draft. Send it with POST /admin/communications/{id}/send."""
    return CommunicationOut.model_validate(outreach.create_communication(db, user, event_id, payload))


@router.patch("/communications/{communication_id}", response_model=CommunicationOut)
def update_communication(
    communication_id: uuid.UUID, payload: CommunicationUpdate, user: CurrentUser, db: DbSession
) -> CommunicationOut:
    return CommunicationOut.model_validate(outreach.update_communication(db, user, communication_id, payload))


@router.delete("/communications/{communication_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_communication(communication_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    outreach.delete_communication(db, user, communication_id)


@router.post("/communications/{communication_id}/send", response_model=CommunicationSendOut)
def send_communication(communication_id: uuid.UUID, user: CurrentUser, db: DbSession) -> CommunicationSendOut:
    """Deliver an in-app notification to the audience. External channels need a provider (not configured)."""
    item, recipients = outreach.send_communication(db, user, communication_id)
    return CommunicationSendOut(
        **CommunicationOut.model_validate(item).model_dump(),
        recipients=recipients,
        external_delivery=outreach.EXTERNAL_DELIVERY_NOTE,
    )


@router.post("/events/{event_id}/certificates/issue", response_model=CertificateIssueOut)
def issue_certificates(event_id: uuid.UUID, user: CurrentUser, db: DbSession) -> CertificateIssueOut:
    """Issue certificates to every checked-in, confirmed attendee of a completed event. Idempotent."""
    event, _ = require_event(db, user, event_id, Capability.MANAGE)
    issued = engagement.issue_certificates(db, event_id=event.id)
    audit.record(db, "certificates.issued", actor=user, target_type="event", target_id=event.id, event_id=event.id,
                 details={"issued": issued})
    db.commit()
    return CertificateIssueOut(issued=issued, total=engagement.certificate_count(db, event.id))
