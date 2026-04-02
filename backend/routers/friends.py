from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, Friendship, FriendshipStatus
from schemas import FriendRequestCreate, FriendshipOut
from dependencies import require_any
from sqlalchemy import or_

router = APIRouter(prefix="/friends", tags=["Friends"])

@router.post("/request", status_code=status.HTTP_201_CREATED)
def send_friend_request(
    payload: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    if current_user.id == payload.addressee_id:
        raise HTTPException(status_code=400, detail="Cannot send a friend request to yourself")
    
    existing = db.query(Friendship).filter(
        or_(
            (Friendship.requester_id == current_user.id) & (Friendship.addressee_id == payload.addressee_id),
            (Friendship.requester_id == payload.addressee_id) & (Friendship.addressee_id == current_user.id)
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Friendship or pending request already exists")
    
    friendship = Friendship(
        requester_id=current_user.id,
        addressee_id=payload.addressee_id,
        status=FriendshipStatus.pending
    )
    db.add(friendship)
    db.commit()
    db.refresh(friendship)
    return {"message": "Friend request sent", "friendship_id": friendship.id}

@router.post("/{friendship_id}/accept", response_model=FriendshipOut)
def accept_friend_request(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    friendship = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Request not found")
    if friendship.addressee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to accept this request")
    if friendship.status != FriendshipStatus.pending:
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    friendship.status = FriendshipStatus.accepted
    db.commit()
    db.refresh(friendship)
    return friendship

@router.get("", response_model=List[FriendshipOut])
def get_friendships(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    return db.query(Friendship).filter(
        or_(
            Friendship.requester_id == current_user.id,
            Friendship.addressee_id == current_user.id
        )
    ).all()
