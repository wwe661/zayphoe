from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, GroupMember, Expense, ExpenseShare, ManualDebit, Settlement
from schemas import UserOut
from dependencies import require_any, get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_any)):
    from models import UserRole
    return db.query(User).filter(
        User.id != current_user.id,
        User.role != UserRole.admin,
    ).all()


@router.get("/me/groups")
def my_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    memberships = db.query(GroupMember).filter(GroupMember.user_id == current_user.id).all()
    return [
        {
            "group_id": m.group_id,
            "group_name": m.group.name,
            "joined_at": m.joined_at,
        }
        for m in memberships
    ]


@router.get("/me/balance")
def my_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    """Returns per-group balance breakdown for the logged-in user."""
    memberships = db.query(GroupMember).filter(GroupMember.user_id == current_user.id).all()
    result = []
    for gm in memberships:
        group_id = gm.group_id

        # Owed from expense shares
        expense_debt = sum(
            s.share_amount
            for e in db.query(Expense).filter(Expense.group_id == group_id).all()
            for s in e.shares
            if s.debtor_id == current_user.id
        )
        # Owed from manual debits
        manual_debt = sum(
            d.amount
            for d in db.query(ManualDebit).filter(
                ManualDebit.group_id == group_id,
                ManualDebit.debtor_id == current_user.id,
            ).all()
        )
        total_owed = round(expense_debt + manual_debt, 2)

        # To receive (paid expenses owed by others)
        total_to_receive = sum(
            s.share_amount
            for e in db.query(Expense).filter(
                Expense.group_id == group_id,
                Expense.paid_by == current_user.id,
            ).all()
            for s in e.shares
        )
        total_to_receive = round(total_to_receive, 2)

        # Settled amounts
        settled_paid = sum(
            s.amount
            for s in db.query(Settlement).filter(
                Settlement.group_id == group_id,
                Settlement.debtor_id == current_user.id,
                Settlement.is_paid == True,
            ).all()
        )
        settled_received = sum(
            s.amount
            for s in db.query(Settlement).filter(
                Settlement.group_id == group_id,
                Settlement.creditor_id == current_user.id,
                Settlement.is_paid == True,
            ).all()
        )

        result.append({
            "group_id": group_id,
            "group_name": gm.group.name,
            "total_owed": round(total_owed - settled_paid, 2),
            "total_to_receive": round(total_to_receive - settled_received, 2),
            "net_balance": round((total_to_receive - settled_received) - (total_owed - settled_paid), 2),
        })

    return result
