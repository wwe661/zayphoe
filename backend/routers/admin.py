from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Group, User
from schemas import GroupCreate, GroupUpdate, GroupOut, UserOut
from dependencies import require_admin, get_current_user

router = APIRouter(prefix="/admin", tags=["Main Admin"])


@router.get("/groups", response_model=List[GroupOut])
def list_all_groups(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(Group).all()


@router.get("/users", response_model=List[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(User).all()




@router.put("/groups/{group_id}", response_model=GroupOut)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if payload.name is not None:
        group.name = payload.name
    if payload.description is not None:
        group.description = payload.description
    db.commit()
    db.refresh(group)
    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    from models import GroupMember, Expense, ExpenseShare, ManualDebit, Settlement
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    # Cascade delete financial data first
    expenses = db.query(Expense).filter(Expense.group_id == group_id).all()
    for exp in expenses:
        db.query(ExpenseShare).filter(ExpenseShare.expense_id == exp.id).delete()
        db.delete(exp)
    db.query(ManualDebit).filter(ManualDebit.group_id == group_id).delete()
    db.query(Settlement).filter(Settlement.group_id == group_id).delete()
    db.query(GroupMember).filter(GroupMember.group_id == group_id).delete()
    db.delete(group)
    db.commit()
